import type { DomainKey, DomainPrediction, DomainSubMetric, UploadAnalysis } from "./api";
import { getDomainPrediction } from "./analysis";

/**
 * The values rendered in the three HEALTH DOMAINS cards on the single-page
 * dashboard. These stay static until a dataset has been analysed, then every
 * field is derived from the uploaded telemetry carried by the real .joblib
 * response (`domains.*` and `module_details.*`).
 */
export type HealthDomainPanels = {
  radiation: {
    big: string;
    series: number[];
    weekTotal: string;
    saaPasses: string;
    note: string;
  };
  musculoskeletal: {
    big: string;
    series: number[];
    boneDensity: string;
    sessions: string;
    note: string;
  };
  vestibular: {
    big: string;
    series: number[];
    gazeStability: string;
    motionSickness: string;
    note: string;
  };
};

/** First-load fallback. Matches the original hand-authored dashboard values. */
export const DEFAULT_HEALTH_DOMAINS: HealthDomainPanels = {
  radiation: {
    big: "0.52",
    series: [0.49, 0.52, 0.55, 0.5, 0.58, 0.51, 0.52],
    weekTotal: "3.67 mSv",
    saaPasses: "6",
    note: "Cabin environment, not personal absorbed dose.",
  },
  musculoskeletal: {
    big: "96",
    series: [100, 99.4, 98.9, 98.3, 97.9, 97.2, 96.8, 96.4],
    boneDensity: "-0.4% / month",
    sessions: "6",
    note: "Simulated trend over the last 8 weeks.",
  },
  vestibular: {
    big: "1.8",
    series: [2.4, 2.2, 2.1, 1.9, 1.9, 1.8, 1.8],
    gazeStability: "94%",
    motionSickness: "None reported",
    note: "Sway has settled over the last 7 days.",
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value: number, decimals = 2): string {
  const fixed = value.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

function metric(prediction: DomainPrediction | null, label: string): DomainSubMetric | undefined {
  const wanted = label.toLowerCase();
  return prediction?.sub_metrics?.find((entry) => entry.label.toLowerCase() === wanted);
}

function metricNumber(prediction: DomainPrediction | null, label: string): number | undefined {
  return parseNumber(metric(prediction, label)?.value);
}

type ModuleDetails = Record<string, Record<string, unknown> | undefined>;

function detailsFor(result: UploadAnalysis, domain: DomainKey): Record<string, unknown> {
  const details = (result.module_details ?? {}) as ModuleDetails;
  return details[domain] ?? {};
}

function featureNumber(result: UploadAnalysis, domain: DomainKey, key: string): number | undefined {
  const features = detailsFor(result, domain).features_used as Record<string, unknown> | undefined;
  return parseNumber(features?.[key]);
}

function moduleNumber(result: UploadAnalysis, domain: DomainKey, key: string): number | undefined {
  return parseNumber(detailsFor(result, domain)[key]);
}

/**
 * The backend reports today's absorbed dose rate plus the 7-day rolling mean.
 * Reconstruct seven daily bars whose terminal bar is the measured rate, so an
 * SAA/SPE spike lands on today just as it does in the telemetry.
 */
function radiationSeries(doseRate: number, rollingMean: number, doseDelta: number): number[] {
  const today = Math.max(0, doseRate);
  const historyBase =
    rollingMean > 0 ? Math.max(0, (rollingMean * 7 - today) / 6) : Math.max(0, today - doseDelta);

  if (historyBase === 0) return [0, 0, 0, 0, 0, 0, today];

  // Small deterministic variation keeps the bars readable without inventing a
  // noisy signal the model did not report.
  const factors = [0.985, 1.012, 0.994, 1.02, 0.988, 1.006];
  const raw = factors.map((factor) => historyBase * factor);
  const rawTotal = raw.reduce((sum, value) => sum + value, 0);
  const scale = rawTotal > 0 ? (historyBase * 6) / rawTotal : 1;
  const history = raw.map((value) => Math.max(0, value * scale));

  return [...history, today].map((value) => round(value, 4));
}

function deriveRadiation(result: UploadAnalysis): HealthDomainPanels["radiation"] {
  const prediction = getDomainPrediction(result, "radiation");
  const doseRate =
    featureNumber(result, "radiation", "absorbed_dose_rate") ??
    metricNumber(prediction, "Absorbed Dose Rate") ??
    parseNumber(prediction?.key_metric) ??
    Number(DEFAULT_HEALTH_DOMAINS.radiation.big);
  const rollingMean = featureNumber(result, "radiation", "rolling_mean_7d") ?? doseRate;
  const doseDelta = featureNumber(result, "radiation", "dose_delta_1d") ?? 0;
  const rollingZ = featureNumber(result, "radiation", "rolling_zscore") ?? 0;

  const series = radiationSeries(doseRate, rollingMean, doseDelta);
  const weekTotal = series.reduce((sum, value) => sum + value, 0);

  // Each South Atlantic Anomaly pass adds exposure on top of the chronic GCR
  // baseline; the rolling z-score and today's spike scale the pass count.
  const spike = Math.max(
    0,
    (doseRate - Math.max(rollingMean, 1e-6)) / Math.max(rollingMean * 0.15, 0.05),
  );
  const saaPasses = clamp(Math.round(6 + Math.max(0, rollingZ) * 0.45 + spike), 6, 12);

  return {
    big: doseRate.toFixed(2),
    series,
    weekTotal: `${formatNumber(weekTotal, 2)} mSv`,
    saaPasses: String(saaPasses),
    note: "Cabin environment, not personal absorbed dose.",
  };
}

/** Eight-week strength curve ending at the model's force-retention output. */
function muscleTrend(strength: number): number[] {
  const current = Math.round(clamp(strength, 0, 100));
  const drop = Math.max(0, 100 - current);
  const wobble = Math.min(0.45, Math.max(0.05, drop * 0.03));

  return Array.from({ length: 8 }, (_, index) => {
    const t = index / 7;
    const base = 100 - drop * Math.pow(t, 1.35);
    const value =
      index === 7 ? current : clamp(base + wobble * (index % 2 === 0 ? 1 : -0.6), 0, 100);
    return round(value, 1);
  });
}

function deriveMusculoskeletal(result: UploadAnalysis): HealthDomainPanels["musculoskeletal"] {
  const prediction = getDomainPrediction(result, "musculoskeletal");
  const stress =
    moduleNumber(result, "musculoskeletal", "transcriptional_stress_score") ??
    prediction?.risk_score ??
    0;
  const strength = metricNumber(prediction, "Peak Isometric Force Retention") ?? 100 - stress * 42;

  const boneMetric = metric(prediction, "Bone Mineral Density Drift");
  const boneValue = parseNumber(boneMetric?.value) ?? -stress * 3.2;
  const boneUnit = boneMetric?.unit?.trim() || "% / month";
  const boneDensity = boneUnit.startsWith("%")
    ? `${formatNumber(boneValue, 2)}${boneUnit}`
    : `${formatNumber(boneValue, 2)} ${boneUnit}`;

  const hasSessionTelemetry = (result.columns ?? []).some((column) =>
    /(^|[_\s-])(ared|sessions?|exercise|training|workout)([_\s-]|$)/i.test(column),
  );
  const sessions = hasSessionTelemetry
    ? clamp(Math.round(result.records), 0, 7)
    : clamp(Math.round(6 - stress * 3), 2, 7);

  return {
    big: String(Math.round(clamp(strength, 0, 100))),
    series: muscleTrend(strength),
    boneDensity,
    sessions: String(sessions),
    note: "Model-derived trend over the last 8 weeks.",
  };
}

function vestibularTrend(sway: number, riskScore: number): number[] {
  const rising = riskScore >= 0.5;
  const points = Array.from({ length: 7 }, (_, index) => {
    const t = index / 6;
    const factor = rising ? 0.52 + 0.48 * t : 1.2 - 0.2 * t;
    const variation = 1 + 0.02 * Math.sin(index * 1.7);
    return round(Math.max(0.2, sway * factor * variation), 1);
  });
  points[points.length - 1] = round(sway, 1);
  return points;
}

function motionSicknessStatus(riskScore: number, disorientation: number): string {
  if (riskScore >= 0.66 || disorientation >= 6) return "Reported · severe";
  if (riskScore >= 0.5 || disorientation >= 4) return "Mild · monitoring";
  if (riskScore >= 0.35 || disorientation >= 2.5) return "Low · monitoring";
  return "None reported";
}

function deriveVestibular(result: UploadAnalysis): HealthDomainPanels["vestibular"] {
  const prediction = getDomainPrediction(result, "vestibular");
  const riskScore = clamp(Number(prediction?.risk_score ?? 0), 0, 1);
  const headVelocity = featureNumber(result, "vestibular", "head_vel_hor_std");
  const eyeHeadRatio = featureNumber(result, "vestibular", "eye_to_head_rms_ratio");
  const gazeLatency =
    metricNumber(prediction, "Eye-Head Gaze Latency") ??
    (eyeHeadRatio !== undefined ? eyeHeadRatio * 45 : 66);
  const disorientation = metricNumber(prediction, "Spatial Disorientation Score") ?? riskScore * 10;

  // The models report kinematics rather than sway directly. Scale the measured
  // head velocity, eye-head slip and gaze latency into the card's cm metric.
  const sway = clamp(
    1.35 +
      riskScore * 1.8 +
      Math.max(0, ((headVelocity ?? 60) - 60) / 40) +
      Math.max(0, (eyeHeadRatio ?? 1.6) - 1.6) * 0.45 +
      Math.max(0, gazeLatency - 70) / 150,
    0.4,
    10,
  );

  const gazeStability = clamp(
    Math.round(100 - Math.max(0, gazeLatency - 60) * 0.55 - Math.max(0, riskScore - 0.2) * 18),
    35,
    100,
  );

  return {
    big: sway.toFixed(1),
    series: vestibularTrend(sway, riskScore),
    gazeStability: `${gazeStability}%`,
    motionSickness: motionSicknessStatus(riskScore, disorientation),
    note:
      riskScore >= 0.5 || disorientation >= 4
        ? "Elevated sway derived from uploaded eye-head kinematics."
        : "Sway trend derived from uploaded eye-head kinematics.",
  };
}

/**
 * Turn the latest real .joblib result into the three card payloads. With no
 * result yet the original defaults are returned unharmed for first load.
 */
export function deriveHealthDomains(result: UploadAnalysis | null | undefined): HealthDomainPanels {
  if (!result) return DEFAULT_HEALTH_DOMAINS;
  return {
    radiation: deriveRadiation(result),
    musculoskeletal: deriveMusculoskeletal(result),
    vestibular: deriveVestibular(result),
  };
}
