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
      pdFetch('/api/v1/activityTypes', token),
      pdFetch('/api/v1/users', token)
    ]);
    const activityType = (typesBody.data || []).find(t =>
      String(t.name || '').trim().toLowerCase() === 'in-person meeting');
    if (!activityType) throw new Error('In-Person Meeting activity type not found');
    const userNames = new Map((usersBody.data || []).map(u => [String(u.id), u.name]));
    const counts = new Map();
    let cursor = null;
    let complete = false;
    // Descending add_time: stop as soon as we reach an activity created before last week.
    // Guard against huge data volumes instead of failing the entire scoreboard.
    for (let page = 0; page < 12; page++) {
      const body = await pdFetch('/api/v2/activities', token, {
        sort_by: 'add_time', sort_direction: 'desc', limit: 500,
        ...(cursor ? { cursor } : {})
      });
      const items = body.data || [];
      for (const a of items) {
        const created = String(a.add_time || '').slice(0, 10);
        if (!created) continue;
        if (created < week.start) { complete = true; break; }
        if (created >= week.endExclusive || String(a.type) !== String(activityType.key_string)) continue;
        const id = String(a.owner_id?.id ?? a.owner_id ?? a.user_id?.id ?? a.user_id ?? '');
        if (id) counts.set(id, (counts.get(id) || 0) + 1);
      }
      if (complete) break;
      cursor = body.additional_data?.next_cursor || null;
      if (!cursor || !items.length) { complete = true; break; }
    }
    const leaders = [...counts.entries()].map(([id, shots]) => ({
      name: userNames.get(id) || `Rep ${id}`, shots
    })).sort((a,b) => b.shots - a.shots || a.name.localeCompare(b.name));
    return {
      start: week.start, end: week.endExclusive,
      leaders, teamShots: leaders.reduce((sum,p) => sum + p.shots, 0),
      complete,
      status: complete ? 'READY' : 'CHECK DATA VOLUME'
    };
  } catch (error) {
    return {start: week.start, end: week.endExclusive, leaders: [], teamShots: null,
      complete: false, status: 'VERIFY PIPEDRIVE', error: String(error.message || error)};
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
    appointments: await appointmentLeaderboard(env.PIPEDRIVE_API_TOKEN),
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
