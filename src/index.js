const TRACKED_PIPELINES = [
  { name: "Residential V2.0", countsTowardTarget: true },
  { name: "First Nations", countsTowardTarget: true },
  { name: "Commercial", countsTowardTarget: true },
  { name: "Service Pipeline", countsTowardTarget: false },
  { name: "Consulting", countsTowardTarget: false }
];

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
});

async function pdFetch(path, token, params = {}) {
  const url = new URL(`https://api.pipedrive.com${path}`);
  url.searchParams.set("api_token", token);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json();

  if (!response.ok || body.success === false) {
    throw new Error(body.error || `Pipedrive request failed (${response.status})`);
  }
  return body;
}

function dateParts(value, timeZone = "America/Vancouver") {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter(p => p.type !== "literal").map(p => [p.type, p.value])
  );
}

function pipedriveDate(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { year: m[1], month: m[2], day: m[3] } : dateParts(value);
}

function monthStartRFC3339() {
  const now = dateParts(new Date());
  // Vancouver can be UTC-7 or UTC-8. Using 00:00Z on the first is intentionally
  // earlier than local midnight, so no current-month wins can be missed.
  return `${now.year}-${now.month}-01T00:00:00Z`;
}

async function currentMonthWonDeals(pipelineId, token) {
  const deals = [];
  let cursor = null;

  do {
    const body = await pdFetch("/api/v2/deals", token, {
      pipeline_id: pipelineId,
      status: "won",
      updated_since: monthStartRFC3339(),
      limit: 500,
      ...(cursor ? { cursor } : {})
    });

    deals.push(...(body.data || []));
    cursor = body.additional_data?.next_cursor || null;
  } while (cursor);

  const today = dateParts(new Date());
  return deals.filter(d => {
    if (!d.won_time) return false;
    const dp = pipedriveDate(d.won_time);
    return dp.year === today.year && dp.month === today.month;
  });
}

// Previous complete Sunday-Saturday week in America/Vancouver.
function previousWeek() {
  const now = dateParts(new Date());
  const localDay = new Date(`${now.year}-${now.month}-${now.day}T12:00:00Z`);
  const dow = localDay.getUTCDay();
  localDay.setUTCDate(localDay.getUTCDate() - dow - 7);
  const start = localDay.toISOString().slice(0, 10);
  localDay.setUTCDate(localDay.getUTCDate() + 7);
  const end = localDay.toISOString().slice(0, 10);
  return { start, endExclusive: end };
}

