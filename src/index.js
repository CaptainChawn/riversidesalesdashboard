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
      deals: deals.length
    };
  }));

  const targetPipelines = results.filter(p => p.countsTowardTarget);

  return json({
    pipelines: results,
    target: {
      sales: targetPipelines.reduce((sum, p) => sum + p.sales, 0),
      deals: targetPipelines.reduce((sum, p) => sum + p.deals, 0)
    },
    company: {
      sales: results.reduce((sum, p) => sum + p.sales, 0),
      deals: results.reduce((sum, p) => sum + p.deals, 0)
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
