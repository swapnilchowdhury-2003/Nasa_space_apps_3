(function () {
'use strict';
const $ = (id) => document.getElementById(id);

const CARDS = [
  {
    id: "fluid", icon: "🫧", color: "#6cb6e8", title: "Headward Fluid Shift", nick: "“Puffy face, bird legs”",
    what: "On Earth, gravity pulls blood and body fluids down toward your legs. In microgravity that pull is gone, so fluids move up toward the head and chest.",
    result: "The face looks puffy and legs get thinner. Blood volume, plasma volume and blood pressure regulation change as the body adapts.",
    watch: "Blood pressure and resting heart rate",
    keys: ["bp", "hr"],
    src: "NASA HRP Cardiovascular Roadmap"
  },
  {
    id: "cardio", icon: "❤️", color: "#F97316", title: "Cardiovascular Deconditioning & Orthostatic Intolerance", nick: "The heart gets “lazy”",
    what: "In space the heart does not have to pump blood upward against gravity, so it works less and can adapt to a lighter load.",
    result: "When back in gravity (Earth, Moon, Mars), blood pools in the legs. Standing up can cause dizziness, vision greying or even fainting. This is called orthostatic intolerance.",
    watch: "Orthostatic symptoms, resting heart rate",
    keys: ["ortho", "hr"],
    src: "NASA LSDA · HRP Cardiovascular Roadmap"
  },
  {
    id: "sleep", icon: "😴", color: "#a78bfa", title: "Sleep Loss & Circadian Disruption", nick: "Sunrise every 90 minutes",
    what: "In low Earth orbit the sun rises and sets about every 90 minutes, and workload is heavy. Crews average about 6 hours of sleep a night, and roughly 19% of sleep episodes do not match the internal body clock.",
    result: "Chronic sleep debt affects alertness, performance and heart health. It can also raise resting heart rate and make recovery slower.",
    watch: "Sleep duration against personal baseline",
    keys: ["sleep"],
    src: "NASA Sleep (SLP) State of Knowledge"
  },
  {
    id: "fitness", icon: "🏃", color: "#10B981", title: "Cardiorespiratory Fitness Decline", nick: "Exercise helps, but not fully",
    what: "Even with regular exercise on the ISS, aerobic fitness and muscle strength slowly decrease during long missions.",
    result: "Less capacity for hard work during a spacewalk (EVA) or an emergency landing. Recovery after return can take weeks to months.",
    watch: "Exercise duration and perceived exertion (RPE)",
    keys: ["ex"],
    src: "NASA Muscle & Aerobic Fitness (MA) Roadmap"
  },
  {
    id: "radiation", icon: "☢️", color: "#94a3b8", title: "Deep-Space Radiation", nick: "Mission awareness only",
    what: "Outside Earth's magnetic field, cosmic radiation can increase oxidative stress and inflammation in cells and blood vessels.",
    result: "It cannot be seen in daily vital signs, but it is a major long-term risk for deep-space missions. CrewCheck does not use it as an input.",
    watch: "Not measured by CrewCheck (education only)",
    keys: [],
    src: "NASA CV-102 · NCRP guidance"
  }
];

/* read last dashboard result (same origin only) */
let last = null;
try { const s = JSON.parse(localStorage.getItem("cc_last")); if (s && s.tier) last = s; } catch (e) {}
const drifting = last && Array.isArray(last.drifting) ? last.drifting : [];
if (last) { document.body.dataset.tier = last.tier; $("srcTag").textContent = "STATUS FROM DASHBOARD"; $("srcTag").classList.remove("hidden"); }

$("jump").innerHTML = CARDS.map(c => `<a class="chip no-underline" style="color:var(--text);--c:${c.color}" href="#${c.id}"><span class="pip"></span>${c.icon} ${c.title.split(" &")[0]}</a>`).join("");

$("cards").innerHTML = CARDS.map((c, i) => {
  const rel = c.keys.some(k => drifting.indexOf(k) > -1);
  return `<article id="${c.id}" class="glass learn-card" style="--cc:${c.color}">
    <div class="flex items-start gap-4">
      <div class="learn-ico">${c.icon}</div>
      <div class="flex-1">
        <div class="flex flex-wrap items-center gap-2 justify-between">
          <div class="learn-sub">Card ${String(i + 1).padStart(2, "0")} · ${c.nick}</div>
          ${rel ? '<span class="tag assume relevant">RELEVANT NOW</span>' : ""}
        </div>
        <h3 class="font-semibold" style="font-size:18px;line-height:1.3">${c.title}</h3>
      </div>
    </div>
    <div class="grid md:grid-cols-2 gap-4 mt-5">
      <div class="qbox"><div class="lbl">What happens</div><p style="font-size:13.5px;line-height:1.65">${c.what}</p></div>
      <div class="qbox"><div class="lbl">What it can cause</div><p style="font-size:13.5px;line-height:1.65">${c.result}</p></div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3 mt-4">
      <div class="mono" style="font-size:11.5px;color:var(--cc)">CREWCHECK WATCHES · <span class="muted">${c.watch}</span></div>
      <span class="tag nasa">SOURCE · ${c.src}</span>
    </div>
  </article>`;
}).join("");

/* highlight the card from the URL hash and scroll to it */
function focusHash() {
  document.querySelectorAll(".learn-card.hl").forEach(el => el.classList.remove("hl"));
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (el && el.classList.contains("learn-card")) { el.classList.add("hl"); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
}
addEventListener("hashchange", focusHash);
setTimeout(focusHash, 150);
})();