async function appointmentLeaderboard(token) {
  const week = previousWeek();
  try {
    const [typesBody, usersBody] = await Promise.all([
      pdFetch('/api/v1/activityTypes', token), pdFetch('/api/v1/users', token)
    ]);
    const activityType = (typesBody.data || []).find(t =>
      String(t.name || '').trim().toLowerCase() === 'in-person meeting');
    if (!activityType) throw new Error('In-Person Meeting activity type not found');
    const names = new Map((usersBody.data || []).map(u => [String(u.id), u.name]));
    const counts = new Map();
    let cursor = null, complete = false, examined = 0;
    // Completed activities can be created months earlier. Never filter by add_time.
    // The API returns a completion timestamp as marked_as_done_time when available.
    // Scan completed records and sort by update_time so recently completed activities
    // are encountered early. An incomplete scan is NOT presented as a final score.
    for (let page = 0; page < 30; page++) {
      const body = await pdFetch('/api/v2/activities', token, {
        done: true, sort_by: 'update_time', sort_direction: 'desc', limit: 500,
        ...(cursor ? { cursor } : {})
      });
      const items = body.data || [];
      examined += items.length;
      for (const activity of items) {
        if (!(activity.done === true || activity.done === 1 || String(activity.done).toLowerCase() === 'true' || String(activity.done) === '1')) continue;
        if (String(activity.type) !== String(activityType.key_string)) continue;
        const completed = activity.marked_as_done_time || activity.done_time || activity.completed_time;
        if (!completed) continue;
        const date = dateParts(String(completed).includes('T') || /[zZ]|[+-]\d\d:\d\d$/.test(String(completed)) ? completed : String(completed).replace(' ', 'T') + 'Z');
        const day = `${date.year}-${date.month}-${date.day}`;
        if (day < week.start || day >= week.endExclusive) continue;
        const id = String(activity.owner_id?.id ?? activity.owner_id ?? activity.user_id?.id ?? activity.user_id ?? '');
        if (id) counts.set(id, (counts.get(id) || 0) + 1);
      }
      cursor = body.additional_data?.next_cursor || null;
      if (!cursor || !items.length) { complete = true; break; }
    }
    const leaders = [...counts.entries()].map(([id, shots]) => ({
      name: names.get(id) || `Rep ${id}`, shots
    })).sort((a,b) => b.shots-a.shots || a.name.localeCompare(b.name));
    return {start: week.start, endExclusive: week.endExclusive,
      leaders, teamShots: leaders.reduce((sum, p) => sum+p.shots, 0),
      complete, examined, status: complete ? 'READY' : 'INCOMPLETE ACTIVITY SCAN'};
  } catch (error) {
    return {start: week.start, endExclusive: week.endExclusive,
      leaders: [], teamShots: null, complete: false,
      status: 'VERIFY PIPEDRIVE', error: String(error.message || error)};
  }
}

async function dashboard(env) {
  if (!env.PIPEDRIVE_API_TOKEN) {
    return json({ error: "PIPEDRIVE_API_TOKEN is not configured in Cloudflare." }, 500);
  }

  const pipelinesBody = await pdFetch("/api/v2/pipelines", env.PIPEDRIVE_API_TOKEN, {
    limit: 100
  });
  const available = pipelinesBody.data || [];

  const resolved = TRACKED_PIPELINES.map(config => {
    const found = available.find(p =>
      String(p.name).trim().toLowerCase() === config.name.toLowerCase()
    );
    if (!found) throw new Error(`Pipeline not found in Pipedrive: ${config.name}`);
    return { ...config, id: found.id };
  });

  const results = await Promise.all(resolved.map(async p => {
    const deals = await currentMonthWonDeals(p.id, env.PIPEDRIVE_API_TOKEN);
    return {
      name: p.name,
      countsTowardTarget: p.countsTowardTarget,
      sales: deals.reduce((sum, d) => sum + Number(d.value || 0), 0),
      deals: deals.length,
      recentWins: true
        ? deals.filter(d => p.name !== "Service Pipeline" || Number(d.value || 0) > 0).map(d => ({
            id: `${p.id}:${d.id}`,
            amount: Number(d.value || 0),
            pipeline: p.name,
            wonTime: d.won_time
          }))
        : []
    };
  }));

  const targetPipelines = results.filter(p => p.countsTowardTarget);

  return json({
    pipelines: results.map(({ recentWins, ...p }) => p),
    recentWins: results.flatMap(p => p.recentWins)
      .sort((a, b) => String(a.wonTime).localeCompare(String(b.wonTime)))
      .slice(-100),
    target: {
      sales: targetPipelines.reduce((sum, p) => sum + p.sales, 0),
      deals: targetPipelines.reduce((sum, p) => sum + p.deals, 0)
    },
    company: {
      sales: results.reduce((sum, p) => sum + p.sales, 0),
      deals: results.reduce((sum, p) => sum + p.deals, 0)
    },
appointments: {
  leaders: [],
  teamShots: null,
  complete: false,
  status: "TEMPORARILY DISABLED"
},
    updatedAt: new Date().toISOString()
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/dashboard" || url.pathname === "/api/dashboard/") {
      try {
        return await dashboard(env);
      } catch (error) {
        return json({ error: error?.message || "Unknown dashboard error" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
