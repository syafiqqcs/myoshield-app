export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export type DomainKey = "radiation" | "musculoskeletal" | "vestibular" | "cardiovascular";

export type DomainScores = Record<DomainKey, number>;

export type Vitals = {
  spo2: number;
  heartRate: number;
  respiration: number;
  coreTemp: number;
};

export type LiveTelemetry = Vitals & {
  issModule: string;
  interactionMode: string;
};

export type InteractionType = "ADDITIVE" | "ANTAGONISTIC" | "SYNERGISTIC" | string;

export type DomainStatus = "NOMINAL" | "ELEVATED" | "ANOMALY_DETECTED";

/** One labelled reading inside a domain's detailed analysis view. */
export type DomainSubMetric = {
  label: string;
  value: string;
  unit?: string;
  status?: string;
};

/** Real per-domain .joblib output returned by POST /api/health/upload-analyze. */
export type DomainPrediction = {
  status: DomainStatus | string;
  risk_score: number;
  key_metric: string;
  summary: string;
  model_used?: string;
  data_provided?: boolean;
  /** 3–4 domain-specific readings, unique to this physiological system. */
  sub_metrics?: DomainSubMetric[];
  /** Domain-specific paragraph explaining the mechanism behind the score. */
  clinical_explanation?: string;
  /** Domain-specific countermeasures, never shared with another domain. */
  countermeasures?: string[];
};

export type UploadAnalysis = {
  status: "NOMINAL" | "ELEVATED_MONITORING" | "HIGH_STRAIN_ALERT" | string;
  analysis_id: string;
  filename: string;
  interaction_type: InteractionType;
  classification_reason?: string;
  mission_readiness_score: number;
  integrated_strain_index: number;
  base_strain_index?: number;
  synergy_penalty?: number;
  domain_scores: DomainScores;
  domains?: Partial<Record<DomainKey, DomainPrediction>>;
  detected_domains: string[];
  primary_domain: DomainKey | string;
  iss_module: string;
  affected_module: string;
  vitals: {
    spo2: number;
    heart_rate: number;
    respiration: number;
    core_temp: number;
  };
  cross_system_insights: { id: string; title: string; explanation: string }[];
  protocol_steps?: { title: string; detail: string }[];
  records: number;
  columns: string[];
  module_details?: Record<string, unknown>;
  data_mode?: string;
  disclaimer?: string;
};

export type ChatEquipment = {
  name: string;
  icon: string;
  detail?: string;
};

/** The backend returns scenario equipment as plain names; the UI normalises them. */
export type ChatEquipmentEntry = string | ChatEquipment;

export type ChatStep = {
  title: string;
  detail: string;
  timing?: string;
};

/** Astronaut profile attached to every emergency-chat request. */
export type ChatAstronaut = {
  id: string;
  name: string;
  role: string;
  issModule: string;
};

/** One prior turn of the conversation, sent as context with each request. */
export type ChatHistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  reply: string;
  telemetry_alert: string;
  equipment: ChatEquipmentEntry[];
  steps: ChatStep[];
  severity?: "CRITICAL" | "URGENT" | "ADVISORY" | string;
  domain?: string;
  scenario?: string;
  status?: string;
  astronaut?: { id?: string; name?: string; role?: string; iss_module?: string };
  disclaimer?: string;
  offline?: boolean;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) return body.detail;
  } catch {
    // Fall through to a generic message.
  }
  return `Request failed (${response.status} ${response.statusText})`;
}

export type ModelStatusEntry = {
  key: string;
  name: string;
  filename: string;
  kind: string;
  feature_count: number;
  features: string[];
  loaded: boolean;
};

export type ModelStatusResponse = {
  status: string;
  online: boolean;
  badge: string;
  count: number;
  all_expected_loaded: boolean;
  missing: string[];
  model_names: string[];
  models: ModelStatusEntry[];
  checked_at: string;
};

export type LibraryRecord = Record<string, string | number | null>;

