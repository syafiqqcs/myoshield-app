import type { DomainKey, DomainPrediction, DomainStatus, UploadAnalysis } from "./api";
import { DOMAINS, fmtDate, type Domain } from "./data";

/**
 * Scientific limitations stay verbatim under every ML explanation so a live
 * model score is never presented as a diagnosis.
 */
export const DOMAIN_DISCLAIMERS: Record<Domain, string> = {
  radiation:
    "Environmental radiation telemetry is not personal absorbed dose. Individual astronaut exposure cannot be inferred from environmental data alone.",
  musculoskeletal:
    "Gene or protein expression is not a direct measure of muscle strength or function. Mouse proteomics, human tissue-chip RNA-seq and human functional measurements are different evidence types and are kept separate.",
  vestibular:
    "Motion sickness symptoms alone do not establish vestibular dysfunction. Ground-based research data are not astronaut spaceflight data.",
  cardiovascular:
    "Only measurements present in the selected dataset are shown. HRV needs beat-to-beat or ECG data. No real astronaut measurements are available in this prototype.",
};

export function domainStatusFromScore(score: number): DomainStatus {
  if (score >= 0.66) return "ANOMALY_DETECTED";
  if (score >= 0.6) return "ELEVATED";
  return "NOMINAL";
}

export function domainStatusLabel(status: DomainStatus | string): string {
  if (status === "ANOMALY_DETECTED") return "ANOMALY DETECTED";
  if (status === "ELEVATED") return "ELEVATED";
  if (status === "NOMINAL") return "NOMINAL";
  return String(status).replace(/_/g, " ").toUpperCase();
}

export function domainStatusTone(
  status: DomainStatus | string,
): "success" | "warning" | "critical" {
  if (status === "ANOMALY_DETECTED") return "critical";
  if (status === "ELEVATED") return "warning";
  return "success";
}

export function riskPercent(score: number): number {
  return Math.round(Math.min(1, Math.max(0, Number.isFinite(score) ? score : 0)) * 100);
}

export function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  if (diff < 90_000) return "Just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;
  return fmtDate(iso);
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ModuleDetails = Record<string, Record<string, unknown> | undefined>;

function moduleDetails(result: UploadAnalysis): ModuleDetails {
  return (result.module_details ?? {}) as ModuleDetails;
}

function featureNumber(result: UploadAnalysis, domain: DomainKey, key: string): number | undefined {
  const features = moduleDetails(result)[domain]?.features_used as
    | Record<string, unknown>
    | undefined;
  const value = features?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function moduleNumber(result: UploadAnalysis, domain: DomainKey, key: string): number | undefined {
  const value = moduleDetails(result)[domain]?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function fallbackMetric(result: UploadAnalysis, domain: DomainKey, score: number): string {
  if (domain === "radiation") {
    const dose = featureNumber(result, domain, "absorbed_dose_rate");
    if (dose !== undefined) return `${dose.toFixed(2)} mSv/day`;
  }
  if (domain === "musculoskeletal") {
    const stress = moduleNumber(result, domain, "transcriptional_stress_score") ?? score;
    return `${Math.round(stress * 100)}% transcriptional stress`;
  }
  if (domain === "vestibular") {
    const gain = featureNumber(result, domain, "vor_gain_proxy");
    if (gain !== undefined) return `VOR gain ${gain.toFixed(2)}`;
  }
  if (domain === "cardiovascular") {
    const hr = featureNumber(result, domain, "hr_mean");
    const spo2 = featureNumber(result, domain, "spo2_mean");
    if (hr !== undefined && spo2 !== undefined) {
      return `HR ${hr.toFixed(0)} bpm • SpO2 ${spo2.toFixed(0)}%`;
    }
    if (hr !== undefined) return `HR ${hr.toFixed(0)} bpm`;
    if (spo2 !== undefined) return `SpO2 ${spo2.toFixed(0)}%`;
  }
  return `Model score ${score.toFixed(2)}`;
}

/**
 * Prefer the structured `domains` payload from the backend. The fallback keeps
 * older responses working by deriving the same fields from `module_details`.
 */
export function getDomainPrediction(
  result: UploadAnalysis | null | undefined,
  domain: DomainKey,
): DomainPrediction | null {
  if (!result) return null;

  const fromBackend = result.domains?.[domain];
  const rawScore = Number(fromBackend?.risk_score ?? result.domain_scores?.[domain] ?? 0);
  const score = Number.isFinite(rawScore) ? rawScore : 0;
  const status = fromBackend?.status ?? domainStatusFromScore(score);

  return {
    status,
    risk_score: score,
    key_metric: fromBackend?.key_metric ?? fallbackMetric(result, domain, score),
    summary:
      fromBackend?.summary ??
      `The ${DOMAINS[domain].short.toLowerCase()} .joblib model scored this dataset ${score.toFixed(
        2,
      )}, placing it ${score >= 0.66 ? "above the anomaly threshold" : score >= 0.6 ? "at the elevated watch threshold" : "inside the nominal baseline"}.`,
    model_used: fromBackend?.model_used,
    data_provided: fromBackend?.data_provided,
    sub_metrics: fromBackend?.sub_metrics,
    clinical_explanation: fromBackend?.clinical_explanation,
    countermeasures: fromBackend?.countermeasures,
  };
}

export function sourceTypeLabel(
  snapshot: { sourceKind: "upload" | "library"; sourceName: string } | null,
): string {
  if (!snapshot) return "";
  if (snapshot.sourceKind === "library") return "Library dataset";
  return snapshot.sourceName.toLowerCase().endsWith(".json") ? "JSON upload" : "CSV upload";
}
