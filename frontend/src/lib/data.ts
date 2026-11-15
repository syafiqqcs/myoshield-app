export type Domain = "radiation" | "musculoskeletal" | "vestibular" | "cardiovascular";
export type Role = "Astronaut" | "Researcher" | "Mission Health Specialist";

export const DOMAINS: Record<
  Domain,
  { label: string; short: string; color: string; route: string; blurb: string }
> = {
  radiation: {
    label: "Radiation Monitoring",
    short: "Radiation",
    color: "#4DA3FF",
    route: "radiation",
    blurb: "Environmental radiation measurements and trends",
  },
  musculoskeletal: {
    label: "Musculoskeletal Health",
    short: "Musculoskeletal",
    color: "#35D6C0",
    route: "musculoskeletal",
    blurb: "Molecular muscle-health indicators",
  },
  vestibular: {
    label: "Vestibular Health",
    short: "Vestibular",
    color: "#9B8CFF",
    route: "vestibular",
    blurb: "Eye movement, head kinematics and symptoms",
  },
  cardiovascular: {
    label: "Cardiovascular and Respiratory",
    short: "Cardiovascular",
    color: "#F2B84B",
    route: "cardiovascular",
    blurb: "Heart and respiratory indicators",
  },
};

export type Dataset = {
  id: string;
  name: string;
  source: string;
  domain: Domain;
  population: string;
  populationKind:
    | "Animal"
    | "Human (in vitro)"
    | "Human (ground-based)"
    | "Human (flight crew)"
    | "Environment"
    | "User upload";
  origin: "Research dataset" | "User upload";
  format: string;
  records: string;
  variables: string[];
  methods: string[];
  suitable: string;
  limitation: string;
  description: string;
  citation: string;
  quality: string;
  modelIds: string[];
  uploaded?: {
    columns: string[];
    rows: Record<string, string>[];
    size: number;
    fileName: string;
    addedAt: string;
  };
};

export const DATASETS: Dataset[] = [
  {
    id: "OSD-139",
    name: "Mouse skeletal muscle proteomics",
    source: "NASA Open Science Data Repository (OSDR)",
    domain: "musculoskeletal",
    population: "Mouse muscle research",
    populationKind: "Animal",
    origin: "Research dataset",
    format: "Tabular (CSV / TSV)",
    records: "Not specified in catalog",
    variables: ["Protein expression", "Pathway information", "Experimental group"],
    methods: ["Differential expression exploration"],
    suitable: "Exploratory muscle biology analysis",
    limitation: "Not a direct human astronaut strength measurement.",
    description:
      "Protein-expression and pathway information from mouse muscle research, used for exploratory muscle biology analysis.",
    citation: "NASA OSDR, study OSD-139. Full citation to be confirmed from the repository record.",
    quality:
      "Quality metrics are not pre-computed in this prototype. They will be generated on validation.",
    modelIds: ["musculo-de"],
  },
  {
    id: "OSD-684",
    name: "Human-derived skeletal muscle tissue chips",
    source: "NASA Open Science Data Repository (OSDR)",
    domain: "musculoskeletal",
    population: "Human-derived skeletal muscle tissue chips",
    populationKind: "Human (in vitro)",
    origin: "Research dataset",
    format: "Processed RNA-seq tables (CSV / TSV)",
    records: "Not specified in catalog",
    variables: ["Processed RNA sequencing", "Gene expression", "Experimental group"],
    methods: ["Differential expression exploration"],
    suitable: "Gene-expression analysis",
    limitation: "Gene expression does not directly measure muscle strength.",
    description: "Processed RNA sequencing from human-derived skeletal muscle tissue chips.",
    citation: "NASA OSDR, study OSD-684. Full citation to be confirmed from the repository record.",
    quality:
      "Quality metrics are not pre-computed in this prototype. They will be generated on validation.",
    modelIds: ["musculo-de"],
  },
  {
    id: "ICPSR 235362",
    name: "Eye movement and head kinematics",
    source: "ICPSR",
    domain: "vestibular",
    population: "Ground-based human participants",
    populationKind: "Human (ground-based)",
    origin: "Research dataset",
    format: "Tabular (CSV)",
    records: "Not specified in catalog",
    variables: ["Eye movement", "Head kinematics", "Angular velocity"],
    methods: ["Vestibular signal analysis"],
    suitable: "Vestibular signal analysis",
    limitation: "Not direct spaceflight astronaut measurements.",
    description: "Eye movement and head kinematics recorded in ground-based human participants.",
    citation: "ICPSR study 235362. Full citation to be confirmed from the repository record.",
    quality:
      "Quality metrics are not pre-computed in this prototype. They will be generated on validation.",
    modelIds: ["vestibular-signal"],
  },
  {
    id: "AP006",
    name: "Apollo flight crew motion sickness assessment",
    source: "NASA historical flight records",
    domain: "vestibular",
    population: "Apollo flight crew",
    populationKind: "Human (flight crew)",
    origin: "Research dataset",
    format: "Tabular (CSV)",
    records: "Not specified in catalog",
    variables: ["Motion sickness assessment", "Symptom reports"],
    methods: ["Motion sickness symptom analysis"],
    suitable: "Motion sickness symptom analysis",
    limitation: "Does not independently establish comprehensive vestibular dysfunction.",
    description: "Apollo flight crew motion sickness assessment records.",
    citation: "Apollo-era assessment record AP006. Full citation to be confirmed.",
    quality:
      "Quality metrics are not pre-computed in this prototype. They will be generated on validation.",
    modelIds: ["vestibular-symptom"],
  },
  {
    id: "NASA RadLab",
    name: "Space radiation environmental measurements",
    source: "NASA RadLab",
    domain: "radiation",
    population: "Spacecraft environment (no individual subject)",
    populationKind: "Environment",
    origin: "Research dataset",
    format: "Time series (CSV)",
    records: "Not specified in catalog",
    variables: ["Environmental radiation measurement", "Timestamp"],
    methods: ["Radiation trend analysis"],
    suitable: "Radiation trend exploration",
    limitation:
      "Environmental measurements are not automatically personal absorbed-dose measurements.",
    description: "Space radiation environmental measurements for trend exploration.",
    citation: "NASA RadLab. Full citation to be confirmed from the repository record.",
    quality:
      "Quality metrics are not pre-computed in this prototype. They will be generated on validation.",
    modelIds: ["radiation-trend"],
  },
];

