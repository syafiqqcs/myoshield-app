import {
  DOMAIN_DISCLAIMERS,
  domainStatusLabel,
  domainStatusTone,
  getDomainPrediction,
} from "./analysis";
import type { DomainKey, DomainSubMetric, UploadAnalysis } from "./api";
import { CREW } from "./crew";
import { CREW_MISSION, JOBLIB_MODELS } from "./mission";
import { DOMAINS, type Domain, type Subject } from "./data";
import type { AnalysisSnapshot } from "./store";

const DOMAIN_KEYS = Object.keys(DOMAINS) as DomainKey[];

export type ReportTone = "neutral" | "success" | "warning" | "critical";

export type ReportSubMetric = DomainSubMetric;

export type ReportDomain = {
  key: DomainKey;
  label: string;
  short: string;
  color: string;
  riskScore: number | null;
  riskLabel: string;
  status: string;
  statusTone: ReportTone;
  keyMetric: string;
  summary: string;
  modelUsed: string;
  confidence: number | null;
  subMetrics: ReportSubMetric[];
  countermeasures: string[];
  explanation: string;
  dataProvided: boolean;
};

export type ReportModelConfidence = {
  key: string;
  name: string;
  file: string;
  weight: number;
  confidence: number | null;
};

export type MissionReport = {
  reportId: string;
  baseline: boolean;
  generatedAt: string;
  generatedUtc: string;
  dateStamp: string;
  filename: string;
  textFilename: string;
  subjectId: string;
  astronautName: string;
  astronautRole: string;
  astronautType: string;
  issModule: string;
  missionDays: number | null;
  cumulativeDose: number | null;
  missionLabel: string;
  datasetName: string;
  datasetKind: string;
  analysisId: string;
  status: string;
  classification: string;
  interaction: string;
  classificationReason: string;
  readiness: number;
  readinessLabel: string;
  strain: number | null;
  primaryDomain: Domain;
  affectedModule: string;
  vitals: { spo2: number; heartRate: number; respiration: number; coreTemp: number };
  domains: ReportDomain[];
  insights: { title: string; explanation: string }[];
  protocol: { title: string; detail: string }[];
  models: ReportModelConfidence[];
  confidence: number | null;
  disclaimer: string;
  markdown: string;
  plainText: string;
};

const DOMAIN_FALLBACK: Record<DomainKey, { explanation: string; countermeasures: string[] }> = {
  radiation: {
    explanation:
      "Ionizing radiation deposits energy along charged-particle tracks, producing clustered DNA double-strand breaks and reactive oxygen species that outpace cellular repair. Because repair capacity is already committed to microgravity and confinement stress, radiation injury compounds that cross-stressor oxidative fatigue.",
    countermeasures: [
      "Relocate to high-density polyethylene/water-shielded Service Module quarters during SAA passes and SPE alerts.",
      "Sync the personal dosimeter badge and log cumulative mission dose after every relocation.",
      "Time-shift EVA and high-exposure tasks away from SAA transits and SPE windows.",
    ],
  },
  musculoskeletal: {
    explanation:
      "Microgravity removes the mechanical load that slow-twitch postural fibres and the lumbar paraspinal extensor chain normally carry, so muscle protein synthesis falls and the transcriptional atrophy program turns up while bone resorption outpaces formation.",
    countermeasures: [
      "Adjust ARED resistive squat/deadlift loads and add lumbar paraspinal and calf loading sets.",
      "Run the protein, vitamin D and calcium protocol to support bone formation.",
      "Increase lower-body negative-pressure or bungee loading time to restore axial load.",
    ],
  },
  vestibular: {
    explanation:
      "In weightlessness the otolith organs no longer report a stable gravitational vector, so canal and otolith inputs conflict and gaze stabilisation degrades. When VOR gain falls below its ~0.95 nominal, retinal slip and gaze latency rise and spatial disorientation follows.",
    countermeasures: [
      "Run VOR x1/x2 gaze-stabilisation drills against a fixed target.",
      "Anchor to a stable visual horizon and a handrail before releasing or exiting the airlock.",
      "Avoid rapid pitch/roll head turns and keep head movements slow during translation.",
    ],
  },
  cardiovascular: {
    explanation:
      "Cephalad fluid shift moves blood and interstitial fluid toward the head, and the body compensates by reducing plasma volume, so preload and stroke volume fall. Combined with aerobic deconditioning, orthostatic tolerance drops while heart rate climbs and HRV (RMSSD) falls.",
    countermeasures: [
      "Schedule CEVIS cycle ergometer and T2 treadmill protocols to protect aerobic capacity.",
      "Use fluid-loading with electrolytes before re-entry and stand tests to counter plasma volume loss.",
      "Monitor pulse-ox and heart rate continuously during exercise and post-EVA recovery.",
    ],
  },
};

