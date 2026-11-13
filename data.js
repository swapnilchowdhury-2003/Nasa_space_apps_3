/* ===== CrewCheck data layer — every value carries a provenance tag ===== */
var CC_DATA = {
  team: "Levi Squad",
  staleHours: 24,
  weights: { hr: 0.25, ex: 0.25, sleep: 0.20, ortho: 0.20, bp: 0.10 },
  thresholds: { drift: 1.5, watch: 0.4, orangeComposite: 1.5, persistDays: 3, orthoZ: 1.5 },
  critical: { sbpHigh: 180, sbpLow: 80, dbpHigh: 120, dbpLow: 45, hrHigh: 120, hrLow: 40 },
  required: [
    { key: "hr",    label: "Resting heart rate", unit: "bpm",  min: 20, max: 250 },
    { key: "sbp",   label: "Systolic BP",        unit: "mmHg", min: 50, max: 300 },
    { key: "dbp",   label: "Diastolic BP",       unit: "mmHg", min: 30, max: 200 },
    { key: "sleep", label: "Sleep duration",     unit: "h",    min: 0,  max: 24 },
    { key: "exMin", label: "Exercise duration",  unit: "min",  min: 0,  max: 600 }
  ],
  baseline: {
    hr: { mean: 66, sd: 3 }, sbp: { mean: 118, sd: 4 }, dbp: { mean: 76, sd: 3 },
    sleep: { mean: 7.0, sd: 0.6 }, exMin: { mean: 60, sd: 8 }, rpe: { mean: 5, sd: 1 }
  },
  defaults: { hr: 68, sbp: 120, dbp: 80, sleep: 5.5, exMin: 60, rpe: 5, ageH: 2, drift: 0 },

  tiers: {
    green:  { name: "Stable",   tag: "GREEN",  meaning: "Indicators near personal baseline.",
      action: "Continue routine operations; log daily telemetry.",
      next: { now: "No action beyond routine operations.", repeat: "Next scheduled morning measurement.", contact: "Not required." } },
    yellow: { name: "Watch",    tag: "YELLOW", meaning: "A single indicator is drifting from personal baseline.",
      action: "Review sleep schedule, increase hydration, monitor trend.",
      next: { now: "Review schedule, hydrate, apply countermeasures.", repeat: "Repeat resting HR and BP tomorrow morning under the same conditions.", contact: "If drift persists 3+ days or a second indicator joins." } },
    orange: { name: "Act",      tag: "ORANGE", meaning: "Multiple indicators are compounding.",
      action: "Perform structured check-in, adjust exercise prescription, notify crew medical support if persistent.",
      next: { now: "Structured check-in; adjust exercise and schedule.", repeat: "Repeat HR/BP after 5 min seated rest and again within 24 h.", contact: "Notify crew medical support if persistent or worsening." } },
    red:    { name: "Seek Help Now", tag: "RED", meaning: "Red-flag symptom or critical vital sign.",
      action: "Stop exertion immediately, initiate mission medical emergency protocol, and contact Flight Surgeon.",
      next: { now: "Stop exertion. Initiate mission medical emergency protocol.", repeat: "Do not wait to re-measure before escalating.", contact: "Contact Flight Surgeon now. Do not self-treat a suspected cardiac event." } },
    insufficient: { name: "Insufficient Data", tag: "NO ASSESSMENT", meaning: "Data are stale, incomplete or inconsistent.",
      action: "Baseline drift cannot be assessed safely. Re-sync sensors or repeat manual measurements, then re-run.",
      next: { now: "Do not rely on any earlier status.", repeat: "Re-measure resting HR, BP, sleep log and exercise entry, then re-sync.", contact: "Any symptom still triggers the emergency protocol." } }
  },

  contributors: {
    hr: "Reduced aerobic fitness, dehydration or reduced plasma volume, stress, illness, poor recovery.",
    ex: "Cardiovascular and musculoskeletal deconditioning, fatigue, exercise-hardware or adherence limits.",
    sleep: "Sleep debt, circadian misalignment, workload; chronic ~6 h sleep impairs vigilance.",
    ortho: "Headward fluid shift, reduced plasma volume, altered vascular regulation (orthostatic intolerance).",
    bp: "Altered vascular regulation, volume status, stress, medication or caffeine."
  },

  missions: {
    leoShort: { label: "LEO Short (<30 d)", ops: "3x3 · Requires Characterization", lt: "1x2 · Accepted",
      text: "Early headward fluid shift and orthostatic symptoms are expected. Functional impairments in LEO missions typically recover in weeks to months with reconditioning.", autonomy: "Ground contact available; escalate per mission protocol." },
    leoLong:  { label: "LEO Long (30 d–1 yr)", ops: "4x3 · Requires Characterization", lt: "1x2 · Accepted with Monitoring",
      text: "Cumulative deconditioning and sleep restriction matter more. Personal-baseline trends are the main safeguard.", autonomy: "Ground contact available; trend review with flight surgeon." },
    lunar:    { label: "Lunar Orbital / Surface", ops: "3x3 / 4x3 · Requires Characterization", lt: "1x2 · Accepted with Monitoring",
      text: "Evidence is thin beyond LEO (>14 d) and for partial gravity (>3 d). Gravity transitions raise orthostatic vigilance.", autonomy: "Communication delays are short but non-zero; keep tools independent of link state." },
    mars:     { label: "Mars Planetary (730–1224 d)", ops: "4x4 · Requires Mitigation / Standard Refinement", lt: "2x4 · Requires Mitigation / Standard Refinement",
      text: "Highest-rated profile. Monitoring matters more as the mission progresses, and exercise hardware is reduced.", autonomy: "Long communication delay: crew need autonomous decision support that works offline." }
  },
  missionSource: "NASA HRP Roadmap · Cardiovascular risk page · HSRB ratings last approved 5/2024 (LxC = likelihood × consequence)",

  osd575: {
    id: "OSD-575", title: "SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays",
    mission: "SpaceX Inspiration4 · 3-day LEO · 16–18 Sep 2021", crew: "4 crew (C001 M, C002 F, C003 F, C004 M)",
    specimen: "Serum (SST), CMP fresh at room temp; remainder −80 °C", lab: "Quest Diagnostics (test code 10231) · Beckman Coulter AU5800",
    timepoints: ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"],
    doi: "10.26030/mc5d-p710", submitted: "05-Dec-2022", released: "14-May-2024",
    pi: "Christopher E. Mason, Weill Cornell Medicine",
    funding: "NASA, NIH, philanthropic donations",
    pubs: ["10.1038/s41586-024-07639-y", "10.1038/s41467-024-48806-z", "10.17504/protocols.io.81wgbxxo1lpk/v1"],
    link: "https://osdr.nasa.gov/bio/repo/data/missions/SpaceX%20Inspiration4",
    files: ["i_Investigation.txt", "s_OSD-575.txt", "a_OSD-575_analytical-chemistry_comprehensive-metabolic-panel_quest diagnostics.txt",
      "LSDS-8_Comprehensive_Metabolic_Panel_CMP_upload_SUBMITTED.csv", "LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv",
      "a_OSD-575_immunoassay_multiplex_Eve Technologies Panel HD71.txt / HDCVD9.txt", "a_OSD-575_immunoassay_multiplex_Alamar Biosciences.txt"]
  },
  cmp: {
    glucose:    { label: "Glucose", unit: "mg/dL", min: 65, max: 99, preMean: 75.3, preSd: 11.3,
      tp: { "L-92": 82.25, "L-44": 74.25, "L-3": 69.5, "R+1": 93.25, "R+45": 51.75, "R+82": 82.0, "R+194": 82.0 },
      note: "R+45 crew mean (51.8) is below the Quest range: 3 of 4 crew read 36–44 mg/dL. Treat as a data-quality flag (likely sampling or fasting conditions), not a physiological finding." },
    bun:        { label: "Blood Urea Nitrogen", unit: "mg/dL", min: 7, max: 25, preMean: 19.4, preSd: 3.5,
      tp: { "L-92": 19.5, "L-44": 18.25, "L-3": 20.5, "R+1": 21.25, "R+45": 18.5, "R+82": 19.25, "R+194": 25.25 }, note: "" },
    creatinine: { label: "Creatinine", unit: "mg/dL", min: 0.6, max: 1.35, preMean: 1.07, preSd: 0.15,
      tp: { "L-92": 1.05, "L-44": 1.02, "L-3": 1.14, "R+1": 1.03, "R+45": 1.04, "R+82": 1.02, "R+194": 1.18 }, note: "" },
    sodium:     { label: "Sodium", unit: "mmol/L", min: 135, max: 146, preMean: 140.3, preSd: 1.7,
      tp: { "L-92": 140.0, "L-44": 139.75, "L-3": 141.0, "R+1": 138.0, "R+45": 138.25, "R+82": 139.75, "R+194": 138.25 }, note: "" },
    n: "Crew means of 4 subjects per timepoint; pre-flight mean ± SD pooled over L-92, L-44, L-3 (n = 12)."
  },
  bp: {
    band: { sbp: [110, 125], dbp: [70, 80] },
    pre: { sbp: 119.3, dbp: 72.7, nS: 46, nD: 42 }, inflight: { sbp: 116.6, dbp: 79.1, nS: 20, nD: 18 }, post: { sbp: 117.8, dbp: 78.5, nS: 40, nD: 34 },
    rows: 75, file: "Cleaned_Numeric_BP_Dataset.csv",
    note: "Mean of study means from published flight (ISS, STS, Soyuz), head-down bed rest and lab studies. Analog reference, not one cohort. The 110–125 / 70–80 band is the team reference band."
  },
  framingham: { n: 4240, sbp: 132.4, dbp: 82.9, hr: 75.9, glucose: 82.0, age: 49.6,
    chd: { sbp: 143.6, dbp: 87.0, hr: 76.5 }, noChd: { sbp: 130.3, dbp: 82.2, hr: 75.8 },
    note: "Terrestrial cohort, non-NASA. Used as context only and never feeds the drift score. Systolic BP separates the CHD groups; resting HR barely does (76.5 vs 75.8)." },

  hazards: [
    { tag: "CV",  title: "Altered gravity · fluid shift", body: "Weightlessness causes a headward fluid shift that alters blood volume, flow and pressure, leading to cardiovascular deconditioning, orthostatic intolerance and reduced exercise capacity.", ind: "Orthostatic symptoms · resting HR · BP" },
    { tag: "MA",  title: "Microgravity deconditioning", body: "Cardiorespiratory and musculoskeletal fitness decline in flight despite ISS countermeasures; many crew have not returned to preflight fitness by the end of the 30-day reconditioning program.", ind: "Exercise duration · RPE" },
    { tag: "SLP", title: "Sleep disruption · circadian", body: "Crews average about 6 h/night; on 44% of ISS nights under 6 h. Chronic ~6 h sleep gives vigilance decrements similar to one night of total sleep deprivation.", ind: "Sleep duration (rolling sleep debt)" },
    { tag: "MED", title: "Closed environment · autonomy gap", body: "Minimally trained crew medical officers can follow written procedures but lack decision-support expertise. Delay and bandwidth limits mean tools must work independently of ground link.", ind: "Design driver: offline-first decision support" },
    { tag: "CV",  title: "Radiation (education only)", body: "A long-term effect, not detectable by daily vitals. NCRP 2018 reports insufficient evidence that heart doses ≤0.5 Gy cause CVD. Shown for context and never used as an input.", ind: "Not an input" },
    { tag: "CV",  title: "Countermeasure evidence", body: "A single 90-minute artificial-gravity exposure prolonged time to presyncope by 30% in men and 22% in women (AG-Evans task).", ind: "Context for orthostatic actions" }
  ],
  chain: [
    ["Hazard", "Altered gravity, sleep disruption, isolation"], ["Mechanism", "Fluid shift, lower plasma volume, vascular changes"],
    ["Risk", "Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes"],
    ["Indicators", "Resting HR, BP, exercise, sleep, orthostatic symptoms"], ["Baseline", "Personal 14-day mean and SD"],
    ["Alert rule", "Weighted drift score + red-flag symptoms"], ["Action", "Hydrate, exercise prescription, sleep review"],
    ["Escalation", "Chest pain, fainting, severe breathlessness, sustained critical vitals"]
  ],
  assumptions: [
    "Data older than 24 h, or any missing critical field, bypasses scoring (design choice).",
    "Weights 25/25/20/20/10 and the 3-day persistence rule come from the team's Approach document, not NASA.",
    "Drift = z ≥ 1.5 SD in the adverse direction; Watch ≥ 0.4; Orange = 2+ drifting indicators or composite ≥ 1.5.",
    "Each orthostatic symptom adds 1.5 SD-equivalent. Critical vitals: SBP ≥180 or ≤80, DBP ≥120 or ≤45, HR ≥120 or ≤40.",
    "The HRP Roadmap pages hold no numeric thresholds. Replace all values above with Flight-Surgeon-approved mission protocol values before any operational use."
  ],

  cases: [
    { id: "normal", name: "Normal baseline", group: "Valid readings", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 2, expected: "green" },
    { id: "stale", name: "Stale data (30 h)", group: "Data quality", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 30, expected: "insufficient" },
    { id: "yellow", name: "Sleep & HR drift", group: "Single-indicator drift", inp: { hr: 68, sbp: 120, dbp: 78, sleep: 5.5, exMin: 55, rpe: 5 }, ageH: 3, drift: 2, expected: "yellow" },
    { id: "orange", name: "Compounding drift", group: "Compounding drift", inp: { hr: 74, sbp: 122, dbp: 78, sleep: 5.8, exMin: 35, rpe: 7 }, ageH: 2, drift: 3, expected: "orange" },
    { id: "red", name: "Orthostatic emergency", group: "Safety escalation", inp: { hr: 96, sbp: 92, dbp: 58, sleep: 5.0, exMin: 20, rpe: 8, sym: ["faint", "vision"] }, ageH: 1, expected: "red" },
    { id: "conflict", name: "Conflicting BP input", group: "Data quality", inp: { hr: 66, sbp: 120, dbp: 130, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 1, expected: "insufficient" },
    { id: "t_rpe", name: "RPE missing (optional)", group: "Valid readings", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: "" }, ageH: 2, expected: "green" },
    { id: "t_var", name: "Normal day-to-day variation", group: "Valid readings", inp: { hr: 67, sbp: 121, dbp: 78, sleep: 6.8, exMin: 58, rpe: 5 }, ageH: 4, expected: "green" },
    { id: "t_23", name: "Data age 23.5 h (still valid)", group: "Data quality", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 23.5, expected: "green" },
    { id: "t_245", name: "Data age 24.5 h", group: "Data quality", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 24.5, expected: "insufficient" },
    { id: "t_nohr", name: "Heart rate missing", group: "Data quality", inp: { hr: "", sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 1, expected: "insufficient" },
    { id: "t_nobp", name: "Blood pressure missing", group: "Data quality", inp: { hr: 66, sbp: "", dbp: "", sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 1, expected: "insufficient" },
    { id: "t_nosleep", name: "Sleep missing", group: "Data quality", inp: { hr: 66, sbp: 118, dbp: 76, sleep: "", exMin: 60, rpe: 5 }, ageH: 1, expected: "insufficient" },
    { id: "t_noex", name: "Exercise missing", group: "Data quality", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: "", rpe: 5 }, ageH: 1, expected: "insufficient" },
    { id: "t_nots", name: "No timestamp", group: "Data quality", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: null, expected: "insufficient" },
    { id: "t_future", name: "Timestamp in the future", group: "Data quality", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: -5, expected: "insufficient" },
    { id: "t_implaus", name: "Implausible HR (400 bpm)", group: "Data quality", inp: { hr: 400, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 1, expected: "insufficient" },
    { id: "t_dizzy", name: "Mild dizziness on standing", group: "Single-indicator drift", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5, sym: ["dizzy"] }, ageH: 1, expected: "yellow" },
    { id: "t_palp", name: "Palpitations alone", group: "Single-indicator drift", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5, sym: ["palp"] }, ageH: 1, expected: "yellow" },
    { id: "t_exdrop", name: "Exercise decline only", group: "Single-indicator drift", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 30, rpe: 5 }, ageH: 2, expected: "yellow" },
    { id: "t_hrsleep", name: "HR + sleep compounding", group: "Compounding drift", inp: { hr: 71, sbp: 118, dbp: 76, sleep: 6.0, exMin: 60, rpe: 5 }, ageH: 2, expected: "orange" },
    { id: "t_hrex", name: "HR up + exercise decline", group: "Compounding drift", inp: { hr: 72, sbp: 118, dbp: 76, sleep: 7.0, exMin: 30, rpe: 5 }, ageH: 2, expected: "orange" },
    { id: "t_ath", name: "Athlete: +10 bpm over a low baseline", group: "Personal baseline", inp: { hr: 58, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 2, base: { hr: { mean: 48, sd: 2 } }, expected: "yellow" },
    { id: "t_hibase", name: "High but stable personal baseline", group: "Personal baseline", inp: { hr: 89, sbp: 141, dbp: 89, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 2, base: { hr: { mean: 88, sd: 3 }, sbp: { mean: 140, sd: 4 }, dbp: { mean: 88, sd: 3 } }, expected: "green" },
    { id: "t_chest", name: "Chest pain, normal vitals", group: "Safety escalation", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5, sym: ["chest"] }, ageH: 1, expected: "red" },
    { id: "t_sob", name: "Severe shortness of breath", group: "Safety escalation", inp: { hr: 70, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5, sym: ["sob"] }, ageH: 1, expected: "red" },
    { id: "t_palpviz", name: "Palpitations with dizziness", group: "Safety escalation", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5, sym: ["palp", "dizzy"] }, ageH: 1, expected: "red" },
    { id: "t_redstale", name: "Chest pain with stale data", group: "Safety escalation", inp: { hr: 66, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5, sym: ["chest"] }, ageH: 30, expected: "red" },
    { id: "t_crithr", name: "Resting HR 130, no symptoms", group: "Safety escalation", inp: { hr: 130, sbp: 118, dbp: 76, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 1, expected: "red" },
    { id: "t_critbp", name: "BP 190/105, no symptoms", group: "Safety escalation", inp: { hr: 70, sbp: 190, dbp: 105, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 1, expected: "red" },
    { id: "t_lowbp", name: "BP 78/50 with HR 102", group: "Safety escalation", inp: { hr: 102, sbp: 78, dbp: 50, sleep: 7.0, exMin: 60, rpe: 5 }, ageH: 1, expected: "red" }
  ]
};
if (typeof module !== "undefined" && module.exports) module.exports = CC_DATA;