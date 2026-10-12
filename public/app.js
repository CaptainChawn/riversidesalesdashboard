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

// Celebration runs only on new Won deal IDs after the initial baseline.
// This prevents every browser refresh from celebrating the entire month.
const SEEN_KEY = "riverside-sales-hq-seen-wins-v4";
let seenWins = null;
let soundEnabled = false;
const goalAudio = new Audio("/columbus-goal-horn.mp3");
goalAudio.preload = "auto";
let audioUnlocked = false;
let celebrationBusy = false;
const celebrationQueue = [];

function getSavedSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch (_) { return null; }
}

function saveSeen() {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seenWins).slice(-1000)));
  } catch (_) {}
}

function processWins(data) {
  const wins = Array.isArray(data.recentWins) ? data.recentWins : [];
  if (seenWins === null) {
    seenWins = getSavedSeen();
    if (!seenWins) {
      seenWins = new Set(wins.map(w => w.id));
      saveSeen();
      return;
    }
  }

  const newWins = wins.filter(w => !seenWins.has(w.id));
  wins.forEach(w => seenWins.add(w.id));
  saveSeen();

  // Avoid replaying stale events when the TV was off for a long time.
  // A deal marked Won in the last 15 minutes is eligible.
  const now = Date.now();
  newWins.filter(w => {
    const parsed = Date.parse(String(w.wonTime || "").replace(" ", "T"));
    // Pipedrive wonTime has no timezone. We prefer a false negative to
    // an old deal unexpectedly triggering the horn on startup.
    return Number.isFinite(parsed) && Math.abs(now - parsed) < 15 * 60 * 1000;
  }).forEach(w => celebrationQueue.push(w));
  runCelebrations();
}

async function playGoalHorn() {
  if (!soundEnabled) return;
  try {
    goalAudio.pause();
    goalAudio.currentTime = 0;
    goalAudio.volume = 1;
    await goalAudio.play();
  } catch (error) {
    console.warn("TV browser blocked goal horn playback", error);
    document.getElementById("soundButton").textContent = "🔇 TAP TO ENABLE AUDIO";
    soundEnabled = false;
  }
}

async function runCelebrations() {
  if (celebrationBusy || !celebrationQueue.length) return;
  celebrationBusy = true;
  while (celebrationQueue.length) {
    const win = celebrationQueue.shift();
    document.getElementById("goalAmount").textContent = money(win.amount);
    document.getElementById("goalPipeline").textContent = `${win.pipeline.toUpperCase()} DEAL WON`;
    document.getElementById("celebration").hidden = false;
    playGoalHorn();
    await new Promise(resolve => setTimeout(resolve, 20000));
    goalAudio.pause();
    goalAudio.currentTime = 0;
    document.getElementById("celebration").hidden = true;
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  celebrationBusy = false;
}

document.getElementById("soundButton").addEventListener("click", async () => {
  const button = document.getElementById("soundButton");
  try {
    // A real user gesture is needed for many TV and desktop browsers.
    goalAudio.volume = 0;
    await goalAudio.play();
    goalAudio.pause();
    goalAudio.currentTime = 0;
    goalAudio.volume = 1;
    soundEnabled = true;
    button.textContent = "🔊 GOAL HORNS ON";
    button.classList.add("enabled");
  } catch (error) {
    soundEnabled = false;
    button.textContent = "🔇 AUDIO BLOCKED • TRY TEST";
    console.warn("Audio unlock failed", error);
  }
});
document.getElementById("testButton").addEventListener("click", () => {
  celebrationQueue.push({amount: 24800, pipeline:"TEST • RESIDENTIAL V2.0"});
  runCelebrations();
});

async function loadDashboard() {
  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    render(data);
    processWins(data);
  } catch (error) {
    document.getElementById("status").textContent = "PIPEDRIVE CONNECTION ERROR";
    document.getElementById("lastUpdated").textContent = error.message || "Unable to load";
  }
}

loadDashboard();
setInterval(loadDashboard, REFRESH_MS);