const DEFAULT_BASELINE = { heartRate: 62, spo2: 98, respiration: 15, coreTemp: 36.8 };

function round(value: number, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detailFor(result: UploadAnalysis | null, domain: DomainKey): Record<string, unknown> {
  const detail = result?.module_details?.[domain];
  return detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {};
}

function numberFromDetail(detail: Record<string, unknown>, key: string): number | undefined {
  const value = detail[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * The backend emits an explicit class probability for the vestibular artefact
 * and decision-margin scores elsewhere. When no calibrated probability exists,
 * confidence is derived from the separation between the score and the 0.50
 * decision boundary and labelled as such in the report.
 */
function confidenceFor(detail: Record<string, unknown>, score: number): number {
  const probabilities = detail.class_probabilities;
  if (probabilities && typeof probabilities === "object") {
    const values = Object.values(probabilities as Record<string, unknown>)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => (value <= 1 ? value * 100 : value));
    if (values.length) return round(Math.min(99, Math.max(50, Math.max(...values))), 1);
  }
  const explicit = numberFromDetail(detail, "model_confidence") ?? numberFromDetail(detail, "confidence");
  if (explicit !== undefined) {
    return round(Math.min(99, Math.max(50, explicit <= 1 ? explicit * 100 : explicit)), 1);
  }
  return round(Math.min(99, Math.max(50, 50 + Math.abs(clamp(score) - 0.5) * 100)), 1);
}

function interactionClassification(result: UploadAnalysis | null): string {
  if (!result) return "BASELINE";
  const interaction = String(result.interaction_type ?? "").toUpperCase();
  const status = String(result.status ?? "").toUpperCase();
  if (interaction.includes("SYNERG")) return "SYNERGISTIC ANOMALY";
  if (status === "NOMINAL") return "NOMINAL";
  if (interaction.includes("ADDITIVE")) return "ADDITIVE";
  if (interaction.includes("ANTAGON")) return "ANTAGONISTIC";
  return interaction || status || "NOMINAL";
}

function classificationTone(classification: string): ReportTone {
  if (classification.includes("SYNERG")) return "critical";
  if (classification === "ADDITIVE" || classification === "ANTAGONISTIC") return "warning";
  if (classification === "NOMINAL") return "success";
  return "neutral";
}

function buildLiveSubMetrics(
  result: UploadAnalysis,
  domain: DomainKey,
  prediction: ReturnType<typeof getDomainPrediction>,
): ReportSubMetric[] {
  if (prediction?.sub_metrics?.length) return prediction.sub_metrics;
  const detail = detailFor(result, domain);
  const features = (detail.features_used ?? {}) as Record<string, unknown>;
  const feature = (key: string) => {
    const value = features[key];
    return typeof value === "number" ? value : undefined;
  };

  if (domain === "radiation") {
    const dose = feature("absorbed_dose_rate");
    const rolling = feature("rolling_mean_7d");
    return [
      { label: "Absorbed Dose Rate", value: dose?.toFixed(2) ?? "—", unit: "mSv/day" },
      { label: "7-Day Rolling Mean", value: rolling?.toFixed(2) ?? "—", unit: "mSv/day" },
    ];
  }
  if (domain === "musculoskeletal") {
    const stress = numberFromDetail(detail, "transcriptional_stress_score");
    const genes = numberFromDetail(detail, "genes_evaluated");
    return [
      {
        label: "Transcriptional Stress",
        value: stress !== undefined ? `${(stress * 100).toFixed(0)}` : "—",
        unit: "%",
      },
      { label: "Genes Evaluated", value: genes !== undefined ? String(genes) : "—" },
    ];
  }
  if (domain === "vestibular") {
    const gain = feature("vor_gain_proxy");
    const correlation = feature("eye_head_corr");
    return [
      { label: "VOR Gain", value: gain?.toFixed(2) ?? "—", unit: "0.95 nominal" },
      { label: "Eye-Head Correlation", value: correlation?.toFixed(2) ?? "—" },
    ];
  }
  const heartRate = feature("hr_mean");
  const spo2 = feature("spo2_mean");
  return [
    { label: "Heart Rate", value: heartRate?.toFixed(0) ?? "—", unit: "bpm" },
    { label: "Blood Oxygen Saturation", value: spo2?.toFixed(1) ?? "—", unit: "SpO₂ %" },
  ];
}

function buildBaselineSubMetrics(
  domain: DomainKey,
  mission: (typeof CREW_MISSION)[string] | undefined,
  vitals: MissionReport["vitals"],
): ReportSubMetric[] {
  if (domain === "radiation") {
    return [
      {
        label: "Cumulative Mission Dose",
        value: mission ? mission.cumulativeDose.toFixed(1) : "—",
        unit: "mSv",
      },
      {
        label: "Mission Elapsed",
        value: mission ? String(mission.missionDays) : "—",
        unit: "days",
      },
      {
        label: "Baseline Alert Threshold",
        value: mission ? mission.thresholds.radiation.toFixed(2) : "—",
        unit: "0–1",
      },
      { label: "Model Output", value: "Awaiting", unit: ".joblib run" },
    ];
  }
  if (domain === "musculoskeletal") {
    return [
      {
        label: "Mission Elapsed",
        value: mission ? String(mission.missionDays) : "—",
        unit: "days",
      },
      {
        label: "Baseline Strength Retained",
        value: "100",
        unit: "%",
      },
      {
        label: "Baseline Alert Threshold",
        value: mission ? mission.thresholds.musculoskeletal.toFixed(2) : "—",
        unit: "0–1",
      },
      { label: "Model Output", value: "Awaiting", unit: ".joblib run" },
    ];
  }
  if (domain === "vestibular") {
    return [
      {
        label: "Baseline Postural Sway",
        value: "1.8",
        unit: "cm",
      },
      {
        label: "Baseline Alert Threshold",
        value: mission ? mission.thresholds.vestibular.toFixed(2) : "—",
        unit: "0–1",
      },
      {
        label: "Motion Sickness",
        value: "None reported",
      },
      { label: "Model Output", value: "Awaiting", unit: ".joblib run" },
    ];
  }
  return [
    { label: "Heart Rate", value: vitals.heartRate.toFixed(0), unit: "bpm" },
    { label: "Blood Oxygen Saturation", value: vitals.spo2.toFixed(1), unit: "SpO₂ %" },
    { label: "Respiration", value: vitals.respiration.toFixed(0), unit: "breaths/min" },
    { label: "Core Temperature", value: vitals.coreTemp.toFixed(1), unit: "°C" },
  ];
}

function baselineKeyMetric(
  domain: DomainKey,
  mission: (typeof CREW_MISSION)[string] | undefined,
  vitals: MissionReport["vitals"],
) {
  if (domain === "radiation") {
    return mission
      ? `${mission.cumulativeDose.toFixed(1)} mSv cumulative · ${mission.missionDays} mission days`
      : "No radiation telemetry available";
  }
  if (domain === "musculoskeletal") {
    return mission
      ? `${mission.missionDays} mission days · baseline unloading exposure`
      : "No musculoskeletal telemetry available";
  }
  if (domain === "vestibular") {
    return mission
      ? `Baseline alert threshold ${mission.thresholds.vestibular.toFixed(2)} · no symptoms reported`
      : "No vestibular telemetry available";
  }
  return `HR ${vitals.heartRate.toFixed(0)} bpm · SpO₂ ${vitals.spo2.toFixed(1)}% · RR ${vitals.respiration.toFixed(0)}/min`;
}

function buildDomain(
  domain: DomainKey,
  result: UploadAnalysis | null,
  mission: (typeof CREW_MISSION)[string] | undefined,
  vitals: MissionReport["vitals"],
): ReportDomain {
  const meta = DOMAINS[domain];
  const fallback = DOMAIN_FALLBACK[domain];
  const prediction = getDomainPrediction(result, domain);
  const detail = detailFor(result, domain);

  if (prediction) {
    return {
      key: domain,
      label: meta.label,
      short: meta.short,
      color: meta.color,
      riskScore: round(prediction.risk_score),
      riskLabel: Number(prediction.risk_score).toFixed(3),
      status: domainStatusLabel(prediction.status),
      statusTone: domainStatusTone(prediction.status),
      keyMetric: prediction.key_metric,
      summary: prediction.summary,
      modelUsed: prediction.model_used ?? "Live .joblib output",
      confidence: confidenceFor(detail, prediction.risk_score),
      subMetrics: buildLiveSubMetrics(result!, domain, prediction),
      countermeasures: prediction.countermeasures?.length
        ? prediction.countermeasures
        : fallback.countermeasures,
      explanation: prediction.clinical_explanation ?? fallback.explanation,
      dataProvided: prediction.data_provided !== false,
    };
  }

  return {
    key: domain,
    label: meta.label,
    short: meta.short,
    color: meta.color,
    riskScore: null,
    riskLabel: "—",
    status: "BASELINE",
    statusTone: "neutral",
    keyMetric: baselineKeyMetric(domain, mission, vitals),
    summary:
      "No .joblib inference has been run for this astronaut yet. This row is a baseline telemetry snapshot, not a model result.",
    modelUsed: "Awaiting first .joblib inference",
    confidence: null,
    subMetrics: buildBaselineSubMetrics(domain, mission, vitals),
    countermeasures: fallback.countermeasures,
    explanation: fallback.explanation,
    dataProvided: false,
  };
}

function markdownTable(headers: string[], rows: string[][]) {
  const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  return [
    `| ${headers.map(cell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");
}

function buildMarkdown(report: Omit<MissionReport, "markdown" | "plainText">) {
  const lines: string[] = [
    "# MYOSHIELD BIOMEDICAL TELEMETRY & COUNTERMEASURE REPORT",
    "",
    `**Report ID:** ${report.reportId}`,
    `**Generated (UTC):** ${report.generatedUtc}`,
    `**Classification:** ${report.classification}`,
    `**Report mode:** ${
      report.baseline ? "BASELINE TELEMETRY SNAPSHOT" : "LIVE .JOBLIB TELEMETRY ANALYSIS"
    }`,
    "",
  ];

  if (report.baseline) {
    lines.push(
      "> **BASELINE TELEMETRY SNAPSHOT** — no dataset has been analysed for this astronaut. The values below are baseline vitals and model-ready defaults, not .joblib outputs.",
      "",
    );
  }

  lines.push(
    "## 1. Crew profile",
    "",
    markdownTable(
      ["Field", "Value"],
      [
        ["Astronaut", report.astronautName],
        ["Astronaut ID", report.subjectId],
        ["Role", report.astronautRole],
        ["Assigned ISS module", report.issModule],
        ["Mission", report.missionLabel],
        ["Mission duration", report.missionDays !== null ? `${report.missionDays} days` : "—"],
        [
          "Cumulative mission dose",
          report.cumulativeDose !== null ? `${report.cumulativeDose.toFixed(1)} mSv` : "—",
        ],
      ],
    ),
    "",
    "## 2. Data source and model run",
    "",
    markdownTable(
      ["Field", "Value"],
      [
        ["Dataset / file", report.datasetName],
        ["Dataset type", report.datasetKind],
        ["Analysis ID", report.analysisId],
        ["Overall status", report.status],
        ["Interaction classification", report.classification],
        ["Primary domain", DOMAINS[report.primaryDomain].label],
        ["Affected ISS module", report.affectedModule],
        ["Mission readiness", `${report.readiness.toFixed(1)}%`],
        [
          "Integrated strain index",
          report.strain !== null ? report.strain.toFixed(3) : "— (baseline)",
        ],
      ],
    ),
    "",
    "## 3. Classification and readiness",
    "",
    `**${report.classification}** — ${report.classificationReason}`,
    "",
    `- ${report.readinessLabel}: **${report.readiness.toFixed(1)}%**`,
    `- Live vitals: HR **${report.vitals.heartRate.toFixed(0)} bpm**, SpO₂ **${report.vitals.spo2.toFixed(1)}%**, respiration **${report.vitals.respiration.toFixed(0)}/min**, core temperature **${report.vitals.coreTemp.toFixed(1)} °C**`,
    "",
  );

  report.domains.forEach((domain, index) => {
    lines.push(
      `## 4.${index + 1} ${domain.label}`,
      "",
      `**Risk score:** ${domain.riskLabel}${
        domain.riskScore !== null ? ` (${(domain.riskScore * 100).toFixed(1)}%)` : ""
      }`,
      `**Status:** ${domain.status}`,
      `**Model confidence:** ${
        domain.confidence !== null
          ? `${domain.confidence.toFixed(1)}%${
              report.baseline ? "" : " (decision-margin estimate)"
            }`
          : "— (no model run)"
      }`,
      `**Key metric:** ${domain.keyMetric}`,
      `**Model:** ${domain.modelUsed}`,
      "",
      `**Summary:** ${domain.summary}`,
      "",
      "### Sub-metrics",
      "",
      domain.subMetrics.length
        ? markdownTable(
            ["Metric", "Value", "Unit", "Status"],
            domain.subMetrics.map((metric) => [
              metric.label,
              String(metric.value),
              metric.unit ?? "—",
              metric.status ?? "—",
            ]),
          )
        : "_No domain sub-metrics were returned._",
      "",
      "### Recommended ISS countermeasures",
      "",
      ...domain.countermeasures.map((measure) => `- ${measure}`),
      "",
      "### Model interpretation",
      "",
      domain.explanation,
      "",
      "### Scientific limitation",
      "",
      DOMAIN_DISCLAIMERS[domain.key],
      "",
    );
  });

  if (report.insights.length) {
    lines.push("## 5. Cross-system insights", "");
    report.insights.forEach((insight) => {
      lines.push(`### ${insight.title}`, "", insight.explanation, "");
    });
  }

  if (report.protocol.length) {
    lines.push("## 6. Integrated countermeasure protocol", "");
    report.protocol.forEach((step, index) => {
      lines.push(`${String(index + 1).padStart(2, "0")}. **${step.title}** — ${step.detail}`);
    });
    lines.push("");
  }

  lines.push(
    `## ${report.protocol.length || report.insights.length ? 7 : 5}. .joblib model confidence and provenance`,
    "",
    markdownTable(
      ["Model", "Artefact", "Fusion weight", "Confidence"],
      report.models.map((model) => [
        model.name,
        model.file,
        model.weight.toFixed(2),
        model.confidence !== null ? `${model.confidence.toFixed(1)}%` : "— (no model run)",
      ]),
    ),
    "",
    "Confidence is derived from the separation between each .joblib score and its 0.50 decision boundary unless the artefact returns an explicit class probability. It is not a clinically calibrated probability.",
    "",
    "## Limitations and disclaimer",
    "",
    `- ${report.disclaimer}`,
    "- This report is decision support for researchers and flight surgeons. It is not a diagnosis.",
    "- Environmental radiation telemetry is not personal absorbed dose.",
    "- Gene or protein expression is not a direct measure of muscle strength or function.",
    "- Motion-sickness symptoms alone do not establish vestibular dysfunction.",
    "- Verify provenance, units and model version before citing or acting on this report.",
    "",
    "---",
    "",
    "MYOSHIELD // Crew Biomedical Division · Generated offline from live in-browser telemetry state.",
  );

  return lines.join("\n");
}

