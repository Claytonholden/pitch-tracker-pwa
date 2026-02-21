// Pitch Tracker (Offline) - super simple local data model
// Stored in localStorage so it works on iPhone easily.

const LS_KEY = "pitch_tracker_v1";

const PITCH_TYPES = ["FB", "2S", "CH", "SL", "CB", "CUT"];
const RESULTS = ["Ball", "CStr", "SwStr", "Foul", "InPlay-Out", "1B", "2B", "3B", "HR"];

let state = loadState();

// "pending" selection
let pending = { pitch: null, zone: null, result: null };

function defaultState() {
  return {
    game: null, // {id, opponent, field, createdAt}
    lineup: [], // [{id, num, name, bats}]
    pitcher: null, // {name}
    batterId: null, // active batter id
    pitches: [] // [{t, pitcher, batterId, pitch, zone, result}]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function $(id) { return document.getElementById(id); }

function setStatus(msg) {
  $("statusLine").textContent = msg;
}

function clearPending() {
  pending = { pitch: null, zone: null, result: null };
  $("pendingTag").textContent = "Ready";
}

function ensureGame() {
  if (!state.game) {
    setStatus("No game started. Tap New Game.");
    return false;
  }
  return true;
}

function ensureLiveSelection() {
  if (!state.pitcher?.name) return "Set a pitcher first.";
  if (!state.batterId) return "Set a batter first.";
  return null;
}

function currentBatter() {
  return state.lineup.find(b => b.id === state.batterId) || null;
}

function render() {
  // status line
  if (state.game) {
    setStatus(`Game: ${state.game.opponent || "Opponent"} • ${new Date(state.game.createdAt).toLocaleString()}`);
  } else {
    setStatus("No game started.");
  }

  // tags
  $("pitcherTag").textContent = `Pitcher: ${state.pitcher?.name || "(none)"}`;
  const b = currentBatter();
  $("batterTag").textContent = `Batter: ${b ? `#${b.num} ${b.name}` : "(none)"}`;

  // lineup list + dropdown
  if (state.lineup.length === 0) {
    $("lineupList").innerHTML = "No batters yet. Add them above.";
  } else {
    const rows = state.lineup
      .slice()
      .sort((a,b)=>Number(a.num)-Number(b.num))
      .map(x => `<div class="row" style="justify-content:space-between; align-items:center;">
        <div><b>#${x.num}</b> ${x.name} <span class="muted">(${x.bats})</span></div>
        <button class="small danger" onclick="removeBatter('${x.id}')">Remove</button>
      </div>`);
    $("lineupList").innerHTML = rows.join("");
  }

  // dropdown
  $("batterSelect").innerHTML = state.lineup
    .slice().sort((a,b)=>Number(a.num)-Number(b.num))
    .map(x => `<option value="${x.id}">#${x.num} ${x.name} (${x.bats})</option>`)
    .join("");
  if (state.batterId) $("batterSelect").value = state.batterId;

  // stats + recent
  renderStats();
  renderRecent();
}

function renderStats() {
  if (state.pitches.length === 0) {
    $("statsBox").textContent = "No pitches yet.";
    return;
  }

  const total = state.pitches.length;
  const strikes = state.pitches.filter(p => ["CStr","SwStr","Foul","InPlay-Out","1B","2B","3B","HR"].includes(p.result)).length;
  const whiffs = state.pitches.filter(p => p.result === "SwStr").length;
  const fps = state.pitches.filter((p, i) => i === 0 || state.pitches[i-1].batterId !== p.batterId).length; // rough

  const byPitch = {};
  for (const pt of PITCH_TYPES) byPitch[pt] = { total: 0, strikes: 0, whiffs: 0 };
  for (const p of state.pitches) {
    if (!byPitch[p.pitch]) byPitch[p.pitch] = { total: 0, strikes: 0, whiffs: 0 };
    byPitch[p.pitch].total++;
    if (["CStr","SwStr","Foul","InPlay-Out","1B","2B","3B","HR"].includes(p.result)) byPitch[p.pitch].strikes++;
    if (p.result === "SwStr") byPitch[p.pitch].whiffs++;
  }

  const pitchLines = Object.entries(byPitch)
    .filter(([k,v]) => v.total > 0)
    .map(([k,v]) => {
      const sPct = Math.round((v.strikes / v.total) * 100);
      const wPct = Math.round((v.whiffs / v.total) * 100);
      return `<tr><td><b>${k}</b></td><td>${v.total}</td><td>${sPct}%</td><td>${wPct}%</td></tr>`;
    }).join("");

  $("statsBox").innerHTML = `
    <div class="row">
      <span class="pill">Total Pitches: ${total}</span>
      <span class="pill">Strike%: ${Math.round((strikes/total)*100)}%</span>
      <span class="pill">Whiffs: ${whiffs}</span>
    </div>
    <div style="margin-top:10px;">
      <table>
        <thead><tr><th>Pitch</th><th>Total</th><th>Strike%</th><th>Whiff%</th></tr></thead>
        <tbody>${pitchLines || `<tr><td colspan="4" class="muted">No pitch-type data yet</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function renderRecent() {
  const recent = state.pitches.slice(-12).reverse();
  if (recent.length === 0) {
    $("recentBox").textContent = "No pitches yet.";
    return;
  }
  const rows = recent.map(p => {
    const b = state.lineup.find(x => x.id === p.batterId);
    const batterLabel = b ? `#${b.num} ${b.name}` : "(batter)";
    return `<tr>
      <td>${new Date(p.t).toLocaleTimeString()}</td>
      <td>${p.pitcher}</td>
      <td>${batterLabel}</td>
      <td><b>${p.pitch}</b></td>
      <td>${p.zone}</td>
      <td>${p.result}</td>
    </tr>`;
  }).join("");

  $("recentBox").innerHTML = `
    <table>
      <thead><tr><th>Time</th><th>P</th><th>B</th><th>Type</th><th>Zone</th><th>Result</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ---- actions ----
function newId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function removeBatter(id) {
  state.lineup = state.lineup.filter(b => b.id !== id);
  if (state.batterId === id) state.batterId = null;
  // keep pitches (so history doesn't disappear)
  saveState();
  render();
}
window.removeBatter = removeBatter;

function logPitch() {
  const err = ensureLiveSelection();
  if (err) { alert(err); return; }
  if (!pending.pitch || !pending.zone || !pending.result) {
    alert("Pick pitch type, zone, and result first.");
    return;
  }
  const batter = currentBatter();
  state.pitches.push({
    t: Date.now(),
    pitcher: state.pitcher.name,
    batterId: batter.id,
    pitch: pending.pitch,
    zone: pending.zone,
    result: pending.result
  });
  saveState();
  clearPending();
  render();
}

function undoLast() {
  if (state.pitches.length === 0) return;
  state.pitches.pop();
  saveState();
  render();
}

// ---- UI wiring ----
function buildButtons() {
  // pitch types
  const ptBox = $("pitchTypes");
  ptBox.innerHTML = "";
  for (const pt of PITCH_TYPES) {
    const btn = document.createElement("button");
    btn.className = "small";
    btn.textContent = pt;
    btn.onclick = () => {
      pending.pitch = pt;
      $("pendingTag").textContent = `Pitch: ${pending.pitch} • Zone: ${pending.zone || "-"} • Result: ${pending.result || "-"}`;
    };
    ptBox.appendChild(btn);
  }

  // zone grid 1-9
  const zg = $("zoneGrid");
  zg.innerHTML = "";
  for (let z = 1; z <= 9; z++) {
    const btn = document.createElement("button");
    btn.className = "zonebtn";
    btn.textContent = z;
    btn.onclick = () => {
      pending.zone = z;
      $("pendingTag").textContent = `Pitch: ${pending.pitch || "-"} • Zone: ${pending.zone} • Result: ${pending.result || "-"}`;
    };
    zg.appendChild(btn);
  }

  // results
  const rBox = $("results");
  rBox.innerHTML = "";
  for (const r of RESULTS) {
    const btn = document.createElement("button");
    btn.className = "small";
    btn.textContent = r;
    btn.onclick = () => {
      pending.result = r;
      $("pendingTag").textContent = `Pitch: ${pending.pitch || "-"} • Zone: ${pending.zone || "-"} • Result: ${pending.result}`;
      // if all 3 chosen, auto-log (fast!)
      if (pending.pitch && pending.zone && pending.result) logPitch();
    };
    rBox.appendChild(btn);
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

// buttons
$("newGameBtn").onclick = () => {
  const opp = $("opponent").value.trim();
  const field = $("field").value.trim();
  state.game = { id: newId(), opponent: opp, field, createdAt: Date.now() };
  saveState();
  render();
};

$("clearAllBtn").onclick = () => {
  if (!confirm("Delete ALL saved data on this phone?")) return;
  localStorage.removeItem(LS_KEY);
  state = defaultState();
  saveState();
  render();
};

$("addBatterBtn").onclick = () => {
  if (!ensureGame()) { alert("Start a game first."); return; }
  const num = $("bNum").value.trim();
  const name = $("bName").value.trim();
  const bats = $("bats").value;
  if (!num || isNaN(Number(num))) { alert("Enter a jersey number."); return; }
  if (!name) { alert("Enter a batter name."); return; }

  state.lineup.push({ id: newId(), num: Number(num), name, bats });
  $("bNum").value = "";
  $("bName").value = "";
  if (!state.batterId) state.batterId = state.lineup[state.lineup.length-1].id;
  saveState();
  render();
};

$("setPitcherBtn").onclick = () => {
  if (!ensureGame()) { alert("Start a game first."); return; }
  const name = $("pName").value.trim();
  if (!name) { alert("Enter pitcher name."); return; }
  state.pitcher = { name };
  $("pName").value = "";
  saveState();
  render();
};

$("setBatterBtn").onclick = () => {
  if (!ensureGame()) { alert("Start a game first."); return; }
  const id = $("batterSelect").value;
  if (!id) { alert("Add batters first."); return; }
  state.batterId = id;
  saveState();
  render();
};

$("undoBtn").onclick = undoLast;

// init
buildButtons();
registerServiceWorker();
render();
clearPending();