export type ModelDef = {
  id: string;
  domain: Domain;
  name: string;
  version: string;
  endpoint: string;
  required: { col: string; unit: string; note: string; numeric: boolean }[];
  anyOf?: { cols: string[]; note: string };
  optional: string[];
  outputs: string[];
};

export const MODELS: ModelDef[] = [
  {
    id: "radiation-trend",
    domain: "radiation",
    name: "Radiation trend analysis",
    version: "Not connected",
    endpoint: "/api/models/radiation",
    required: [
      { col: "timestamp", unit: "ISO 8601", note: "Measurement time", numeric: false },
      {
        col: "radiation_measurement",
        unit: "As defined by source instrument",
        note: "Environmental measurement",
        numeric: true,
      },
    ],
    optional: ["instrument_id"],
    outputs: ["Trend estimate", "Anomaly flags (if supported)"],
  },
  {
    id: "musculo-de",
    domain: "musculoskeletal",
    name: "Differential expression exploration",
    version: "Not connected",
    endpoint: "/api/models/musculoskeletal",
    required: [
      {
        col: "feature_id",
        unit: "Gene / protein identifier",
        note: "Row identifier",
        numeric: false,
      },
      { col: "group", unit: "Group label", note: "Experimental group", numeric: false },
      { col: "expression", unit: "Normalized expression", note: "Expression value", numeric: true },
    ],
    optional: ["pathway"],
    outputs: ["Differential expression table", "Pathway enrichment"],
  },
  {
    id: "vestibular-signal",
    domain: "vestibular",
    name: "Vestibular signal analysis",
    version: "Not connected",
    endpoint: "/api/models/vestibular-signal",
    required: [
      { col: "time_s", unit: "s", note: "Time", numeric: true },
      { col: "eye_position_deg", unit: "deg", note: "Eye position", numeric: true },
      { col: "head_velocity_dps", unit: "deg/s", note: "Head angular velocity", numeric: true },
    ],
    optional: ["avor_gain"],
    outputs: ["Signal features", "aVOR-related measures (if available)"],
  },
  {
    id: "vestibular-symptom",
    domain: "vestibular",
    name: "Motion sickness symptom analysis",
    version: "Not connected",
    endpoint: "/api/models/vestibular-symptom",
    required: [
      { col: "mission_day", unit: "day", note: "Day index", numeric: true },
      { col: "symptom_score", unit: "Source scale", note: "Symptom rating", numeric: true },
    ],
    optional: ["crew_id"],
    outputs: ["Symptom trend"],
  },
  {
    id: "cardio-resp",
    domain: "cardiovascular",
    name: "Cardio-respiratory trend analysis",
    version: "Not connected",
    endpoint: "/api/models/cardiovascular",
    required: [{ col: "timestamp", unit: "ISO 8601", note: "Measurement time", numeric: false }],
    anyOf: {
      cols: [
        "heart_rate_bpm",
        "hrv_ms",
        "spo2_pct",
        "resp_rate_bpm",
        "systolic_mmhg",
        "body_temp_c",
      ],
      note: "At least one measurement column. HRV needs beat-to-beat or ECG-derived data.",
    },
    optional: [],
    outputs: ["Trend per available measurement", "Missing-data summary"],
  },
];