function toPlainText(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\|?[\s:|-]+\|?$/gm, "")
    .replace(/\|/g, " | ")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

export function buildMissionReport({
  snapshot,
  subjectId,
  subjects,
  now = new Date(),
}: {
  snapshot: AnalysisSnapshot | null;
  subjectId: string;
  subjects: Subject[];
  now?: Date;
}): MissionReport {
  const subject = subjects.find((entry) => entry.id === subjectId) ?? null;
  const crew = CREW.find((entry) => entry.id === subjectId);
  const mission = CREW_MISSION[subjectId];
  const result = snapshot?.result ?? null;
  const baseline = !snapshot;
  const baseVitals = mission ? mission.baseline : DEFAULT_BASELINE;
  const readVital = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const vitals = result?.vitals
    ? {
        spo2: readVital(result.vitals.spo2, baseVitals.spo2),
        heartRate: readVital(result.vitals.heart_rate, baseVitals.heartRate),
        respiration: readVital(result.vitals.respiration, baseVitals.respiration),
        coreTemp: readVital(result.vitals.core_temp, baseVitals.coreTemp),
      }
    : { ...baseVitals };

  const classification = interactionClassification(result);
  const rawReadiness = result ? Number(result.mission_readiness_score) : (crew?.readiness ?? 96);
  const readiness = Number.isFinite(rawReadiness) ? rawReadiness : (crew?.readiness ?? 96);
  const primaryDomain: Domain =
    result && DOMAIN_KEYS.includes(result.primary_domain as DomainKey)
      ? (result.primary_domain as Domain)
      : (crew?.domain ?? "cardiovascular");

  const domains = DOMAIN_KEYS.map((domain) => buildDomain(domain, result, mission, vitals));
  const domainConfidence = new Map(domains.map((domain) => [domain.key, domain.confidence]));

  const models: ReportModelConfidence[] = JOBLIB_MODELS.map((model) => {
    if (model.key === "integrated") {
      const weighted = domains
        .map((domain) => ({
          confidence: domainConfidence.get(domain.key),
          weight: JOBLIB_MODELS.find((entry) => entry.key === domain.key)?.weight ?? 0,
        }))
        .filter((entry): entry is { confidence: number; weight: number } => entry.confidence !== null);
      const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
      return {
        key: model.key,
        name: model.name,
        file: model.file,
        weight: model.weight,
        confidence: totalWeight
          ? round(weighted.reduce((sum, entry) => sum + entry.confidence * entry.weight, 0) / totalWeight, 1)
          : null,
      };
    }
    return {
      key: model.key,
      name: model.name,
      file: model.file,
      weight: model.weight,
      confidence: domainConfidence.get(model.key as DomainKey) ?? null,
    };
  });

  const integratedConfidence = models.find((model) => model.key === "integrated")?.confidence ?? null;
  const generatedAt = now.toISOString();
  const dateStamp = generatedAt.slice(0, 10);
  const generatedUtc = generatedAt.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  const subjectPart = safeFilePart(subjectId) || "UNKNOWN";
  const filename = `MYOSHIELD_Report_${subjectPart}_${dateStamp}.md`;
  const textFilename = `MYOSHIELD_Report_${subjectPart}_${dateStamp}.txt`;

  const base: Omit<MissionReport, "markdown" | "plainText"> = {
    reportId: `MYOSHIELD_Report_${subjectPart}_${dateStamp}`,
    baseline,
    generatedAt,
    generatedUtc,
    dateStamp,
    filename,
    textFilename,
    subjectId,
    astronautName: subject?.name ?? crew?.name ?? subjectId,
    astronautRole: crew?.role ?? subject?.type ?? "ISS crew",
    astronautType: subject?.type ?? "Astronaut",
    issModule: crew?.module ?? result?.iss_module ?? "US Lab",
    missionDays: mission?.missionDays ?? null,
    cumulativeDose: mission?.cumulativeDose ?? null,
    missionLabel: crew?.expedition ?? subject?.study ?? "MYOSHIELD demonstration mission",
    datasetName: snapshot?.sourceName ?? result?.filename ?? "No dataset analysed",
    datasetKind: baseline
      ? "No dataset analysed — baseline telemetry snapshot"
      : snapshot?.sourceKind === "library"
        ? "Prepared library dataset"
        : "Uploaded telemetry file",
    analysisId: result?.analysis_id ?? "BASELINE-SNAPSHOT",
    status: baseline
      ? "BASELINE"
      : String(result?.status ?? "NOMINAL").replace(/_/g, " "),
    classification,
    interaction: result?.interaction_type ?? "NOMINAL",
    classificationReason: baseline
      ? "No dataset has been analysed for this astronaut. Baseline vitals and model-ready defaults are shown until the first .joblib inference run."
      : (result?.classification_reason ??
        "Cross-system fusion classified the dataset across all detected health domains."),
    readiness: round(readiness, 1),
    readinessLabel: baseline ? "Baseline crew readiness" : "Mission readiness",
    strain: result ? round(result.integrated_strain_index) : null,
    primaryDomain,
    affectedModule: result?.affected_module || result?.iss_module || crew?.module || "US Lab",
    vitals,
    domains,
    insights: result?.cross_system_insights ?? [],
    protocol: result?.protocol_steps ?? [],
    models,
    confidence: integratedConfidence,
    disclaimer:
      result?.disclaimer ??
      "Baseline snapshot generated without a model run. No diagnostic conclusion may be drawn from these defaults.",
  };

  const markdown = buildMarkdown(base);
  return { ...base, markdown, plainText: toPlainText(markdown) };
}

export function classificationToneFor(classification: string): ReportTone {
  return classificationTone(classification);
}

export function reportFileSlug(report: MissionReport) {
  return `${report.subjectId}_${report.dateStamp}`;
}
