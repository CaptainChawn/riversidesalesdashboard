const MONTHLY_TARGET = 300000;
const REFRESH_MS = 60 * 1000;

const money = value => new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "CAD", maximumFractionDigits: 0
}).format(Number(value || 0));

function render(data) {
  const sales = Number(data.target?.sales || 0);
  const deals = Number(data.target?.deals || 0);
  const pct = MONTHLY_TARGET ? (sales / MONTHLY_TARGET) * 100 : 0;
  const avg = deals ? sales / deals : 0;
  const remaining = Math.max(0, MONTHLY_TARGET - sales);

  document.getElementById("monthLabel").textContent =
    new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" })
      .format(new Date()).toUpperCase();

  document.getElementById("targetSales").textContent = money(sales);
  document.getElementById("wins").textContent = deals;
  document.getElementById("avgDeal").textContent = money(avg);
  document.getElementById("pace").textContent = `${pct.toFixed(1)}%`;
  document.getElementById("toGo").textContent = money(remaining);
  document.getElementById("progressFill").style.width = `${Math.min(100, pct)}%`;

  const rows = document.getElementById("pipelineRows");
  rows.innerHTML = "";
  for (const p of data.pipelines || []) {
    const row = document.createElement("div");
    row.className = "pipeline-row";
    row.innerHTML = `
      <div class="pipeline-name">
        <span class="dot"></span>
        <span>${p.name.toUpperCase()}</span>
        ${p.countsTowardTarget ? '<span class="tag">TARGET</span>' : ''}
      </div>
      <div class="pipeline-deals">${Number(p.deals || 0)}</div>
      <div class="pipeline-sales">${money(p.sales)}</div>
    `;
    rows.appendChild(row);
  }

  document.getElementById("companyDeals").textContent = Number(data.company?.deals || 0);
  document.getElementById("companySales").textContent = money(data.company?.sales || 0);

  const updated = new Date(data.updatedAt || Date.now());
  const t = updated.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  document.getElementById("status").textContent = `LIVE • PIPEDRIVE • ${t}`;
  document.getElementById("lastUpdated").textContent = `AUTO REFRESH • 60 SEC • UPDATED ${t}`;
}

async function loadDashboard() {
  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    render(data);
  } catch (error) {
    document.getElementById("status").textContent = "PIPEDRIVE CONNECTION ERROR";
    document.getElementById("lastUpdated").textContent = error.message || "Unable to load";
  }
}

loadDashboard();
setInterval(loadDashboard, REFRESH_MS);