export const UNITS: Record<string, string> = {
  heart_rate_bpm: "BPM",
  hrv_ms: "ms",
  spo2_pct: "%",
  resp_rate_bpm: "breaths/min",
  systolic_mmhg: "mmHg",
  body_temp_c: "°C",
};

export type SubjectType =
  | "Astronaut"
  | "Human research participant"
  | "Animal research model"
  | "Demonstration subject"
  | "Research study (no individual)";
export type Subject = {
  id: string;
  name: string;
  type: SubjectType;
  study: string;
  domains: Domain[];
  datasetIds: string[];
  note: string;
  owner?: boolean;
};

export const SUBJECTS: Subject[] = [
  {
    id: "AST-01",
    name: "Cmdr. Elena Vance",
    type: "Astronaut",
    study: "MYOSHIELD demonstration mission",
    domains: ["cardiovascular", "vestibular", "radiation", "musculoskeletal"],
    datasetIds: [],
    note: "Demonstration astronaut profile. Contains no real person.",
    owner: true,
  },
  {
    id: "AST-02",
    name: "Dr. Kenji Sato",
    type: "Astronaut",
    study: "MYOSHIELD demonstration mission",
    domains: ["cardiovascular", "vestibular", "radiation", "musculoskeletal"],
    datasetIds: [],
    note: "Demonstration astronaut profile. Contains no real person.",
    owner: true,
  },
  {
    id: "AST-03",
    name: "Maj. Marcus Cole",
    type: "Astronaut",
    study: "MYOSHIELD demonstration mission",
    domains: ["cardiovascular", "vestibular", "radiation", "musculoskeletal"],
    datasetIds: [],
    note: "Demonstration astronaut profile. Contains no real person.",
    owner: true,
  },
  {
    id: "AST-04",
    name: "Dr. Nadia Rahman",
    type: "Astronaut",
    study: "MYOSHIELD demonstration mission",
    domains: ["cardiovascular", "vestibular", "radiation", "musculoskeletal"],
    datasetIds: [],
    note: "Demonstration astronaut profile. Contains no real person.",
    owner: true,
  },
  {
    id: "AST-05",
    name: "Lt. Sofia Lindqvist",
    type: "Astronaut",
    study: "MYOSHIELD demonstration mission",
    domains: ["cardiovascular", "vestibular", "radiation", "musculoskeletal"],
    datasetIds: [],
    note: "Demonstration astronaut profile. Contains no real person.",
    owner: true,
  },
  {
    id: "OSD-139-MOUSE",
    name: "Mouse muscle study group",
    type: "Animal research model",
    study: "OSD-139",
    domains: ["musculoskeletal"],
    datasetIds: ["OSD-139"],
    note: "Animal data. Not linked to any human astronaut.",
  },
  {
    id: "OSD-684-CHIP",
    name: "Muscle tissue chip study",
    type: "Human research participant",
    study: "OSD-684",
    domains: ["musculoskeletal"],
    datasetIds: ["OSD-684"],
    note: "Human-derived in-vitro tissue, not a living participant.",
  },
  {
    id: "ICPSR-235362-GRP",
    name: "Ground-based vestibular cohort",
    type: "Human research participant",
    study: "ICPSR 235362",
    domains: ["vestibular"],
    datasetIds: ["ICPSR 235362"],
    note: "Ground-based participants, not spaceflight.",
  },
  {
    id: "AP006-CREW",
    name: "Apollo crew motion sickness record",
    type: "Astronaut",
    study: "AP006",
    domains: ["vestibular"],
    datasetIds: ["AP006"],
    note: "Historical flight crew assessment record.",
  },
  {
    id: "STUDY-RADLAB",
    name: "RadLab environment record",
    type: "Research study (no individual)",
    study: "NASA RadLab",
    domains: ["radiation"],
    datasetIds: ["NASA RadLab"],
    note: "Environmental data only. Not personal dose.",
  },
];

