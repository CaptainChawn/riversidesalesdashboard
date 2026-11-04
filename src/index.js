const TRACKED_PIPELINES = [
  { name: "Residential V2.0", countsTowardTarget: true },
  { name: "First Nations", countsTowardTarget: true },
  { name: "Commercial", countsTowardTarget: true },
  { name: "Service Pipeline", countsTowardTarget: true },
  { name: "Consulting", countsTowardTarget: true }
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

function monthInfo(offset=0) {
  const now=dateParts(new Date());
  const date=new Date(Date.UTC(Number(now.year),Number(now.month)-1+offset,1,12));
  return {year:String(date.getUTCFullYear()),month:String(date.getUTCMonth()+1).padStart(2,"0")};
}
async function monthWonDeals(pipelineId,token,offset=0) {
  const month=monthInfo(offset);
  const deals=[];let cursor=null;let pages=0;
  do {
    const body=await pdFetch("/api/v2/deals",token,{
      pipeline_id:pipelineId,status:"won",
      updated_since:`${month.year}-${month.month}-01T00:00:00Z`,
      limit:500,...(cursor?{cursor}:{})
    });
    deals.push(...(body.data||[]));
    cursor=body.additional_data?.next_cursor||null;
    if(++pages>=12 && cursor) throw new Error("Deal pagination safety limit reached");
  }while(cursor);
  return deals.filter(d=>{
    if(!d.won_time)return false;
    const p=pipedriveDate(d.won_time);
    return p.year===month.year&&p.month===month.month;
  });
}
async function currentMonthWonDeals(id,token){return monthWonDeals(id,token,0);}
async function lastMonthSnapshot(env,resolved){
  const m=monthInfo(-1);
  const cacheKey=new Request(`https://arena-cache.internal/last-month/${m.year}-${m.month}`);
  const cache=caches.default;
  const existing=await cache.match(cacheKey);
  if(existing)return existing.json();
  const rows=await Promise.all(resolved.map(async p=>{
    const deals=await monthWonDeals(p.id,env.PIPEDRIVE_API_TOKEN,-1);
    return {name:p.name,sales:deals.reduce((n,d)=>n+Number(d.value||0),0),
      deals:deals.filter(d=>p.name!=="Service Pipeline"||Number(d.value||0)>0).length,
      freebies:p.name==="Service Pipeline"?deals.filter(d=>Number(d.value)===0).length:0};
  }));
  const snapshot={month:`${m.year}-${m.month}`,sales:rows.reduce((n,p)=>n+p.sales,0),
    deals:rows.reduce((n,p)=>n+p.deals,0),
    freebies:rows.reduce((n,p)=>n+(p.freebies||0),0),pipelines:rows};
  await cache.put(cacheKey,new Response(JSON.stringify(snapshot),{
    headers:{"cache-control":"public, max-age=43200","content-type":"application/json"}
  }));
  return snapshot;
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

// Runs only in a scheduled Worker, never in the live dashboard request.
// V3.3: bound activity retrieval by last update time. A completed activity's
// update_time cannot precede the act of marking it done. Use the day BEFORE
// the reporting week as a timezone-safe lower bound, then filter by actual
// marked_as_done_time in America/Vancouver.
async function calculateWeeklyShooters(token) {
  const week=previousWeek();
  const [typesBody,usersBody]=await Promise.all([
    pdFetch('/api/v1/activityTypes',token),pdFetch('/api/v1/users',token)
  ]);
  const type=(typesBody.data||[]).find(t=>String(t.name||'').trim().toLowerCase()==='in-person meeting');
  if(!type) throw new Error('In-Person Meeting activity type not found');
  const names=new Map((usersBody.data||[]).map(u=>[String(u.id),String(u.name||'')]));
  const startDate=new Date(`${week.start}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate()-1);
  const updatedSince=startDate.toISOString();
  const counts=new Map(),seenIds=new Set();
  let cursor=null,examined=0,complete=false,pages=0,missingCompletionTime=0;
  // Pipedrive v2 supports done + updated_since but NOT a type parameter.
  // Local type filtering is intentional. Cursor exhaustion proves completeness
  // for the query as of the snapshot time. Never claim READY at a page cap.
  for(let page=0;page<16;page++) {
    const body=await pdFetch('/api/v2/activities',token,{
      done:true,updated_since:updatedSince,
      sort_by:'update_time',sort_direction:'asc',limit:500,
      ...(cursor?{cursor}:{})
    });
    pages++;
    const items=body.data||[];examined+=items.length;
    for(const activity of items){
      if(!(activity.done===true||activity.done===1||String(activity.done)==='1'))continue;
      if(String(activity.type)!==String(type.key_string))continue;
      const completed=activity.marked_as_done_time||activity.done_time||activity.completed_time;
      if(!completed){missingCompletionTime++;continue;}
      const raw=String(completed);
      const parsed=raw.includes('T')||/[zZ]|[+-]\d\d:\d\d$/.test(raw)
        ?raw:raw.replace(' ','T')+'Z';
      const date=new Date(parsed);
      if(Number.isNaN(date.getTime())){missingCompletionTime++;continue;}
      const d=dateParts(date),day=`${d.year}-${d.month}-${d.day}`;
      if(day<week.start||day>=week.endExclusive)continue;
      const id=String(activity.id||'');if(id&&seenIds.has(id))continue;
      if(id)seenIds.add(id);
      const owner=String(activity.owner_id?.id??activity.owner_id??activity.user_id?.id??activity.user_id??'');
      if(owner)counts.set(owner,(counts.get(owner)||0)+1);
    }
    cursor=body.additional_data?.next_cursor||null;
    if(!cursor||!items.length){complete=true;break;}
  }
  const leaders=[...counts].map(([id,shots])=>({name:names.get(id)||`Rep ${id}`,shots}))
    .sort((a,b)=>b.shots-a.shots||a.name.localeCompare(b.name));
  const verified=complete&&missingCompletionTime===0;
  return {...week,leaders,teamShots:leaders.reduce((n,r)=>n+r.shots,0),
    complete:verified,examined,pages,missingCompletionTime,
    status:!complete?'PARTIAL — ACTIVITY PAGE LIMIT':
      missingCompletionTime?'PARTIAL — MISSING COMPLETION DATES':'READY',
    calculatedAt:new Date().toISOString(),method:'UPDATED SINCE WEEK START · COMPLETION DATE'};
}
async function readWeeklyShooters(env){
  const week=previousWeek();
  if(!env.ARENA_STATS)return {...week,leaders:[],teamShots:null,complete:false,status:'KV STORAGE NOT CONFIGURED'};
  const result=await env.ARENA_STATS.get(`shooters:${week.start}`,'json');
  return result||{...week,leaders:[],teamShots:null,complete:false,status:'AWAITING WEEKLY SNAPSHOT'};
}
async function runWeeklySnapshot(env){
  if(!env.ARENA_STATS)throw new Error('ARENA_STATS KV binding missing');
  if(!env.PIPEDRIVE_API_TOKEN)throw new Error('Pipedrive token missing');
  const snapshot=await calculateWeeklyShooters(env.PIPEDRIVE_API_TOKEN);
  await env.ARENA_STATS.put(`shooters:${snapshot.start}`,JSON.stringify(snapshot),{
    expirationTtl:60*60*24*28
  });
  return snapshot;
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

  // One user lookup per dashboard refresh, never one lookup per deal.
  // Personal horns are selected by the resolved Pipedrive deal owner.
  const usersBody = await pdFetch("/api/v1/users", env.PIPEDRIVE_API_TOKEN);
  const usersById = new Map((usersBody.data || []).map(u => [String(u.id), String(u.name || "")]));
  const results = await Promise.all(resolved.map(async p => {
    const deals = await currentMonthWonDeals(p.id, env.PIPEDRIVE_API_TOKEN);
    return {
      name: p.name,
      countsTowardTarget: p.countsTowardTarget,
      sales: deals.reduce((sum, d) => sum + Number(d.value || 0), 0),
      deals: deals.filter(d => p.name !== "Service Pipeline" || Number(d.value || 0) > 0).length,
      freebies: p.name === "Service Pipeline" ? deals.filter(d => Number(d.value) === 0).length : 0,
      recentWins: true
        ? deals.filter(d => p.name !== "Service Pipeline" || Number(d.value || 0) > 0).map(d => ({
            id: `${p.id}:${d.id}`,
            amount: Number(d.value || 0),
            pipeline: p.name,
            wonTime: d.won_time,
            ownerId: String(d.owner_id?.id ?? d.owner_id ?? d.user_id?.id ?? d.user_id ?? ""),
            ownerName: usersById.get(String(d.owner_id?.id ?? d.owner_id ?? d.user_id?.id ?? d.user_id ?? "")) || ""
          }))
        : []
    };
  }));

  const targetPipelines = results;
  let lastMonth=null;
  try { lastMonth=await lastMonthSnapshot(env,resolved); }
  catch(error) { lastMonth={error:"Previous-month statistics unavailable"}; }

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
    lastMonth,
    freebies: results.reduce((sum,p)=>sum+(p.freebies||0),0),
    appointments: await readWeeklyShooters(env),
    updatedAt: new Date().toISOString()
  });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runWeeklySnapshot(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);

    // Optional protected manual refresh, useful after a delayed completion or initial deploy.
    if(url.pathname==='/api/admin/refresh-shooters'){
      if(request.method!=='POST')return json({error:'POST required'},405);
      const supplied=request.headers.get('X-Arena-Admin-Key')||'';
      if(!env.ARENA_ADMIN_KEY||supplied!==env.ARENA_ADMIN_KEY)return json({error:'Unauthorized'},401);
      try{return json(await runWeeklySnapshot(env));}
      catch(error){return json({error:String(error.message||error)},500);}
    }
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
