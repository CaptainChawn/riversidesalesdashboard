const TRACKED_PIPELINES = [
  { name: "Residential V2.0", countsTowardTarget: true },
  { name: "First Nations", countsTowardTarget: true },
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

async function pdFetch(path, token) {
  const url = new URL(`https://api.pipedrive.com${path}`);
  url.searchParams.set("api_token", token);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.error || `Pipedrive request failed (${response.status})`);
  }
  return body;
}

async function allWonDeals(pipelineId, token) {
  const deals = [];
  let start = 0;
  const limit = 100;

  while (true) {
    const body = await pdFetch(
      `/v1/deals?status=won&pipeline_id=${pipelineId}&start=${start}&limit=${limit}`,
      token
    );
    deals.push(...(body.data || []));
    const pagination = body.additional_data?.pagination;
    if (!pagination?.more_items_in_collection) break;
    start = pagination.next_start;
  }
  return deals;
}

function dateParts(value, timeZone = "America/Vancouver") {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}

function pipedriveDate(value) {
  // Pipedrive won_time is commonly "YYYY-MM-DD HH:mm:ss".
  // Treat it as local business time for month bucketing rather than forcing UTC.
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { year: m[1], month: m[2], day: m[3] } : dateParts(value);
}

async function dashboard(env) {
  if (!env.PIPEDRIVE_API_TOKEN) {
    return json({ error: "PIPEDRIVE_API_TOKEN is not configured in Cloudflare." }, 500);
  }

  const pipelinesBody = await pdFetch("/v1/pipelines", env.PIPEDRIVE_API_TOKEN);
  const available = pipelinesBody.data || [];

  const resolved = TRACKED_PIPELINES.map(config => {
    const found = available.find(p =>
      String(p.name).trim().toLowerCase() === config.name.toLowerCase()
    );
    if (!found) throw new Error(`Pipeline not found in Pipedrive: ${config.name}`);
    return { ...config, id: found.id };
  });

  const today = dateParts(new Date());
  const results = await Promise.all(resolved.map(async p => {
    const deals = await allWonDeals(p.id, env.PIPEDRIVE_API_TOKEN);
    const currentMonthDeals = deals.filter(d => {
      if (!d.won_time) return false;
      const dp = pipedriveDate(d.won_time);
      return dp.year === today.year && dp.month === today.month;
    });
    return {
      name: p.name,
      countsTowardTarget: p.countsTowardTarget,
      sales: currentMonthDeals.reduce((sum, d) => sum + Number(d.value || 0), 0),
      deals: currentMonthDeals.length
    };
  }));

  const targetPipelines = results.filter(p => p.countsTowardTarget);
  return json({
    pipelines: results,
    target: {
      sales: targetPipelines.reduce((s,p) => s + p.sales, 0),
      deals: targetPipelines.reduce((s,p) => s + p.deals, 0)
    },
    company: {
      sales: results.reduce((s,p) => s + p.sales, 0),
      deals: results.reduce((s,p) => s + p.deals, 0)
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