// ---- CSV ----
export function parseCSV(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let cur: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      cur.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(f);
      f = "";
      if (cur.some((x) => x.trim() !== "")) rows.push(cur);
      cur = [];
    } else f += c;
  }
  cur.push(f);
  if (cur.some((x) => x.trim() !== "")) rows.push(cur);
  const columns = (rows.shift() ?? []).map((c) => c.trim());
  return {
    columns,
    rows: rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, (r[i] ?? "").trim()]))),
  };
}

export const isNum = (v: string) => v !== "" && !isNaN(Number(v));

export type Validation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  missingCols: string[];
  colStats: {
    col: string;
    role: string;
    numeric: boolean;
    missing: number;
    total: number;
    min?: number;
    max?: number;
    mean?: number;
  }[];
};

export function validate(
  ds: Dataset | undefined,
  model: ModelDef | undefined,
  mapping: Record<string, string>,
  unitsConfirmed: boolean,
): Validation {
  const v: Validation = { ok: false, errors: [], warnings: [], missingCols: [], colStats: [] };
  if (!ds || !model) {
    v.errors.push("Select a dataset and a model.");
    return v;
  }
  if (ds.domain !== model.domain)
    v.errors.push(
      `This model analyses ${DOMAINS[model.domain].short} data, but the dataset belongs to ${DOMAINS[ds.domain].short}.`,
    );
  if (!ds.modelIds.includes(model.id) && ds.origin === "Research dataset")
    v.errors.push(`${ds.id} is not catalogued as compatible with "${model.name}".`);
  if (!ds.uploaded) {
    v.warnings.push(
      "Library dataset values are not loaded in this prototype. Compatibility is checked from catalog metadata only.",
    );
    v.ok = v.errors.length === 0;
    return v;
  }
  const { columns, rows } = ds.uploaded;
  if (rows.length === 0) v.errors.push("The file contains a header but no data rows.");
  const resolve = (c: string) => mapping[c] || (columns.includes(c) ? c : "");
  for (const r of model.required)
    if (!resolve(r.col)) {
      v.missingCols.push(r.col);
      v.errors.push(
        `Missing required column "${r.col}" (${r.note}, ${r.unit}). Rename it in your file or map an existing column to it.`,
      );
    }
  const anyCols: string[] = [];
  if (model.anyOf) {
    for (const c of model.anyOf.cols) if (resolve(c)) anyCols.push(c);
    if (!anyCols.length) {
      v.missingCols.push("one of: " + model.anyOf.cols.join(", "));
      v.errors.push(
        `None of the measurement columns found (${model.anyOf.cols.join(", ")}). ${model.anyOf.note}`,
      );
    }
    if (!resolve("hrv_ms") && model.id === "cardio-resp")
      v.warnings.push(
        "No HRV column found. HRV analysis requires beat-to-beat or ECG data, so it will be skipped.",
      );
  }
  const targets = [
    ...model.required.map((r) => ({ col: r.col, numeric: r.numeric })),
    ...anyCols.map((c) => ({ col: c, numeric: true })),
  ];
  for (const t of targets) {
    const src = resolve(t.col);
    if (!src) continue;
    const vals = rows.map((r) => r[src] ?? "");
    const present = vals.filter((x) => x !== "");
    const nums = present.filter(isNum).map(Number);
    const missing = vals.length - present.length;
    if (t.numeric && present.length && nums.length < present.length)
      v.errors.push(
        `Column "${src}" should be numeric but contains ${present.length - nums.length} non-numeric value(s).`,
      );
    if (missing > 0)
      v.warnings.push(`Column "${src}" has ${missing} missing value(s) of ${vals.length}.`);
    v.colStats.push({
      col: t.col,
      role: src === t.col ? "direct" : `mapped from "${src}"`,
      numeric: t.numeric,
      missing,
      total: vals.length,
      min: nums.length ? Math.min(...nums) : undefined,
      max: nums.length ? Math.max(...nums) : undefined,
      mean: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined,
    });
  }
  if (!unitsConfirmed && v.errors.length === 0)
    v.warnings.push("Confirm that your units match the expected units before running.");
  v.ok = v.errors.length === 0 && unitsConfirmed;
  return v;
}

