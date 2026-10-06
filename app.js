const MONTHLY_TARGET = 300000;

const money = value => new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "CAD", maximumFractionDigits: 0
}).format(value || 0);

function render(data) {
  const now = new Date();
  const month = now.toLocaleString("en-CA", { month: "long" }).toUpperCase();
  const year = now.getFullYear();

  const targetSales = data.target.sales;
  const targetDeals = data.target.deals;
  const average = targetDeals ? targetSales / targetDeals : 0;
  const pace = MONTHLY_TARGET ? targetSales / MONTHLY_TARGET : 0;
  const toGo = Math.max(MONTHLY_TARGET - targetSales, 0);

  document.getElementById("monthLabel").textContent = `${month} ${year}`;
  document.getElementById("targetSales").textContent = money(targetSales);
  document.getElementById("soldLabel").textContent = `${money(targetSales)} SOLD`;
  document.getElementById("targetLabel").textContent = `TARGET ${money(MONTHLY_TARGET)}`;
  document.getElementById("toGoLabel").textContent = toGo > 0
    ? `${money(toGo)} TO GO`
    : `TARGET BEAT BY ${money(targetSales - MONTHLY_TARGET)}`;
  document.getElementById("wonDeals").textContent = targetDeals.toLocaleString("en-CA");
  document.getElementById("avgDeal").textContent = money(average);
  document.getElementById("pace").textContent = `${Math.round(pace * 100)}%`;
  document.getElementById("companySales").textContent = money(data.company.sales);
  document.getElementById("companyDeals").textContent = `${data.company.deals} WON`;
  document.getElementById("statusNote").textContent =
    `LIVE • PIPEDRIVE • UPDATED ${new Date(data.updatedAt).toLocaleTimeString("en-CA",{hour:"numeric",minute:"2-digit"})}`;

  const rows = document.getElementById("pipelineRows");
  rows.innerHTML = "";
  data.pipelines.forEach(p => {
    const row = document.createElement("div");
    row.className = `pipeline-row${p.countsTowardTarget ? " target" : ""}`;
    row.innerHTML = `<span class="pipeline-name">${p.name.toUpperCase()}</span>
      <span class="pipeline-money">${money(p.sales)}</span>
      <span class="pipeline-wins">${p.deals} WON</span>`;
    rows.appendChild(row);
  });

  const track = document.getElementById("track");
  track.innerHTML = "";
  const segments = 30;
  const lit = Math.min(segments, Math.round(pace * segments));
  for (let i=0; i<segments; i++) {
    const s = document.createElement("span");
    s.className = "seg" + (i < lit ? " on" : "");
    track.appendChild(s);
  }
}

async function loadDashboard() {
  try {
    document.getElementById("statusNote").textContent = "CONNECTING TO PIPEDRIVE…";
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Dashboard API failed");
    render(data);
  } catch (err) {
    console.error(err);
    document.getElementById("statusNote").textContent = "PIPEDRIVE CONNECTION ERROR";
  }
}

loadDashboard();
setInterval(loadDashboard, 5 * 60 * 1000);
