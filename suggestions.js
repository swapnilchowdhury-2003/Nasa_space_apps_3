(function () {
'use strict';
const TIPS = {
  tiers: {
    green: { tag: "GREEN", name: "Stable", summary: "Indicators are near your personal baseline. Keep the routine that is working.",
      steps: ["Continue routine operations and log telemetry every morning.", "Keep sleep timing and exercise prescription consistent.", "Stay hydrated through the day.", "No contact with medical support needed."] },
    yellow: { tag: "YELLOW", name: "Watch", summary: "One indicator is drifting. Usually fixable with schedule and recovery changes.",
      steps: ["Review today's schedule and protect a full sleep period tonight.", "Increase fluid intake and check meal timing.", "Keep exercise at normal or slightly reduced load. Do not add extra intensity.", "Repeat resting HR and BP tomorrow morning under the same conditions.", "If drift lasts 3+ days or a second indicator joins, tell crew medical support."] },
    orange: { tag: "ORANGE", name: "Act", summary: "Several indicators are drifting together. Time for a structured check-in.",
      steps: ["Do a structured check-in: symptoms, hydration, sleep, workload, stress.", "Reduce exercise intensity and avoid sudden position changes.", "Re-measure HR and BP after 5 min of seated rest, and again within 24 h.", "Prioritise recovery: sleep, fluids, lighter schedule where possible.", "Notify crew medical support if the pattern persists or gets worse."] },
    red: { tag: "RED", name: "Seek Help Now", summary: "A red-flag symptom or critical vital sign. Do not wait or self-treat.",
      steps: ["Stop all exertion immediately and sit or lie down safely.", "Start the mission medical emergency protocol.", "Contact the Flight Surgeon now.", "Do not wait to re-measure before escalating.", "Do not self-treat a suspected cardiac event."] },
    insufficient: { tag: "NO ASSESSMENT", name: "Insufficient Data", summary: "Data is stale, missing or inconsistent, so no safe conclusion can be drawn.",
      steps: ["Do not rely on any earlier status.", "Re-measure resting HR, BP, sleep log and exercise entry.", "Re-sync sensors, then re-run the check.", "Any symptom still triggers the emergency protocol."] }
  },
  ind: {
    hr:    { title: "Resting heart rate", do: ["Rest seated for 5 min, then re-measure.", "Drink water and review caffeine intake.", "Lower exercise intensity for the day.", "Check for stress, illness or poor sleep as contributors."] },
    sleep: { title: "Sleep", do: ["Keep a fixed sleep window and dim lights before it.", "Limit caffeine in the second half of the day.", "Avoid hard exercise right before sleep.", "Plan a recovery night if sleep debt is above 1 h."] },
    ex:    { title: "Exercise performance", do: ["Do the planned session at reduced intensity.", "Prefer consistent short sessions over skipped days.", "Check equipment and schedule conflicts.", "Log RPE honestly; it helps the trend."] },
    ortho: { title: "Orthostatic symptoms", do: ["Stand up slowly; pause seated before standing.", "Increase fluids per mission guidance.", "Avoid sudden movement and heavy exertion until symptoms settle.", "Report persistent dizziness or vision greying to medical support."] },
    bp:    { title: "Blood pressure", do: ["Measure seated, arm at heart level, after 5 min rest.", "Repeat once and compare.", "Review caffeine, stress and hydration.", "Report sustained deviation to crew medical support."] }
  }
};
const COL = { green: "#10B981", yellow: "#F59E0B", orange: "#F97316", red: "#EF4444", insufficient: "#94a3b8" };
const $ = (id) => document.getElementById(id);

let last = { tier: "green", drifting: [] }, fromApp = false;
try { const s = JSON.parse(localStorage.getItem("cc_last")); if (s && s.tier) { last = s; fromApp = true; } } catch (e) {}
let tier = TIPS.tiers[last.tier] ? last.tier : "green";

$("srcTag").textContent = fromApp ? "LOADED FROM DASHBOARD" : "MANUAL VIEW";
$("tierPills").innerHTML = Object.keys(TIPS.tiers).map(k =>
  `<button class="chip" data-t="${k}" style="--c:${COL[k]}"><span class="pip"></span>${TIPS.tiers[k].name}</button>`).join("");
$("tierPills").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) { tier = b.dataset.t; render(); } });

function render() {
  const T = TIPS.tiers[tier];
  document.body.dataset.tier = tier;
  document.querySelectorAll("#tierPills .chip").forEach(c => c.classList.toggle("active", c.dataset.t === tier));
  $("tTagTxt").textContent = T.tag; $("tTitle").textContent = T.name; $("tSummary").textContent = T.summary;
  $("tSteps").innerHTML = T.steps.map((s, i) => `<li class="flex gap-3"><span class="mono" style="color:var(--t)">${String(i + 1).padStart(2, "0")}</span><span>${s}</span></li>`).join("");
  const showInd = tier !== "red" && tier !== "insufficient";
  $("indGrid").innerHTML = showInd ? Object.keys(TIPS.ind).map(k => {
    const I = TIPS.ind[k], hot = last.drifting.indexOf(k) > -1;
    return `<div class="qbox" style="${hot ? "border-color:var(--orange)" : "opacity:.8"}">
      <div class="flex items-center justify-between"><div class="font-medium" style="font-size:14px">${I.title}</div>${hot ? '<span class="tag assume">DRIFTING</span>' : '<span class="tag terr">PREVENTIVE</span>'}</div>
      <ul class="muted mt-3" style="font-size:12.5px;line-height:1.7;padding-left:16px;list-style:disc">${I.do.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
  }).join("") : `<div class="qbox sm:col-span-2 lg:col-span-3 muted" style="font-size:13px">Indicator-level tips are hidden at this level. Follow the steps above first.</div>`;
}
render();
})();