/* AstroPulse / CrewCheck — app.js  (engine + UI) · Made by Levi Squad */
(function () {
'use strict';
/* =====================  CREWCHECK ENGINE (pure logic)  ===================== */
const D = CC_DATA;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const sdOf = (b) => (b && b.sd > 0 ? b.sd : 1);

function symptoms(inp) {
  const s = {}; ["dizzy", "palp", "vision", "chest", "faint", "sob"].forEach(k => s[k] = !!(inp.sym && inp.sym.indexOf(k) > -1));
  return s;
}
function redFlagsOf(s) {
  const f = [];
  if (s.chest) f.push("Chest pain");
  if (s.faint) f.push("Fainting");
  if (s.sob) f.push("Severe shortness of breath");
  if (s.palp && (s.dizzy || s.vision)) f.push("Palpitations with dizziness / vision greying");
  return f;
}
function validate(inp, nowMs) {
  const missing = [], implausible = [], conflicts = [];
  D.required.forEach(f => {
    const v = num(inp[f.key]);
    if (v === null) missing.push(f.label);
    else if (v < f.min || v > f.max) implausible.push(f.label + " (" + v + " " + f.unit + ")");
  });
  const r = num(inp.rpe); if (r !== null && (r < 1 || r > 10)) implausible.push("RPE (" + r + ")");
  const sbp = num(inp.sbp), dbp = num(inp.dbp);
  if (sbp !== null && dbp !== null && dbp >= sbp) conflicts.push("Diastolic ≥ systolic");
  const ts = inp.timestampMs;
  const ageH = (typeof ts === "number" && isFinite(ts)) ? (nowMs - ts) / 3600000 : null;
  const noTs = ageH === null;
  if (ageH !== null && ageH < -0.1) conflicts.push("Timestamp is in the future");
  const stale = ageH !== null && ageH > D.staleHours;
  const total = D.required.length + 1;
  const present = D.required.length - missing.length + (noTs ? 0 : 1);
  const reasons = [];
  if (missing.length) reasons.push("Missing critical field(s): " + missing.join(", "));
  if (noTs) reasons.push("No data timestamp, so data age is unknown");
  if (stale) reasons.push("Telemetry is " + ageH.toFixed(1) + " h old (limit " + D.staleHours + " h)");
  if (implausible.length) reasons.push("Implausible value(s): " + implausible.join(", "));
  conflicts.forEach(c => reasons.push("Conflicting input: " + c));
  return { missing, implausible, conflicts, ageH, noTs, stale, present, total, completeness: present / total, reasons, blocked: reasons.length > 0 };
}
function zScores(v, b, orthoCount) {
  const raw = {}, z = {};
  raw.hr = (v.hr - b.hr.mean) / sdOf(b.hr);
  z.hr = clamp(raw.hr, 0, 4);
  const mz = (b.exMin.mean - v.exMin) / sdOf(b.exMin);
  const rp = num(v.rpe) === null ? b.rpe.mean : v.rpe;
  const rz = (rp - b.rpe.mean) / sdOf(b.rpe);
  raw.ex = 0.6 * mz + 0.4 * rz;
  z.ex = clamp(0.6 * clamp(mz, 0, 4) + 0.4 * clamp(rz, 0, 4), 0, 4);
  raw.sleep = (b.sleep.mean - v.sleep) / sdOf(b.sleep);
  z.sleep = clamp(raw.sleep, 0, 4);
  raw.ortho = orthoCount * D.thresholds.orthoZ;
  z.ortho = clamp(raw.ortho, 0, 4);
  const sz = (v.sbp - b.sbp.mean) / sdOf(b.sbp), dz = (v.dbp - b.dbp.mean) / sdOf(b.dbp);
  raw.bp = Math.abs(sz) >= Math.abs(dz) ? sz : dz;
  z.bp = clamp(Math.abs(raw.bp), 0, 4);
  return { raw, z };
}
function composite(z) { let c = 0; for (const k in D.weights) c += D.weights[k] * z[k]; return c; }
function mergeBase(over) {
  const b = JSON.parse(JSON.stringify(D.baseline));
  if (over) for (const k in over) b[k] = Object.assign({}, b[k], over[k]);
  return b;
}
function criticalVitals(v) {
  const c = D.critical, out = [];
  if (v.sbp >= c.sbpHigh) out.push("Systolic BP " + v.sbp + " ≥ " + c.sbpHigh);
  if (v.sbp <= c.sbpLow) out.push("Systolic BP " + v.sbp + " ≤ " + c.sbpLow);
  if (v.dbp >= c.dbpHigh) out.push("Diastolic BP " + v.dbp + " ≥ " + c.dbpHigh);
  if (v.dbp <= c.dbpLow) out.push("Diastolic BP " + v.dbp + " ≤ " + c.dbpLow);
  if (v.hr >= c.hrHigh) out.push("Resting HR " + v.hr + " ≥ " + c.hrHigh);
  if (v.hr <= c.hrLow) out.push("Resting HR " + v.hr + " ≤ " + c.hrLow);
  return out;
}
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const sg = (x) => (x >= 0 ? "+" : "−") + f1(Math.abs(x));
function buildFindings(v, b, zr, orthoCount, s) {
  const st = (z) => z >= D.thresholds.drift ? "drift" : z >= 0.75 ? "watch" : "ok";
  const names = []; if (s.dizzy) names.push("dizziness on standing"); if (s.palp) names.push("palpitations"); if (s.vision) names.push("vision greying");
  const rp = num(v.rpe) === null ? b.rpe.mean : v.rpe;
  return [
    { key: "hr", label: "Resting heart rate", state: st(zr.z.hr), z: zr.raw.hr, text: v.hr + " bpm vs baseline " + b.hr.mean + " ± " + b.hr.sd + " (" + sg(zr.raw.hr) + " SD, " + sg((v.hr - b.hr.mean) / b.hr.mean * 100) + "%)" },
    { key: "ex", label: "Exercise performance", state: st(zr.z.ex), z: zr.raw.ex, text: v.exMin + " min at RPE " + rp + " vs baseline " + b.exMin.mean + " min at RPE " + b.rpe.mean + " (" + sg((v.exMin - b.exMin.mean) / b.exMin.mean * 100) + "% duration)" },
    { key: "sleep", label: "Sleep", state: st(zr.z.sleep), z: zr.raw.sleep, text: v.sleep + " h vs baseline " + b.sleep.mean + " ± " + b.sleep.sd + " h (debt " + f1(Math.max(0, b.sleep.mean - v.sleep)) + " h)" },
    { key: "ortho", label: "Orthostatic symptoms", state: st(zr.z.ortho), z: zr.raw.ortho, text: orthoCount ? orthoCount + " reported: " + names.join(", ") : "None reported" },
    { key: "bp", label: "Blood pressure", state: st(zr.z.bp), z: zr.raw.bp, text: v.sbp + "/" + v.dbp + " vs baseline " + b.sbp.mean + "/" + b.dbp.mean + " mmHg (largest deviation " + sg(zr.raw.bp) + " SD)" }
  ];
}
function assess(inp, base, nowMs) {
  nowMs = nowMs || Date.now(); base = base || D.baseline;
  const q = validate(inp, nowMs), s = symptoms(inp), flags = redFlagsOf(s);
  const orthoCount = (s.dizzy ? 1 : 0) + (s.palp ? 1 : 0) + (s.vision ? 1 : 0);
  const res = { quality: q, symptoms: s, redFlags: flags, orthoCount, scored: !q.blocked, tier: "green", trigger: "", criticals: [], z: null, raw: null, contrib: null, composite: 0, drifting: [], findings: [], scoringBypassed: q.blocked };
  if (!q.blocked) {
    const v = { hr: num(inp.hr), sbp: num(inp.sbp), dbp: num(inp.dbp), sleep: num(inp.sleep), exMin: num(inp.exMin), rpe: num(inp.rpe) };
    const zr = zScores(v, base, orthoCount);
    res.z = zr.z; res.raw = zr.raw; res.composite = composite(zr.z);
    res.contrib = {}; for (const k in D.weights) res.contrib[k] = D.weights[k] * zr.z[k];
    res.drifting = Object.keys(zr.z).filter(k => zr.z[k] >= D.thresholds.drift);
    res.findings = buildFindings(v, base, zr, orthoCount, s);
    res.criticals = criticalVitals(v);
  }
  if (flags.length) { res.tier = "red"; res.trigger = "Red-flag symptom: " + flags.join("; "); }
  else if (q.blocked) { res.tier = "insufficient"; res.trigger = q.reasons.join(" · "); }
  else if (res.criticals.length) { res.tier = "red"; res.trigger = "Critical vital sign: " + res.criticals.join("; "); }
  else if (res.drifting.length >= 2 || res.composite >= D.thresholds.orangeComposite) { res.tier = "orange"; res.trigger = res.drifting.length + " indicators drifting"; }
  else if (res.drifting.length === 1 || res.composite >= D.thresholds.watch) { res.tier = "yellow"; res.trigger = res.drifting.length ? "1 indicator drifting" : "Combined mild drift"; }
  else { res.tier = "green"; res.trigger = "All indicators near personal baseline"; }
  return res;
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function buildHistory(inp, base, driftDays, days) {
  days = days || 10; driftDays = clamp(driftDays || 0, 0, days);
  const rnd = mulberry32(20261113), g = () => clamp((rnd() + rnd() + rnd() - 1.5) / 0.5, -1.2, 1.2) * 0.4;
  const t = { hr: num(inp.hr), sbp: num(inp.sbp), dbp: num(inp.dbp), sleep: num(inp.sleep), exMin: num(inp.exMin), rpe: num(inp.rpe) };
  const dev = (k, m) => (t[k] === null ? 0 : t[k] - m);
  const rows = [];
  for (let i = 0; i < days; i++) {
    const di = i - (days - driftDays);
    const f = di >= 0 ? Math.min(0.95, 0.55 + 0.12 * di) : 0;
    const r = {
      label: "D-" + (days - i),
      hr: base.hr.mean + g() * base.hr.sd + f * dev("hr", base.hr.mean),
      sbp: base.sbp.mean + g() * base.sbp.sd + f * dev("sbp", base.sbp.mean),
      dbp: base.dbp.mean + g() * base.dbp.sd + f * dev("dbp", base.dbp.mean),
      sleep: Math.max(0, base.sleep.mean + g() * base.sleep.sd + f * dev("sleep", base.sleep.mean)),
      exMin: Math.max(0, base.exMin.mean + g() * base.exMin.sd + f * dev("exMin", base.exMin.mean)),
      rpe: clamp(base.rpe.mean + g() * base.rpe.sd + f * (t.rpe === null ? 0 : t.rpe - base.rpe.mean), 1, 10)
    };
    r.score = composite(zScores(r, base, 0).z);
    rows.push(r);
  }
  return rows;
}
function persistence(rows, todayScore) {
  const thr = D.thresholds.watch; if (todayScore < thr) return 0;
  let n = 1; for (let i = rows.length - 1; i >= 0; i--) { if (rows[i].score >= thr) n++; else break; }
  return n;
}
function naiveTier(inp) {
  const hr = num(inp.hr) || 0, sbp = num(inp.sbp) || 0, sl = num(inp.sleep), s = symptoms(inp);
  if (s.chest || s.faint || s.sob || hr >= 120 || sbp >= 180) return "red";
  if (hr > 100 || sbp >= 160) return "orange";
  if (hr > 90 || sbp >= 140 || (sl !== null && sl < 6) || s.dizzy || s.palp || s.vision) return "yellow";
  return "green";
}
function caseInput(c, nowMs) {
  const o = Object.assign({}, c.inp);
  o.timestampMs = (c.ageH === null || c.ageH === undefined) ? null : nowMs - c.ageH * 3600000;
  return o;
}
function runSuite() {
  const now = Date.now();
  const rows = D.cases.map(c => {
    const inp = caseInput(c, now), a = assess(inp, mergeBase(c.base), now), n = naiveTier(inp);
    return { id: c.id, name: c.name, group: c.group, expected: c.expected, got: a.tier, naive: n, ok: a.tier === c.expected, naiveOk: n === c.expected && c.expected !== "insufficient" };
  });
  const alert = (t) => t !== "green" && t !== "insufficient";
  return { rows, total: rows.length, ok: rows.filter(r => r.ok).length, naiveOk: rows.filter(r => r.naiveOk).length,
    falseAlarmsAvoided: rows.filter(r => alert(r.naive) && (r.expected === "green" || r.expected === "insufficient")).length,
    refusals: rows.filter(r => r.expected === "insufficient" && r.got === "insufficient").length };
}
const API = { assess, buildHistory, persistence, naiveTier, runSuite, caseInput, mergeBase, num, symptoms };

if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
if (typeof document === "undefined") return;

/* =====================  USER INTERFACE  ===================== */
function UI() {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const COL = { green: "#10B981", yellow: "#F59E0B", orange: "#F97316", red: "#EF4444", insufficient: "#94a3b8", accent: "#6cb6e8" };
  const FIELDS = ["hr", "sbp", "dbp", "sleep", "exMin", "rpe"];
  const SYMS = ["dizzy", "palp", "vision", "chest", "faint", "sob"];
  const state = { mission: "leoShort", base: mergeBase(), lastTier: null, trendTab: "hr", evTab: "metabolic", cmp: "glucose", booted: false, bio: {}, caseId: null, last: null, hist: null };
  const hasChart = typeof Chart !== "undefined";
  if (hasChart) {
    Chart.defaults.color = "#8b97ab"; Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.font.size = 11.5; Chart.defaults.animation = { duration: 800, easing: "easeOutQuart" };
    Object.assign(Chart.defaults.plugins.tooltip, { backgroundColor: "rgba(10,14,23,.94)", borderColor: "rgba(148,163,184,.25)", borderWidth: 1, padding: 10, cornerRadius: 10 });
  }

  /* ---------- SOUND (Web Audio, no files) ---------- */
  const Sound = {
    ctx: null, on: true,
    ensure() { if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return false; this.ctx = new C(); } if (this.ctx.state === "suspended") this.ctx.resume(); return true; },
    tone(f, d, type, v, t0, glide) {
      if (!this.on || !this.ensure()) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (t0 || 0);
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
    },
    click() { this.tone(1500, 0.035, "square", 0.015); },
    boot() { this.tone(180, 0.9, "sine", 0.05, 0, 720); this.tone(540, 0.5, "triangle", 0.03, 0.55, 1080); },
    tier(t) {
      if (t === "green") { [523, 659, 784].forEach((f, i) => this.tone(f, 0.28, "sine", 0.05, i * 0.1)); }
      else if (t === "yellow") { this.tone(440, 0.22, "triangle", 0.06, 0); this.tone(440, 0.22, "triangle", 0.06, 0.28); }
      else if (t === "orange") { for (let i = 0; i < 3; i++) this.tone(620, 0.14, "square", 0.035, i * 0.22); }
      else if (t === "red") { for (let i = 0; i < 4; i++) { this.tone(880, 0.16, "sawtooth", 0.045, i * 0.3); this.tone(660, 0.14, "sawtooth", 0.045, i * 0.3 + 0.15); } }
      else { this.tone(330, 0.3, "sine", 0.05, 0, 247); this.tone(247, 0.4, "sine", 0.05, 0.28, 180); }
    }
  };
  try { if (localStorage.getItem("cc_sound") === "off") Sound.on = false; } catch (e) {}
  function paintSound() { $("soundTxt").textContent = Sound.on ? "Sound on" : "Sound off"; $("soundIco").textContent = Sound.on ? "♪" : "–"; $("soundBtn").setAttribute("aria-pressed", Sound.on); }
  $("soundBtn").onclick = () => { Sound.on = !Sound.on; try { localStorage.setItem("cc_sound", Sound.on ? "on" : "off"); } catch (e) {} paintSound(); if (Sound.on) Sound.click(); };
  paintSound();
  document.addEventListener("click", (e) => { if (state.booted && e.target.closest("button,.chip,.sym,.tab")) Sound.click(); });

  /* ---------- BACKGROUND, CLOCK, REVEAL ---------- */
  (function stars() {
    const cv = $("stars"), x = cv.getContext("2d"); let w, h, S = [];
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function size() { w = cv.width = innerWidth; h = cv.height = innerHeight; S = Array.from({ length: Math.round(w * h / 9000) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + .2, p: Math.random() * 6.28, s: Math.random() * .02 + .005, v: Math.random() * .06 + .01 })); }
    function draw() { x.clearRect(0, 0, w, h); S.forEach(s => { s.p += s.s; s.y += s.v; if (s.y > h) { s.y = 0; s.x = Math.random() * w; } x.globalAlpha = .25 + .55 * Math.abs(Math.sin(s.p)); x.fillStyle = "#cfe3ff"; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.28); x.fill(); }); if (!still) requestAnimationFrame(draw); }
    size(); draw(); addEventListener("resize", size);
  })();
  setInterval(() => { $("clock").textContent = new Date().toISOString().slice(11, 19) + " UTC"; }, 1000);
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08 });
  const observeReveals = () => document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));

  /* ---------- BOOT ---------- */
  (function boot() {
    const lines = ["Loading OSD-575 benchmarks · 4 crew · 7 timepoints", "Loading HRP cardiovascular risk ratings", "Initialising personal-baseline drift engine", "Arming data-quality guard (stale, missing, conflicting)", "Offline-first core ready"];
    let i = 0; const box = $("bootLines");
    const tick = () => {
      if (i < lines.length) { const d = document.createElement("div"); d.className = "bootline"; d.textContent = "› " + lines[i]; box.appendChild(d); i++; $("bootBar").style.width = (i / lines.length * 100) + "%"; setTimeout(tick, 380); }
      else { $("enterBtn").classList.remove("hidden"); $("enterBtn").focus(); }
    };
    setTimeout(tick, 300);
    const enter = () => { if (state.booted) return; state.booted = true; Sound.boot(); $("boot").classList.add("off"); setTimeout(() => $("boot").remove(), 800); };
    $("enterBtn").onclick = enter; addEventListener("keydown", (e) => { if (e.key === "Enter" && !$("enterBtn").classList.contains("hidden")) enter(); });
  })();

  /* ---------- COUNT-UP ---------- */
  function countTo(el, to, dec, dur) {
    const from = parseFloat(el.dataset.v) || 0; el.dataset.v = to; const tok = (el._t = (el._t || 0) + 1), t0 = performance.now(); dur = dur || 700;
    (function step(t) { if (el._t !== tok) return; const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = (from + (to - from) * e).toFixed(dec); if (p < 1) requestAnimationFrame(step); })(t0);
  }

  /* ---------- SCENARIOS + MISSION + BASELINE ---------- */
  const SC = [["normal", "Test 1: Normal Baseline", "var(--green)"], ["stale", "Test 2: Stale Data Error", "#94a3b8"], ["yellow", "Test 3: Sleep & HR Drift (Yellow)", "var(--yellow)"], ["red", "Test 4: Orthostatic Emergency (Red)", "var(--red)"], ["orange", "Test 5: Compounding Drift (Orange)", "var(--orange)"], ["conflict", "Test 6: Conflicting Input", "#94a3b8"]];
  $("scenarioBtns").innerHTML = SC.map((s, i) => `<button class="chip" data-case="${s[0]}" style="--c:${s[2]}"><span class="pip"></span><kbd>${i + 1}</kbd>${s[1]}</button>`).join("");
  $("scenarioBtns").addEventListener("click", (e) => { const b = e.target.closest("[data-case]"); if (b) loadCase(b.dataset.case, true); });
  addEventListener("keydown", (e) => {
    if (!state.booted || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const i = parseInt(e.key, 10);
    if (i >= 1 && i <= SC.length) loadCase(SC[i - 1][0], true);
  });

  $("missionPills").innerHTML = Object.keys(D.missions).map(k => `<button class="chip" data-m="${k}">${D.missions[k].label}</button>`).join("");
  $("missionPills").addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) { state.mission = b.dataset.m; renderMission(); } });
  function renderMission() {
    const m = D.missions[state.mission];
    document.querySelectorAll("#missionPills .chip").forEach(c => c.classList.toggle("active", c.dataset.m === state.mission));
    $("missionCard").innerHTML = `<div class="qbox"><div class="lbl">NASA HRP risk rating · operations</div><div class="mono" style="font-size:14px">${m.ops}</div><div class="lbl mt-3">Long-term health</div><div class="mono" style="font-size:14px">${m.lt}</div></div>
      <div class="qbox"><div class="lbl">What it means for monitoring</div><p class="muted" style="font-size:13px;line-height:1.6">${m.text}</p><p class="dim mt-2" style="font-size:12px;line-height:1.5">${m.autonomy}</p></div>
      <div class="dim sm:col-span-2" style="font-size:11px">Source: ${D.missionSource}</div>`;
  }
  const BL = [["hr", "Resting HR (bpm)"], ["sbp", "Systolic BP (mmHg)"], ["dbp", "Diastolic BP (mmHg)"], ["sleep", "Sleep (h)"], ["exMin", "Exercise (min)"], ["rpe", "RPE (1–10)"]];
  function renderBaseline() {
    $("baseBody").innerHTML = BL.map(([k, l]) => `<tr><td>${l}</td><td><input class="inp" style="padding:6px 8px" type="number" step="0.1" data-b="${k}.mean" value="${state.base[k].mean}"></td><td><input class="inp" style="padding:6px 8px" type="number" step="0.1" min="0.1" data-b="${k}.sd" value="${state.base[k].sd}"></td></tr>`).join("");
  }
  $("baseBody").addEventListener("input", (e) => { const t = e.target.dataset.b; if (!t) return; const [k, f] = t.split("."); const v = parseFloat(e.target.value); if (isFinite(v)) { state.base[k][f] = v; schedule(); } });

  /* ---------- INPUT PLUMBING ---------- */
  const toLocal = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  function setValues(o) {
    FIELDS.forEach(k => { const v = o[k]; $(k).value = (v === undefined || v === null) ? "" : v; if (v !== "" && v !== undefined && v !== null) $(k + "_r").value = v; });
    SYMS.forEach(k => $("sym_" + k).checked = (o.sym || []).indexOf(k) > -1);
  }
  function setAge(ageH) { $("ts").value = (ageH === null || ageH === undefined) ? "" : toLocal(Date.now() - ageH * 3600000); }
  function readInputs() {
    const o = { sym: SYMS.filter(k => $("sym_" + k).checked) };
    FIELDS.forEach(k => o[k] = $(k).value);
    const t = $("ts").value, ms = t ? new Date(t).getTime() : null; o.timestampMs = (ms !== null && isFinite(ms)) ? ms : null; return o;
  }
  function loadCase(id, sound) {
    const c = D.cases.find(x => x.id === id); if (!c) return; state.caseId = id;
    state.base = mergeBase(c.base); renderBaseline(); setValues(c.inp); setAge(c.ageH);
    $("drift").value = c.drift || 0; $("driftVal").textContent = c.drift || 0; recalc(sound ? "force" : false);
    document.querySelectorAll("#scenarioBtns .chip").forEach(b => b.classList.toggle("active", b.dataset.case === id));
  }
  function resetAll() { state.base = mergeBase(); renderBaseline(); setValues(D.defaults); setAge(D.defaults.ageH); $("drift").value = 0; $("driftVal").textContent = 0; state.caseId = null; document.querySelectorAll("#scenarioBtns .chip").forEach(b => b.classList.remove("active")); recalc("force"); }
  FIELDS.forEach(k => {
    $(k).addEventListener("input", () => { const v = $(k).value; if (v !== "") $(k + "_r").value = v; manual(); });
    $(k + "_r").addEventListener("input", () => { $(k).value = $(k + "_r").value; manual(); });
  });
  SYMS.forEach(k => $("sym_" + k).addEventListener("change", manual));
  $("ts").addEventListener("input", manual);
  $("drift").addEventListener("input", () => { $("driftVal").textContent = $("drift").value; manual(); });
  $("syncNow").onclick = () => { setAge(0); manual(); };
  $("resetBtn").onclick = resetAll;
  function manual() { state.caseId = null; document.querySelectorAll("#scenarioBtns .chip").forEach(b => b.classList.remove("active")); schedule(); }
  let pending = false; function schedule() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; recalc(); }); }

  /* ---------- CORE RECALC ---------- */
  function recalc(force) {
    const inp = readInputs(), a = assess(inp, state.base, Date.now());
    const hist = buildHistory(inp, state.base, parseInt($("drift").value, 10) || 0);
    a.persistence = a.scored ? persistence(hist, a.composite) : 0;
    state.last = { inp, a, hist };
    try { localStorage.setItem("cc_last", JSON.stringify({ tier: a.tier, drifting: a.drifting })); } catch (e) {}
    renderLive(a); renderQuality(a); renderDecision(a); renderCharts(inp, a, hist); if (state.evTab === "bp") refreshBP();
    if (a.tier !== state.lastTier || force === "force") { if (state.booted && state.lastTier !== null || force === "force") Sound.tier(a.tier); state.lastTier = a.tier; }
  }

  function renderLive(a) {
    const T = D.tiers[a.tier]; document.body.dataset.tier = a.tier;
    $("tierName").textContent = T.tag; $("tierBadge").classList.toggle("pulse", a.tier === "red" || a.tier === "orange");
    $("tierHeadline").textContent = T.name + " · " + T.meaning; $("tierAction").textContent = T.action;
    const val = a.scored ? a.composite : 0; $("gaugeFg").style.strokeDashoffset = 251.33 * (1 - Math.min(val, 2.5) / 2.5);
    if (a.scored) countTo($("gaugeVal"), val, 2); else { $("gaugeVal").dataset.v = 0; $("gaugeVal").textContent = "—"; }
    $("liveTag").textContent = a.scored ? "scoring active" : "scoring bypassed";
    $("kDrift").textContent = a.scored ? a.drifting.length : "–"; $("kDays").textContent = a.scored ? a.persistence : "–";
    $("kAge").textContent = a.quality.ageH === null ? "–" : (a.quality.ageH < 0 ? "future" : a.quality.ageH.toFixed(1));
    $("ageReadout").textContent = a.quality.ageH === null ? "no timestamp" : (a.quality.ageH < 0 ? "timestamp in future" : "data age " + a.quality.ageH.toFixed(1) + " h");
    FIELDS.forEach(k => { const v = parseFloat($(k).value), f = D.required.find(r => r.key === k); $(k).classList.toggle("err", !!f && $(k).value !== "" && (v < f.min || v > f.max)); });
  }
  (function ticks() { const g = $("gaugeTicks"); let h = ""; [D.thresholds.watch, D.thresholds.orangeComposite].forEach(t => { const th = Math.PI - Math.PI * (t / 2.5), c = Math.cos(th), s = Math.sin(th); h += `<line x1="${100 + 68 * c}" y1="${100 - 68 * s}" x2="${100 + 92 * c}" y2="${100 - 92 * s}"/>`; }); g.innerHTML = h; })();

  function renderQuality(a) {
    const q = a.quality, set = (id, ok, html) => { const el = $(id); el.dataset.s = ok ? "ok" : "bad"; el.innerHTML = html; };
    set("qComp", q.missing.length === 0 && !q.noTs, `<div class="lbl">Completeness</div><div class="kpi" style="font-size:20px">${q.present}/${q.total}</div><div class="bar my-2"><i style="width:${q.completeness * 100}%"></i></div><div class="dim" style="font-size:11.5px">${q.missing.length ? "Missing: " + q.missing.join(", ") : q.noTs ? "No timestamp" : "All critical fields present"}</div>`);
    const fresh = !q.noTs && !q.stale && q.ageH >= -0.1;
    set("qFresh", fresh, `<div class="lbl">Freshness</div><div class="kpi" style="font-size:20px">${q.ageH === null ? "–" : Math.max(q.ageH, 0).toFixed(1) + " h"}</div><div class="bar my-2"><i style="width:${q.ageH === null ? 0 : Math.min(100, Math.max(0, q.ageH) / D.staleHours * 100)}%;background:${fresh ? "var(--accent)" : "var(--red)"}"></i></div><div class="dim" style="font-size:11.5px">Limit ${D.staleHours} h <span class="tag assume" style="margin-left:4px">ASSUMPTION</span></div>`);
    const bad = q.implausible.concat(q.conflicts);
    set("qPlaus", bad.length === 0, `<div class="lbl">Consistency</div><div class="kpi" style="font-size:20px">${bad.length ? bad.length + " issue" + (bad.length > 1 ? "s" : "") : "OK"}</div><div class="dim mt-2" style="font-size:11.5px">${bad.length ? bad.join("; ") : "Values plausible and consistent"}</div>`);
    set("qScoring", a.scored, `<div class="lbl">Drift scoring</div><div class="kpi" style="font-size:20px">${a.scored ? "ACTIVE" : "BYPASSED"}</div><div class="dim mt-2" style="font-size:11.5px">${a.scored ? "Baseline drift can be assessed" : "Baseline drift cannot be assessed safely"}</div>`);
    const b = $("qBanner");
    if (q.blocked) {
      b.classList.remove("hidden");
      b.innerHTML = `<div class="font-semibold" style="color:#fecaca">Insufficient Data / Stale Telemetry — Baseline Drift Cannot Be Assessed Safely.</div><div class="muted mt-1" style="font-size:13px">${q.reasons.join(" · ")}${a.redFlags.length ? "<br><b style='color:#fca5a5'>Reported symptoms still trigger the emergency protocol below.</b>" : ""}</div>`;
    } else b.classList.add("hidden");
    const w = $("watchBanner");
    if (a.scored && (a.tier === "yellow" || a.tier === "orange") && a.persistence >= D.thresholds.persistDays) {
      w.classList.remove("hidden"); w.innerHTML = `<div class="font-semibold" style="color:#fde68a">Cardiovascular Deconditioning Watch</div><div class="muted mt-1" style="font-size:13px">Drift score at or above Watch level for ${a.persistence} consecutive days (rule: ${D.thresholds.persistDays}+ days, team assumption). Review with crew medical support.</div>`;
    } else w.classList.add("hidden");
  }

  (function tierCards() {
    $("tierCards").innerHTML = ["green", "yellow", "orange", "red"].map(k => { const T = D.tiers[k]; return `<div class="tcard" data-tier="${k}" id="tc_${k}"><div class="flex items-center gap-2"><span class="dot"></span><span class="mono" style="font-size:12px;letter-spacing:.1em;color:var(--t)">${T.tag}</span></div><div class="font-semibold mt-2">${T.name}</div><p class="muted mt-1" style="font-size:12.5px">${T.meaning}</p><p class="mt-3" style="font-size:13px;line-height:1.55">${T.action}</p></div>`; }).join("");
  })();

  /* ---------- LEARN LINKS (smart integration with learn.html) ---------- */
  const LEARN = {
    hr:    { href: "learn.html#cardio",  text: "Learn why heart rate drifts in space →" },
    sleep: { href: "learn.html#sleep",   text: "Learn why sleep affects your heart →" },
    ex:    { href: "learn.html#fitness", text: "Learn why fitness declines in space →" },
    ortho: { href: "learn.html#cardio",  text: "Learn about orthostatic intolerance →" },
    bp:    { href: "learn.html#fluid",   text: "Learn how fluid shift changes blood pressure →" }
  };
  function renderLearn(a) {
    const wrap = $("learnWrap"), box = $("learnLinks"), seen = {}, items = [];
    if (a.scored) a.findings.filter(f => f.state !== "ok").forEach(f => { const L = LEARN[f.key]; if (L && !seen[L.href]) { seen[L.href] = 1; items.push(L); } });
    if (a.tier === "red" && !items.length) items.push({ href: "learn.html#cardio", text: "Learn about orthostatic intolerance →" });
    if (!items.length) { wrap.classList.add("hidden"); box.innerHTML = ""; return; }
    wrap.classList.remove("hidden");
    box.innerHTML = items.map(L => `<a class="btn no-underline" style="color:var(--text);text-align:left" href="${L.href}">${L.text}</a>`).join("");
  }

  function renderDecision(a) {
    const T = D.tiers[a.tier];
    ["green", "yellow", "orange", "red"].forEach(k => { const el = $("tc_" + k); el.classList.toggle("active", a.tier === k); el.classList.toggle("alert", a.tier === k && (k === "orange" || k === "red")); });
    $("whyTrigger").textContent = a.trigger;
    $("findings").innerHTML = a.scored ? a.findings.map(f => `<tr class="row"><td><span class="st ${f.state}"></span>${f.label}</td><td class="muted">${f.text}</td><td class="mono">${(f.z >= 0 ? "+" : "−") + Math.abs(f.z).toFixed(1)}</td></tr>`).join("") : `<tr><td colspan="3" class="muted">Scoring bypassed. No indicator comparison is shown because the data cannot be trusted.</td></tr>`;
    const q = a.quality;
    $("durBox").innerHTML = (a.scored ? `Duration: ${a.persistence} consecutive day(s) at Watch level or above (incl. today) · composite ${a.composite.toFixed(2)} SD<br>` : "") + `Data check: ${q.present}/${q.total} fields · ${q.ageH === null ? "age unknown" : Math.max(q.ageH, 0).toFixed(1) + " h old"} · ${q.blocked ? "NOT reliable" : "complete and recent"}`;
    let c = "";
    if (a.scored) { a.findings.filter(f => f.state !== "ok").forEach(f => c += `<div class="mb-2"><span class="st ${f.state}"></span><b style="color:var(--text)">${f.label}:</b> ${D.contributors[f.key]}</div>`); if (!c) c = "No indicator is currently drifting."; }
    else c = a.redFlags.length ? "Symptom-led alert. Contributors are not assessed." : "Not assessed. Re-measure and re-sync first.";
    $("contrib").innerHTML = c; $("nxNow").textContent = T.next.now; $("nxRepeat").textContent = T.next.repeat; $("nxContact").textContent = T.next.contact;
    renderLearn(a);
  }

  /* ---------- CHARTS ---------- */
  let trend = null, contrib = null;
  const TR = { hr: ["Resting HR", ["hr"], "bpm"], bp: ["Blood pressure", ["sbp", "dbp"], "mmHg"], sleep: ["Sleep", ["sleep"], "h"], ex: ["Exercise", ["exMin"], "min"] };
  $("trendTabs").innerHTML = Object.keys(TR).map(k => `<button class="chip" data-t="${k}">${TR[k][0]}</button>`).join("");
  $("trendTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) { state.trendTab = b.dataset.t; if (trend) { trend.destroy(); trend = null; } if (state.last) renderCharts(state.last.inp, state.last.a, state.last.hist); } });
  const gridC = "rgba(148,163,184,.1)";
  function renderCharts(inp, a, hist) {
    if (!hasChart) return;
    document.querySelectorAll("#trendTabs .chip").forEach(c => c.classList.toggle("active", c.dataset.t === state.trendTab));
    const tab = TR[state.trendTab], labels = hist.map(r => r.label).concat("Today"), tc = COL[a.tier];
    const ds = [], k0 = tab[1][0], b0 = state.base[k0], n = labels.length;
    ds.push({ label: "+2 SD", data: Array(n).fill(b0.mean + 2 * b0.sd), borderColor: "rgba(148,163,184,.25)", borderWidth: 1, pointRadius: 0, fill: false, borderDash: [3, 3] });
    ds.push({ label: "−2 SD", data: Array(n).fill(b0.mean - 2 * b0.sd), borderColor: "rgba(148,163,184,.25)", borderWidth: 1, pointRadius: 0, fill: "-1", backgroundColor: "rgba(108,182,232,.07)", borderDash: [3, 3] });
    ds.push({ label: "Baseline mean", data: Array(n).fill(b0.mean), borderColor: "rgba(230,234,242,.5)", borderWidth: 1.2, pointRadius: 0, borderDash: [6, 4] });
    tab[1].forEach((k, i) => {
      const today = inp[k] === "" ? null : parseFloat(inp[k]), data = hist.map(r => +r[k].toFixed(1)).concat(today);
      const col = i === 0 ? COL.accent : "#a78bfa";
      ds.push({ label: (k === "sbp" ? "Systolic" : k === "dbp" ? "Diastolic" : tab[0]), data, borderColor: col, backgroundColor: col, borderWidth: 2.2, tension: .35, pointRadius: data.map((_, j) => j === n - 1 ? 7 : 3), pointBackgroundColor: data.map((_, j) => j === n - 1 ? tc : col), pointBorderColor: "#0a0e17", spanGaps: false });
    });
    if (!trend) trend = new Chart($("trendChart"), { type: "line", data: { labels, datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8, filter: (i) => i.text.indexOf("SD") < 0 } } }, scales: { x: { grid: { color: gridC } }, y: { grid: { color: gridC }, title: { display: true, text: tab[2] } } } } });
    else { trend.data.labels = labels; trend.data.datasets = ds; trend.update(); }
    const names = ["Resting HR", "Exercise", "Sleep", "Orthostatic", "BP"], keys = ["hr", "ex", "sleep", "ortho", "bp"];
    const vals = keys.map(k => a.scored ? +a.contrib[k].toFixed(3) : 0), cols = keys.map(k => a.scored && a.z[k] >= D.thresholds.drift ? COL.orange : "rgba(108,182,232,.75)");
    if (!contrib) contrib = new Chart($("contribChart"), { type: "bar", data: { labels: names, datasets: [{ data: vals, backgroundColor: cols, borderRadius: 6, barThickness: 22 }] }, options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => "contribution " + c.parsed.x.toFixed(2) + " · weight " + Math.round(D.weights[keys[c.dataIndex]] * 100) + "%" } } }, scales: { x: { min: 0, max: 1, grid: { color: gridC } }, y: { grid: { display: false } } } } });
    else { contrib.data.datasets[0].data = vals; contrib.data.datasets[0].backgroundColor = cols; contrib.update(); }
  }

  /* ---------- EVIDENCE EXPLORER ---------- */
  const EV = [["metabolic", "OSD-575 metabolic"], ["bp", "Blood pressure"], ["hazards", "HRP hazards"], ["terr", "Terrestrial context"], ["sources", "Sources & metadata"]];
  $("evTabs").innerHTML = EV.map(e => `<button class="tab" data-e="${e[0]}">${e[1]}</button>`).join("");
  $("evTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-e]"); if (b) { state.evTab = b.dataset.e; renderEvidence(); } });
  let evChart = null;
  const tagHtml = (c, t) => `<span class="tag ${c}">${t}</span>`;
  function renderEvidence() {
    document.querySelectorAll("#evTabs .tab").forEach(t => t.classList.toggle("active", t.dataset.e === state.evTab));
    if (evChart) { evChart.destroy(); evChart = null; }
    const body = $("evBody"), O = D.osd575; let h = "";
    if (state.evTab === "metabolic") {
      h = `<div class="flex flex-wrap items-center gap-2 mb-4">${tagHtml("nasa", "NASA MEASURED")}<span class="muted" style="font-size:12.5px">${O.id} · ${O.mission} · ${O.crew}</span></div>
      <div id="cmpPills" class="flex flex-wrap gap-2 mb-4">${Object.keys(D.cmp).filter(k => k !== "n").map(k => `<button class="chip ${k === state.cmp ? "active" : ""}" data-c="${k}">${D.cmp[k].label}</button>`).join("")}</div>
      <div style="height:280px"><canvas id="cmpChart"></canvas></div><p id="cmpNote" class="mt-3" style="font-size:12.5px;color:var(--yellow)"></p>
      <div class="mt-5 overflow-x-auto"><table class="t"><thead><tr><th>Analyte</th><th>Quest range</th><th>Pre-flight mean ± SD</th><th>R+1 mean</th><th>Your value (optional)</th><th>Status</th></tr></thead><tbody>${Object.keys(D.cmp).filter(k => k !== "n").map(k => { const c = D.cmp[k]; return `<tr class="row"><td>${c.label}<div class="dim" style="font-size:11px">${c.unit}</div></td><td class="mono">${c.min}–${c.max}</td><td class="mono">${c.preMean} ± ${c.preSd}</td><td class="mono">${c.tp["R+1"]}</td><td><input class="inp" style="max-width:110px;padding:6px 8px" type="number" step="any" data-bio="${k}" value="${state.bio[k] || ""}"></td><td id="bs_${k}" class="muted"></td></tr>`; }).join("")}</tbody></table></div>
      <p class="dim mt-3" style="font-size:11.5px;line-height:1.6">${D.cmp.n} Optional context only; these values do not enter the drift score.<br><b>Metadata source:</b> NASA OSDR ${O.id} · a_OSD-575_analytical-chemistry_comprehensive-metabolic-panel_quest diagnostics.txt · LSDS-8_Comprehensive_Metabolic_Panel_CMP_upload_SUBMITTED.csv · DOI ${O.doi}</p>`;
      body.innerHTML = h; drawCmp(); Object.keys(D.cmp).forEach(k => k !== "n" && bioStatus(k));
    } else if (state.evTab === "bp") {
      const B = D.bp, r = (x) => `<tr class="row"><td>${x[0]}</td><td class="mono">${x[1].sbp}</td><td class="mono">${x[1].dbp}</td><td class="mono dim">${x[1].nS} / ${x[1].nD}</td></tr>`;
      h = `<div class="flex items-center gap-2 mb-4">${tagHtml("analog", "ANALOG LITERATURE")}<span class="muted" style="font-size:12.5px">${B.file} · ${B.rows} study rows</span></div>
      <div style="height:280px"><canvas id="bpChart"></canvas></div>
      <div class="mt-5 overflow-x-auto"><table class="t"><thead><tr><th>Phase</th><th>SBP</th><th>DBP</th><th>n (SBP / DBP)</th></tr></thead><tbody>${r(["Pre-flight / pre-test", B.pre])}${r(["In-flight / during test", B.inflight])}${r(["Post-flight / post-test", B.post])}<tr class="row"><td>Team reference band ${tagHtml("assume", "ASSUMPTION")}</td><td class="mono">${B.band.sbp.join("–")}</td><td class="mono">${B.band.dbp.join("–")}</td><td></td></tr></tbody></table></div>
      <p class="dim mt-3" style="font-size:11.5px;line-height:1.6">${B.note}<br><b>Metadata source:</b> ${B.file} (sources include ISS, STS, Soyuz, head-down tilt bed rest and lab studies).</p>`;
      body.innerHTML = h; drawBP();
    } else if (state.evTab === "hazards") {
      h = `<div class="flex items-center gap-2 mb-4">${tagHtml("nasa", "NASA HRP ROADMAP")}<span class="muted" style="font-size:12.5px">Mechanisms behind the indicators CrewCheck tracks</span></div><div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">${D.hazards.map(x => `<div class="qbox"><div class="flex items-center justify-between"><div class="font-medium" style="font-size:14px">${x.title}</div><span class="tag nasa">[${x.tag}]</span></div><p class="muted mt-2" style="font-size:12.5px;line-height:1.6">${x.body}</p><p class="mt-3 mono" style="font-size:11px;color:var(--accent)">${x.ind}</p></div>`).join("")}</div>
      <p class="dim mt-4" style="font-size:11.5px">Source: HRP Roadmap pages for the Cardiovascular, Muscle &amp; Aerobic Fitness, Sleep and Medical Conditions risks. These pages hold no numeric alert thresholds. <a class="lnk" href="learn.html">Read the plain-language version →</a></p>`;
      body.innerHTML = h;
    } else if (state.evTab === "terr") {
      const F = D.framingham;
      h = `<div class="flex items-center gap-2 mb-4">${tagHtml("terr", "TERRESTRIAL · NON-NASA")}<span class="muted" style="font-size:12.5px">Framingham Heart Study dataset (Kaggle) · n = ${F.n.toLocaleString()}</span></div>
      <div class="overflow-x-auto"><table class="t"><thead><tr><th>Measure</th><th>All</th><th>No 10-yr CHD</th><th>10-yr CHD</th></tr></thead><tbody>
      <tr class="row"><td>Systolic BP (mmHg)</td><td class="mono">${F.sbp}</td><td class="mono">${F.noChd.sbp}</td><td class="mono">${F.chd.sbp}</td></tr>
      <tr class="row"><td>Diastolic BP (mmHg)</td><td class="mono">${F.dbp}</td><td class="mono">${F.noChd.dbp}</td><td class="mono">${F.chd.dbp}</td></tr>
      <tr class="row"><td>Heart rate (bpm)</td><td class="mono">${F.hr}</td><td class="mono">${F.noChd.hr}</td><td class="mono">${F.chd.hr}</td></tr></tbody></table></div>
      <p class="muted mt-4" style="font-size:13px;line-height:1.6;max-width:760px">${F.note}</p><p class="dim mt-2" style="font-size:11.5px"><b>Metadata source:</b> framingham.csv (Kaggle Framingham Heart Study dataset). Astronauts are pre-screened, so terrestrial event models are context, not a predictor here.</p>`;
      body.innerHTML = h;
    } else {
      const rowsMeta = [["Study", O.id + " · " + O.title], ["Mission", O.mission], ["Crew", O.crew], ["Specimen", O.specimen], ["Laboratory", O.lab], ["Timepoints", O.timepoints.join(", ")], ["Principal investigator", O.pi], ["Submitted / released", O.submitted + " / " + O.released], ["Funding", O.funding], ["DOI", O.doi], ["Publications", O.pubs.join(" · ")]];
      h = `<div class="grid lg:grid-cols-2 gap-5">
      <div><div class="flex items-center gap-2 mb-3">${tagHtml("nasa", "NASA SOURCES")}</div>
        <div class="qbox mb-3"><div class="font-medium">NASA OSDR · ${O.id} (SpaceX Inspiration4)</div><p class="muted mt-1" style="font-size:12.5px;line-height:1.6">Pre-flight (L-92, L-44, L-3) and post-flight (R+1, R+45, R+82, R+194) serum Comprehensive Metabolic Panel metrics and cytokine panels. Used here for metabolic benchmarks.</p><a class="lnk" style="font-size:12.5px" href="${O.link}" target="_blank" rel="noopener">OSDR mission portal</a></div>
        <div class="qbox"><div class="font-medium">NASA HRP Integrated Roadmap &amp; risk pages</div><p class="muted mt-1" style="font-size:12.5px;line-height:1.6">Cardiovascular, Muscle &amp; Aerobic Fitness, Sleep and Medical Conditions risks. Used for mission risk ratings and hazard mechanisms. The separate HRP Evidence Report was not ingested.</p><a class="lnk" style="font-size:12.5px" href="https://lsda.jsc.nasa.gov/" target="_blank" rel="noopener">NASA Life Sciences Data Archive</a></div>
        <div class="flex items-center gap-2 mt-5 mb-3">${tagHtml("analog", "NON-NASA SUPPORTING DATA")}</div>
        <div class="qbox mb-3"><div class="font-medium">Cleaned numeric BP / bed-rest analog dataset</div><p class="muted mt-1" style="font-size:12.5px;line-height:1.6">Values extracted from published flight, bed-rest and lab studies (${D.bp.file}).</p></div>
        <div class="qbox"><div class="font-medium">Framingham Heart Study (Kaggle)</div><p class="muted mt-1" style="font-size:12.5px;line-height:1.6">Terrestrial context only, never in the drift score.</p></div></div>
      <div><div class="flex items-center gap-2 mb-3">${tagHtml("nasa", "OSD-575 METADATA")}</div>
        <table class="t"><tbody>${rowsMeta.map(r => `<tr class="row"><td class="muted" style="width:34%">${r[0]}</td><td style="font-size:12.5px;word-break:break-word">${r[1]}</td></tr>`).join("")}</tbody></table>
        <div class="lbl mt-4">Files reviewed</div><div class="dim mono" style="font-size:11px;line-height:1.8">${O.files.join("<br>")}</div>
        <p class="dim mt-2" style="font-size:11.5px">Cytokine panels (Eve HD71, HDCVD9, Alamar) were reviewed and left out of the engine because they do not improve the daily cardiovascular decision.</p></div></div>
      <div class="mt-6"><div class="flex items-center gap-2 mb-3">${tagHtml("assume", "TEAM ASSUMPTIONS · NOT NASA-DERIVED")}</div><ul class="muted" style="font-size:12.5px;line-height:1.8;padding-left:18px;list-style:disc">${D.assumptions.map(x => `<li>${x}</li>`).join("")}</ul></div>
      <div class="mt-5 dim" style="font-size:11.5px;line-height:1.7"><b>Provenance tags:</b> ${tagHtml("nasa", "NASA MEASURED")} ${tagHtml("analog", "ANALOG LITERATURE")} ${tagHtml("terr", "TERRESTRIAL")} ${tagHtml("assume", "ASSUMPTION")}<br><b>Use of AI:</b> code drafted with Claude (Anthropic); engine logic, weights and thresholds were specified by the team and are documented above.</div>`;
      body.innerHTML = h;
    }
  }
  function drawCmp() {
    if (!hasChart || !$("cmpChart")) return; const c = D.cmp[state.cmp], tps = D.osd575.timepoints, n = tps.length;
    $("cmpNote").textContent = c.note;
    const ds = [
      { label: "Crew mean (n=4)", data: tps.map(t => c.tp[t]), borderColor: COL.accent, backgroundColor: COL.accent, borderWidth: 2.4, tension: .3, pointRadius: tps.map(t => t[0] === "R" ? 6 : 4), pointStyle: tps.map(t => t[0] === "R" ? "rectRot" : "circle") },
      { label: "Quest range max", data: Array(n).fill(c.max), borderColor: "rgba(239,68,68,.55)", borderDash: [5, 4], borderWidth: 1.3, pointRadius: 0 },
      { label: "Quest range min", data: Array(n).fill(c.min), borderColor: "rgba(239,68,68,.55)", borderDash: [5, 4], borderWidth: 1.3, pointRadius: 0 },
      { label: "Pre-flight mean", data: Array(n).fill(c.preMean), borderColor: "rgba(16,185,129,.7)", borderDash: [2, 3], borderWidth: 1.3, pointRadius: 0 }];
    if (state.bio[state.cmp]) ds.push({ label: "Your value", data: Array(n).fill(parseFloat(state.bio[state.cmp])), borderColor: COL.orange, borderWidth: 1.6, borderDash: [8, 3], pointRadius: 0 });
    evChart = new Chart($("cmpChart"), { type: "line", data: { labels: tps, datasets: ds }, options: { maintainAspectRatio: false, plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { title: (i) => i[0].label + (i[0].label[0] === "L" ? " · pre-flight" : " · post-flight") } } }, scales: { x: { grid: { color: gridC } }, y: { grid: { color: gridC }, title: { display: true, text: c.label + " (" + c.unit + ")" } } } } });
  }
  function bioStatus(k) {
    const el = $("bs_" + k); if (!el) return; const c = D.cmp[k], v = parseFloat(state.bio[k]);
    if (!isFinite(v)) { el.innerHTML = "—"; return; }
    if (v < c.min || v > c.max) el.innerHTML = `<span style="color:var(--red)">Outside Quest range</span>`;
    else if (Math.abs(v - c.preMean) > 2 * c.preSd) el.innerHTML = `<span style="color:var(--yellow)">In range, beyond pre-flight ±2 SD</span>`;
    else el.innerHTML = `<span style="color:var(--green)">Within pre-flight crew range</span>`;
  }
  function drawBP() {
    if (!hasChart || !$("bpChart")) return; const B = D.bp, u = state.last ? state.last.inp : { sbp: "", dbp: "" };
    const num2 = (x) => (x === "" || x === undefined ? null : parseFloat(x));
    const mk = (l, o, col) => ({ label: l, data: [o.sbp, o.dbp], backgroundColor: col, borderRadius: 5 });
    evChart = new Chart($("bpChart"), { type: "bar", data: { labels: ["Systolic (mmHg)", "Diastolic (mmHg)"], datasets: [mk("Analog pre", B.pre, "rgba(148,163,184,.55)"), mk("Analog in-flight", B.inflight, "rgba(167,139,250,.75)"), mk("Analog post", B.post, "rgba(108,182,232,.55)"), { label: "Your input", data: [num2(u.sbp), num2(u.dbp)], backgroundColor: COL.orange, borderRadius: 5 }] }, options: { maintainAspectRatio: false, plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { x: { grid: { display: false } }, y: { min: 40, grid: { color: gridC } } } } });
  }
  function refreshBP() { if (!evChart || !state.last) return; const u = state.last.inp, n = (x) => (x === "" ? null : parseFloat(x)); evChart.data.datasets[3].data = [n(u.sbp), n(u.dbp)]; evChart.update(); }
  $("evBody").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (b) { state.cmp = b.dataset.c; if (evChart) evChart.destroy(); document.querySelectorAll("#cmpPills .chip").forEach(c => c.classList.toggle("active", c === b)); drawCmp(); } });
  $("evBody").addEventListener("input", (e) => { const k = e.target.dataset.bio; if (k) { state.bio[k] = e.target.value; bioStatus(k); if (k === state.cmp) { if (evChart) evChart.destroy(); drawCmp(); } } });

  /* ---------- TEST SUITE ---------- */
  const mini = (t) => `<span class="tbadge" data-tier="${t}" style="font-size:10.5px;padding:3px 9px;letter-spacing:.06em">${D.tiers[t].tag}</span>`;
  $("runSuite").onclick = () => {
    const r = runSuite(); $("suiteSummary").classList.remove("hidden"); $("suiteTableWrap").classList.remove("hidden");
    $("suiteBody").innerHTML = r.rows.map((x, i) => `<tr class="row" style="cursor:pointer" data-id="${x.id}"><td class="mono dim">${i + 1}</td><td>${x.name}</td><td class="muted">${x.group}</td><td>${mini(x.expected)}</td><td>${mini(x.got)} <span class="${x.ok ? "pass" : "fail"}">${x.ok ? "✓" : "✗"}</span></td><td>${mini(x.naive)} <span class="${x.naiveOk ? "pass" : "fail"}">${x.naiveOk ? "✓" : "✗"}</span></td></tr>`).join("");
    const f = (id, v, t) => { const el = $(id); el.dataset.v = 0; const t0 = performance.now(); (function s(n) { const p = Math.min(1, (n - t0) / 900); el.textContent = Math.round(v * p) + (t ? "/" + t : ""); if (p < 1) requestAnimationFrame(s); })(t0); };
    f("sCrew", r.ok, r.total); f("sNaive", r.naiveOk, r.total); f("sRef", r.refusals, r.rows.filter(x => x.expected === "insufficient").length); f("sFa", r.falseAlarmsAvoided);
    Sound.tier(r.ok === r.total ? "green" : "yellow");
  };
  $("suiteBody").addEventListener("click", (e) => { const tr = e.target.closest("[data-id]"); if (tr) { loadCase(tr.dataset.id, true); scrollTo({ top: 0, behavior: "smooth" }); } });

  /* ---------- STATIC SECTIONS ---------- */
  $("chain").innerHTML = D.chain.map((c, i) => `<div class="link" style="--i:${i}"><div class="mono" style="color:var(--accent);font-size:10.5px;letter-spacing:.12em">${String(i + 1).padStart(2, "0")} · ${c[0].toUpperCase()}</div><div class="mt-2" style="font-size:12.5px;line-height:1.5">${c[1]}</div></div>`).join("");
  const J = [["Impact", "Targets the autonomy gap for deep-space crews. The same offline decision support applies to remote clinics on Earth."], ["Creativity", "Refuses to assess when data are stale, missing or conflicting, and is benchmarked against a basic dashboard."], ["Validity", D.cases.length + " designed test cases, a transparent z-score engine, and every threshold labelled as an assumption."], ["Relevance", "Challenge #05. OSD-575 benchmarks and HRP risk ratings frame the context; the score uses personal baselines."], ["Presentation", "Four astronaut questions answered on one screen, with a one-click scenario simulator for the 240-second demo."]];
  $("judging").innerHTML = J.map(j => `<div class="glass p-4 reveal"><div class="mono" style="color:var(--accent);font-size:11px;letter-spacing:.12em">${j[0].toUpperCase()}</div><p class="muted mt-2" style="font-size:12.5px;line-height:1.6">${j[1]}</p></div>`).join("");

  /* ---------- COPY STATUS REPORT ---------- */
  $("copyRpt").onclick = async () => {
    const a = state.last.a, T = D.tiers[a.tier], b = $("copyRpt");
    const txt = [
      `CREWCHECK STATUS · ${new Date().toISOString().slice(0, 16)}Z`,
      `Tier: ${T.tag} — ${T.name}`,
      `Trigger: ${a.trigger}`,
      a.scored ? `Composite drift: ${a.composite.toFixed(2)} SD · ${a.persistence} day(s) at Watch+` : "Scoring bypassed (data not reliable)",
      `NOW: ${T.next.now}`, `REPEAT: ${T.next.repeat}`, `CONTACT: ${T.next.contact}`,
      "Decision support only. Not a diagnosis."
    ].join("\n");
    try { await navigator.clipboard.writeText(txt); b.textContent = "Copied ✓"; } catch (e) { b.textContent = "Copy failed"; }
    setTimeout(() => b.textContent = "Copy status report", 1800);
  };

  /* ---------- INIT ---------- */
  renderMission(); renderBaseline(); renderEvidence(); resetAll(); observeReveals();
  setInterval(() => { if (state.last) recalc(); }, 30000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", UI); else UI();
})();