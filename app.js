const dashboard = {
  monthlyTarget: 300000,
  pipelines: [
    { name: "RESIDENTIAL V2.0", sales: 221750, deals: 11, countsTowardTarget: true },
    { name: "FIRST NATIONS", sales: 65700, deals: 3, countsTowardTarget: true },
    { name: "SERVICE PIPELINE", sales: 31400, deals: 16, countsTowardTarget: false },
    { name: "CONSULTING", sales: 48200, deals: 2, countsTowardTarget: false }
  ],
  demo: true
};

const money = value => new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "CAD", maximumFractionDigits: 0
}).format(value);

function render(data) {
  const now = new Date();
  const month = now.toLocaleString("en-CA", { month: "long" }).toUpperCase();
  const year = now.getFullYear();

  const targetPipelines = data.pipelines.filter(p => p.countsTowardTarget);
  const targetSales = targetPipelines.reduce((sum,p) => sum + p.sales, 0);
  const targetDeals = targetPipelines.reduce((sum,p) => sum + p.deals, 0);
  const companySales = data.pipelines.reduce((sum,p) => sum + p.sales, 0);
  const companyDeals = data.pipelines.reduce((sum,p) => sum + p.deals, 0);
  const average = targetDeals ? targetSales / targetDeals : 0;
  const pace = data.monthlyTarget ? targetSales / data.monthlyTarget : 0;
  const toGo = Math.max(data.monthlyTarget - targetSales, 0);

  document.getElementById("monthLabel").textContent = `${month} ${year}`;
  document.getElementById("targetSales").textContent = money(targetSales);
  document.getElementById("soldLabel").textContent = `${money(targetSales)} SOLD`;
  document.getElementById("targetLabel").textContent = `TARGET ${money(data.monthlyTarget)}`;
  document.getElementById("toGoLabel").textContent = toGo > 0 ? `${money(toGo)} TO GO` : `TARGET BEAT BY ${money(targetSales-data.monthlyTarget)}`;
  document.getElementById("wonDeals").textContent = targetDeals.toLocaleString("en-CA");
  document.getElementById("avgDeal").textContent = money(average);
  document.getElementById("pace").textContent = `${Math.round(pace*100)}%`;
  document.getElementById("companySales").textContent = money(companySales);
  document.getElementById("companyDeals").textContent = `${companyDeals} WON`;
  document.getElementById("statusNote").textContent = data.demo ? "DEMO DATA • PIPEDRIVE CONNECTION NEXT" : "LIVE • PIPEDRIVE";

  const rows = document.getElementById("pipelineRows");
  rows.innerHTML = "";
  data.pipelines.forEach(p => {
    const row = document.createElement("div");
    row.className = `pipeline-row${p.countsTowardTarget ? " target" : ""}`;
    row.innerHTML = `<span class="pipeline-name">${p.name}</span><span class="pipeline-money">${money(p.sales)}</span><span class="pipeline-wins">${p.deals} WON</span>`;
    rows.appendChild(row);
  });

  const track = document.getElementById("track");
  track.innerHTML = "";
  const segments = 30;
  const lit = Math.min(segments, Math.round(pace*segments));
  for(let i=0;i<segments;i++){
    const s=document.createElement("span");
    s.className="seg"+(i<lit?" on":"");
    track.appendChild(s);
  }
}
render(dashboard);
