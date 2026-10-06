const dashboardData = {
  monthlyTarget: 300000,
  monthlySales: 214750,
  dealCount: 12,
  ytdSales: 2842500,
  pipeline: "RESIDENTIAL V2.0",
  leaders: [
    { name: "STEVE", value: 82450 },
    { name: "LEE", value: 71200 },
    { name: "REP 3", value: 61100 }
  ]
};

const money = n => new Intl.NumberFormat("en-CA", { style:"currency", currency:"CAD", maximumFractionDigits:0 }).format(n);
const compactMoney = n => "$" + (n >= 1000000 ? (n/1000000).toFixed(2) + "M" : Math.round(n/1000) + "K");

function render(data){
  const now = new Date();
  const month = now.toLocaleString("en-CA", {month:"long"}).toUpperCase();
  const year = now.getFullYear();
  const pct = Math.min(100, Math.round((data.monthlySales/data.monthlyTarget)*100));
  const remaining = Math.max(0, data.monthlyTarget-data.monthlySales);
  const avg = data.dealCount ? data.monthlySales/data.dealCount : 0;

  document.getElementById("periodLabel").textContent = `${month} ${year} · ${data.pipeline}`;
  document.getElementById("monthlySales").textContent = money(data.monthlySales);
  document.getElementById("monthlyTarget").textContent = money(data.monthlyTarget);
  document.getElementById("soldCopy").textContent = `${money(data.monthlySales)} SOLD`;
  document.getElementById("remainingCopy").textContent = remaining ? `${money(remaining)} TO GO` : "TARGET BEAT";
  document.getElementById("paceCopy").textContent = `${pct}%`;
  document.getElementById("pace").textContent = `${pct}%`;
  document.getElementById("dealCount").textContent = data.dealCount;
  document.getElementById("avgDeal").textContent = money(avg);
  document.getElementById("ytdSales").textContent = compactMoney(data.ytdSales);
  document.getElementById("progress").style.width = `${pct}%`;
  document.getElementById("updatedAt").textContent = now.toLocaleTimeString("en-CA", {hour:"2-digit",minute:"2-digit"});

  const max = Math.max(...data.leaders.map(x=>x.value),1);
  document.getElementById("leaderboard").innerHTML = data.leaders.map((x,i)=>`<div class="leader"><span class="rank">${String(i+1).padStart(2,"0")}</span><span class="name">${x.name}</span><span class="bar"><i style="width:${Math.round(x.value/max*100)}%"></i></span><span class="money">${money(x.value)}</span></div>`).join("");
}
render(dashboardData);