// ---- Simulated demonstration series (deterministic, always labelled) ----
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
export function simSeries(
  seed: number,
  n: number,
  base: number,
  amp: number,
  noise: number,
  drift = 0,
): [number, number][] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => [
    i,
    +(base + drift * i + Math.sin(i / (n / 6)) * amp + (r() - 0.5) * noise).toFixed(2),
  ]);
}

export type Analysis = {
  id: string;
  date: string;
  datasetId: string;
  datasetName: string;
  domain: Domain;
  modelId: string;
  modelName: string;
  subjectId: string;
  mode: "uploaded" | "simulated";
  status: "Complete";
  variables: string[];
  stats: {
    col: string;
    unit: string;
    n: number;
    missing: number;
    min?: number;
    max?: number;
    mean?: number;
  }[];
  series?: { col: string; points: [number, number][] }[];
  note: string;
};

export type Report = {
  id: string;
  title: string;
  analysisId: string;
  date: string;
  domain: Domain;
  subjectId: string;
  sharedWithAstronaut: boolean;
  simulated: boolean;
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export const SEED_ANALYSES: Analysis[] = [
  {
    id: "AN-DEMO-001",
    date: daysAgo(2),
    datasetId: "NASA RadLab",
    datasetName: "Space radiation environmental measurements",
    domain: "radiation",
    modelId: "radiation-trend",
    modelName: "Radiation trend analysis",
    subjectId: "STUDY-RADLAB",
    mode: "simulated",
    status: "Complete",
    variables: ["radiation_measurement"],
    stats: [],
    note: "Simulated demonstration. No model inference was performed.",
  },
  {
    id: "AN-DEMO-002",
    date: daysAgo(5),
    datasetId: "OSD-139",
    datasetName: "Mouse skeletal muscle proteomics",
    domain: "musculoskeletal",
    modelId: "musculo-de",
    modelName: "Differential expression exploration",
    subjectId: "OSD-139-MOUSE",
    mode: "simulated",
    status: "Complete",
    variables: ["expression"],
    stats: [],
    note: "Simulated demonstration. No model inference was performed.",
  },
];
export const SEED_REPORTS: Report[] = [
  {
    id: "RP-DEMO-001",
    title: "Radiation trend exploration (demonstration)",
    analysisId: "AN-DEMO-001",
    date: daysAgo(2),
    domain: "radiation",
    subjectId: "STUDY-RADLAB",
    sharedWithAstronaut: false,
    simulated: true,
  },
  {
    id: "RP-DEMO-002",
    title: "Muscle expression exploration (demonstration)",
    analysisId: "AN-DEMO-002",
    date: daysAgo(5),
    domain: "musculoskeletal",
    subjectId: "OSD-139-MOUSE",
    sharedWithAstronaut: false,
    simulated: true,
  },
];

export const SAMPLE_CSV: Record<Domain, string> = {
  radiation:
    "timestamp,radiation_measurement\n" +
    Array.from(
      { length: 24 },
      (_, i) =>
        `2024-01-01T${String(i).padStart(2, "0")}:00:00Z,${(0.4 + Math.sin(i / 3) * 0.08 + (i % 5) * 0.01).toFixed(3)}`,
    ).join("\n"),
  musculoskeletal:
    "feature_id,group,expression\n" +
    ["G1", "G2", "G3", "G4", "G5", "G6"]
      .flatMap((g, i) => [
        `${g},control,${(5 + i * 0.4).toFixed(2)}`,
        `${g},treatment,${(5 + i * 0.4 + (i % 2 ? 0.9 : -0.7)).toFixed(2)}`,
      ])
      .join("\n"),
  vestibular:
    "time_s,eye_position_deg,head_velocity_dps\n" +
    Array.from(
      { length: 30 },
      (_, i) =>
        `${(i * 0.1).toFixed(1)},${(Math.sin(i / 4) * 8).toFixed(2)},${(Math.cos(i / 4) * 20).toFixed(2)}`,
    ).join("\n"),
  cardiovascular:
    "timestamp,heart_rate_bpm,spo2_pct\n" +
    Array.from(
      { length: 24 },
      (_, i) =>
        `2024-01-01T${String(i).padStart(2, "0")}:00:00Z,${60 + (i % 7) * 2},${i % 9 === 0 ? "" : 97 + (i % 3) * 0.5}`,
    ).join("\n"),
};