export type LibraryDataset = {
  id: string;
  name: string;
  description: string;
  source: string;
  domains: DomainKey[];
  category: "baseline" | "anomaly" | "critical" | string;
  expected_severity: string;
  file_name: string;
  limitation: string;
  record_count: number;
  columns: string[];
  model_keys: string[];
  models: string[];
  records: LibraryRecord[];
  data_mode?: string;
  disclaimer?: string;
  expected_outcome?: {
    status: string;
    interaction_type: string;
    classification_reason?: string;
    primary_domain: string;
    domain_scores: DomainScores;
    mission_readiness_score: number;
    integrated_strain_index: number;
    detected_domains: string[];
  } | null;
};

export async function fetchDatasetLibrary(): Promise<LibraryDataset[]> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/library`);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { datasets: LibraryDataset[] };
  return body.datasets ?? [];
}

export async function fetchModelStatus(): Promise<ModelStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health/models-status`);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as ModelStatusResponse;
}

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recordsToCsv(records: LibraryRecord[], columns?: string[]): string {
  const header = columns ?? Object.keys(records[0] ?? {});
  const lines = [header.map(escapeCsv).join(",")];
  records.forEach((record) => lines.push(header.map((key) => escapeCsv(record[key])).join(",")));
  return lines.join("\n");
}

/**
 * Ask the backend for the exact CSV it prepared, so the selected library
 * dataset is uploaded through the same parser the model inference uses.
 * Falls back to serialising the preview rows if the download is unavailable.
 */
export async function libraryDatasetFile(dataset: LibraryDataset): Promise<File> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/datasets/library/${encodeURIComponent(dataset.id)}/download`,
    );
    if (response.ok) {
      const text = await response.text();
      if (text.trim()) return new File([text], dataset.file_name, { type: "text/csv" });
    }
  } catch {
    // Fall back to the rows delivered by the library list endpoint.
  }
  return new File([recordsToCsv(dataset.records, dataset.columns)], dataset.file_name, {
    type: "text/csv",
  });
}

export async function analyzeHealthUpload(file: File): Promise<UploadAnalysis> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/health/upload-analyze`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as UploadAnalysis;
}

export type AskFlightSurgeonOptions = {
  /** The last four messages, oldest first, sent so the reply can be context-aware. */
  conversationHistory?: ChatHistoryEntry[];
  /** Name, ID, role and ISS module of the astronaut being consulted. */
  astronaut?: ChatAstronaut | null;
  /** The astronaut's latest real .joblib result (all four domain scores + metrics). */
  analysisResult?: UploadAnalysis | null;
};

export async function askFlightSurgeon(
  message: string,
  telemetry: LiveTelemetry,
  options: AskFlightSurgeonOptions = {},
): Promise<ChatResponse> {
  const { conversationHistory = [], astronaut = null, analysisResult = null } = options;
  const response = await fetch(`${API_BASE_URL}/api/chat/emergency`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory.slice(-4),
      astronaut,
      liveTelemetry: telemetry,
      // Backwards-compatible alias for older backend builds.
      telemetry,
      analysisResult,
      analysis_result: analysisResult,
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as ChatResponse;
}

/**
 * A deliberately abnormal multi-system upload. It exercises the real CSV/JSON
 * parsing and the .joblib models, then trips the cross-system synergy rules.
 */
export function makeSampleAnomalyFile(): File {
  const payload = {
    astronaut_id: "AST-01",
    iss_module: "US Lab",
    heart_rate_bpm: 134,
    spo2_pct: 87,
    resp_rate_bpm: 29,
    hrv_rmssd_ms: 11,
    hrv_sdnn_ms: 14,
    body_temp_c: 38.4,
    head_vel_hor_std: 82,
    head_vel_ver_std: 9.8,
    head_acc_hor_rms: 2.9,
    eye_vel_hor_std: 210,
    eye_vel_ver_std: 64,
    eye_peak_vel_p95: 280,
    vor_gain_proxy: 0.34,
    eye_head_corr: -0.06,
    eye_to_head_rms_ratio: 4.1,
    absorbed_dose_rate: 27.4,
    rolling_mean_7d: 12.6,
    dose_delta_1d: 5.1,
    instrument: "RAD",
    module: "US Lab",
    condition: "Space_Flight",
    age_group: "Young_21_40",
  };
  return new File([JSON.stringify(payload, null, 2)], "sample_anomaly_synergistic.json", {
    type: "application/json",
  });
}
