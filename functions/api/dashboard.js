const TRACKED_PIPELINES = [
  { name: "Residential V2.0", countsTowardTarget: true },
  { name: "First Nations", countsTowardTarget: true },
  { name: "Service Pipeline", countsTowardTarget: false },
  { name: "Consulting", countsTowardTarget: false }
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function pdFetch(path, token) {
  const url = new URL(`https://api.pipedrive.com${path}`);
  url.searchParams.set("api_token", token);
  const response = await fetch(url.toString(), {
    headers: { "accept": "application/json" }
  });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.error || `Pipedrive request failed (${response.status})`);
  }
  return body;
}

async function getAllWonDealsForPipeline(pipelineId, token) {
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

function localDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}

export async function onRequestGet(context) {
  try {
    const token = context.env.PIPEDRIVE_API_TOKEN;
    if (!token) return json({ error: "PIPEDRIVE_API_TOKEN is not configured in Cloudflare." }, 500);

    const pipelinesResponse = await pdFetch("/v1/pipelines", token);
    const available = pipelinesResponse.data || [];

    const resolved = TRACKED_PIPELINES.map(config => {
      const found = available.find(p =>
        String(p.name).trim().toLowerCase() === config.name.toLowerCase()
      );
      if (!found) throw new Error(`Pipeline not found in Pipedrive: ${config.name}`);
      return { ...config, id: found.id };
    });

    const tz = "America/Vancouver";
    const today = localDateParts(new Date(), tz);
    const currentYear = Number(today.year);
    const currentMonth = Number(today.month);

    const results = await Promise.all(resolved.map(async p => {
      const deals = await getAllWonDealsForPipeline(p.id, token);

      const monthDeals = deals.filter(d => {
        if (!d.won_time) return false;
        const parts = localDateParts(new Date(d.won_time.replace(" ", "T") + "Z"), tz);
        return Number(parts.year) === currentYear && Number(parts.month) === currentMonth;
      });

      return {
        name: p.name,
        countsTowardTarget: p.countsTowardTarget,
        sales: monthDeals.reduce((sum, d) => sum + Number(d.value || 0), 0),
        deals: monthDeals.length
      };
    }));

    const targetPipelines = results.filter(p => p.countsTowardTarget);
    const target = {
      sales: targetPipelines.reduce((sum,p) => sum + p.sales, 0),
      deals: targetPipelines.reduce((sum,p) => sum + p.deals, 0)
    };
    const company = {
      sales: results.reduce((sum,p) => sum + p.sales, 0),
      deals: results.reduce((sum,p) => sum + p.deals, 0)
    };

    return json({
      pipelines: results,
      target,
      company,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return json({ error: error.message || "Unknown dashboard error" }, 500);
  }
}
