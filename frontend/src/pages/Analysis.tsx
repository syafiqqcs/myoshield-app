import { useEffect, useMemo, useRef, useState } from "react";
import { isCriticalAnalysis, useApp } from "../lib/store";
import {
  DOMAINS,
  MODELS,
  UNITS,
  fmtDate,
  isNum,
  parseCSV,
  type Analysis,
  type Dataset,
  type Domain,
} from "../lib/data";
import {
  analyzeHealthUpload,
  fetchDatasetLibrary,
  fetchModelStatus,
  libraryDatasetFile,
  makeSampleAnomalyFile,
  recordsToCsv,
  type LibraryDataset,
  type ModelStatusEntry,
  type ModelStatusResponse,
  type UploadAnalysis,
} from "../lib/api";
import {
  Badge,
  Btn,
  Callout,
  Card,
  ChartCard,
  Field,
  Icon,
  LineChart,
  PageTitle,
} from "../components/ui";

const STEPS = [
  "Data source",
  "Health domain",
  "Dataset or file",
  "Subject or study",
  "Preview",
  "Validate",
  "Model",
  "Run",
  "Progress",
  "Results",
];

type Scope = Domain | "all";

/** Stressor badges shown on prepared-dataset cards. */
const STRESSOR_LABEL: Record<Domain, string> = {
  radiation: "SPE RADIATION",
  musculoskeletal: "MICROGRAVITY ATROPHY",
  vestibular: "VESTIBULAR DECONDITIONING",
  cardiovascular: "CARDIO FLUID SHIFT",
};
const STRESSOR_COLOR: Record<Domain, string> = {
  radiation: "#4DA3FF",
  musculoskeletal: "#FFCC00",
  vestibular: "#9B8CFF",
  cardiovascular: "#F2B84B",
};

const DOMAIN_KEYS = Object.keys(DOMAINS) as Domain[];

/** Mirrors the backend's recognised column aliases so the wizard validates honestly. */
const ALIASES: Record<Domain, string[]> = {
  radiation: [
    "absorbed_dose_rate",
    "radiation_measurement",
    "dose_rate",
    "absorbed_dose",
    "radiation",
  ],
  cardiovascular: [
    "heart_rate_bpm",
    "hr_mean",
    "heart_rate",
    "heartrate",
    "hr_bpm",
    "hr",
    "spo2_pct",
    "spo2_mean",
    "spo2",
    "oxygen_saturation",
    "resp_rate_bpm",
    "resp_mean",
    "respiration",
    "respiratory_rate",
    "hrv_rmssd_ms",
    "hrv_rmssd",
    "rmssd",
    "hrv_sdnn_ms",
    "hrv_sdnn",
    "sdnn",
  ],
  vestibular: [
    "head_vel_hor_std",
    "head_vel_ver_std",
    "head_acc_hor_rms",
    "eye_vel_hor_std",
    "eye_vel_ver_std",
    "eye_peak_vel_p95",
    "vor_gain_proxy",
    "eye_head_corr",
    "eye_to_head_rms_ratio",
  ],
  musculoskeletal: ["condition", "age_group", "feature_id", "expression", "gene", "gene_symbol"],
};

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

function detectDomains(columns: string[]): Domain[] {
  const present = new Set(columns.map(normalise));
  return DOMAIN_KEYS.filter((domain) =>
    ALIASES[domain].some((alias) => present.has(normalise(alias))),
  );
}

function flattenRecord(value: unknown, prefix = "", out: Record<string, string> = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === "object" && !Array.isArray(child)) {
        flattenRecord(child, path, out);
      } else {
        out[path] =
          child === null || child === undefined
            ? ""
            : Array.isArray(child)
              ? child.join("|")
              : String(child);
      }
    });
  }
  return out;
}

/** Browser-side preview parser. Inference itself always happens on the backend. */
function parsePreview(name: string, text: string) {
  if (name.toLowerCase().endsWith(".json")) {
    const payload = JSON.parse(text) as unknown;
    let list: unknown[];
    if (Array.isArray(payload)) list = payload;
    else if (payload && typeof payload === "object") {
      const object = payload as Record<string, unknown>;
      const listKey = ["data", "records", "rows", "samples", "telemetry", "readings"].find((key) =>
        Array.isArray(object[key]),
      );
      list = listKey ? (object[listKey] as unknown[]) : [object];
    } else {
      throw new Error("JSON root must be an object or an array of objects.");
    }
    const flattened = list.map((item) => flattenRecord(item));
    const columns = Array.from(new Set(flattened.flatMap((row) => Object.keys(row))));
    return {
      columns,
      rows: flattened.map((row) =>
        Object.fromEntries(columns.map((column) => [column, row[column] ?? ""])),
      ),
    };
  }
  return parseCSV(text);
}

function libraryToDataset(dataset: LibraryDataset, scope: Scope | null): Dataset {
  const rows = dataset.records.map((record) =>
    Object.fromEntries(
      dataset.columns.map((column) => [
        column,
        record[column] === null || record[column] === undefined ? "" : String(record[column]),
      ]),
    ),
  );
  const expectedPrimary = dataset.expected_outcome?.primary_domain;
  const domain: Domain =
    scope && scope !== "all"
      ? scope
      : expectedPrimary && DOMAIN_KEYS.includes(expectedPrimary as Domain)
        ? (expectedPrimary as Domain)
        : ((dataset.domains.find((key) => DOMAIN_KEYS.includes(key)) ??
            "cardiovascular") as Domain);
  return {
    id: dataset.id,
    name: dataset.name,
    source: dataset.source,
    domain,
    population: "Prepared ISS demonstration cohort",
    populationKind: domain === "radiation" ? "Environment" : "Human (flight crew)",
    origin: "Research dataset",
    format: "CSV",
    records: `${dataset.record_count} rows`,
    variables: dataset.columns,
    methods: dataset.models,
    suitable: `Expected outcome: ${dataset.expected_severity}`,
    limitation: dataset.limitation,
    description: dataset.description,
    citation: dataset.source,
    quality: `${dataset.record_count} rows · ${dataset.columns.length} columns · ${dataset.data_mode ?? "prepared"}`,
    modelIds: MODELS.filter((model) => model.domain === domain).map((model) => model.id),
    uploaded: {
      columns: dataset.columns,
      rows,
      size: dataset.records.length ? recordsToCsv(dataset.records, dataset.columns).length : 0,
      fileName: dataset.file_name,
      addedAt: new Date().toISOString(),
    },
  };
}

function computeStats(columns: string[], rows: Record<string, string>[]) {
  return columns
    .map((column) => {
      const values = rows.map((row) => row[column] ?? "");
      const nums = values.filter(isNum).map(Number);
      return {
        col: column,
        unit: UNITS[column] ?? "",
        n: nums.length,
        missing: values.length - values.filter((value) => value !== "").length,
        min: nums.length ? Math.min(...nums) : undefined,
        max: nums.length ? Math.max(...nums) : undefined,
        mean: nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : undefined,
      };
    })
    .filter((stat) => stat.n > 0)
    .slice(0, 12);
}

function computeSeries(columns: string[], rows: Record<string, string>[]) {
  return columns
    .filter((column) => rows.some((row) => isNum(row[column] ?? "")))
    .slice(0, 5)
    .map((column) => ({
      col: column,
      points: rows
        .map((row, index) => [index, Number(row[column])] as [number, number])
        .filter(([, value]) => Number.isFinite(value))
        .slice(0, 200),
    }))
    .filter((series) => series.points.length >= 2);
}

function statusTone(status: string): "info" | "warn" | "error" | "ok" {
  if (status === "HIGH_STRAIN_ALERT") return "error";
  if (status === "ELEVATED_MONITORING") return "warn";
  if (status === "NOMINAL") return "ok";
  return "info";
}

function statusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function detailNumber(detail: Record<string, unknown>, key: string) {
  const value = detail[key];
  return typeof value === "number" ? value : undefined;
}

function detailText(detail: Record<string, unknown>, key: string) {
  const value = detail[key];
  return typeof value === "string" ? value : undefined;
}

export default function AnalysisPage() {
  const {
    datasets,
    addDataset,
    subjects,
    subjectId,
    addAnalysis,
    addReport,
    go,
    openReport,
    focusDataset,
    role,
    notify,
    publishAnalysis,
    setAnomalyOpen,
  } = useApp();

  const [step, setStep] = useState(0);
  const [source, setSource] = useState<"upload" | "library" | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [ds, setDs] = useState<Dataset | null>(null);
  const [lib, setLib] = useState<LibraryDataset | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [subj, setSubj] = useState(subjectId);
  const [prog, setProg] = useState(0);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<UploadAnalysis | null>(null);
  const [runError, setRunError] = useState("");
  const [up, setUp] = useState<{ name: string; size: number; pct: number; err: string }>({
    name: "",
    size: 0,
    pct: 0,
    err: "",
  });
  const [drag, setDrag] = useState(false);
  const [library, setLibrary] = useState<LibraryDataset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const [models, setModels] = useState<ModelStatusResponse | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const handledFocus = useRef<string | null>(null);

  const loadLibrary = async () => {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      setLibrary(await fetchDatasetLibrary());
    } catch (error) {
      setLibraryError(
        error instanceof Error ? error.message : "Could not load the dataset library.",
      );
    } finally {
      setLibraryLoading(false);
    }
  };

  const loadModels = async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      setModels(await fetchModelStatus());
    } catch (error) {
      setModelsError(
        error instanceof Error ? error.message : "Could not reach the model registry.",
      );
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();
    void loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A link from a domain page can preselect a prepared library dataset.
  useEffect(() => {
    if (!focusDataset) {
      handledFocus.current = null;
      return;
    }
    if (handledFocus.current === focusDataset) return;
    const prepared = library.find((dataset) => dataset.id === focusDataset);
    if (prepared) {
      const expected = prepared.expected_outcome?.primary_domain;
      const nextScope: Scope =
        expected && DOMAIN_KEYS.includes(expected as Domain) ? (expected as Domain) : "all";
      setSource("library");
      setScope(nextScope);
      setLib(prepared);
      setFile(null);
      setDs(libraryToDataset(prepared, nextScope));
      setStep(3);
      handledFocus.current = focusDataset;
      return;
    }
    const stored = datasets.find((dataset) => dataset.id === focusDataset && dataset.uploaded);
    if (stored) {
      setSource("upload");
      setScope(stored.domain);
      setDs(stored);
      setLib(null);
      setFile(null);
      setStep(3);
      handledFocus.current = focusDataset;
    }
  }, [focusDataset, library, datasets]);

  const detected = useMemo(() => detectDomains(ds?.uploaded?.columns ?? []), [ds]);
  const subjOptions = role === "Astronaut" ? subjects.filter((s) => s.owner) : subjects;

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!ds) errors.push("Choose a dataset or upload a file.");
    if (ds && !ds.uploaded) errors.push("No rows are loaded for this dataset.");
    if (ds?.uploaded && ds.uploaded.rows.length === 0)
      errors.push("The dataset contains a header but no data rows.");
    if (scope === "all") {
      if (detected.length < 2)
        errors.push(
          "The multi-stressor scope needs at least two recognised health domains. Add another domain's columns or choose a single-domain analysis.",
        );
    } else if (scope) {
      if (!detected.includes(scope))
        errors.push(
          `No ${DOMAINS[scope].short.toLowerCase()} columns were recognised. Include one of: ${ALIASES[scope].join(", ")}.`,
        );
      if (detected.length > 1)
        warnings.push(
          `This file also contains ${detected
            .filter((domain) => domain !== scope)
            .map((domain) => DOMAINS[domain].short)
            .join(", ")} columns. The backend still scores every detected domain.`,
        );
    }
    if (!source) errors.push("Select a data source.");
    return { ok: errors.length === 0, errors, warnings };
  }, [ds, scope, detected, source]);

  const relevantModels = useMemo<ModelStatusEntry[]>(() => {
    if (!models) return [];
    if (!scope || scope === "all") return models.models;
    return models.models.filter((model) => model.key === scope || model.key === "integrated");
  }, [models, scope]);

  const modelsReady = relevantModels.length > 0 && relevantModels.every((model) => model.loaded);

  const applyUpload = (
    fileName: string,
    size: number,
    parsed: { columns: string[]; rows: Record<string, string>[] },
  ) => {
    if (!parsed.columns.length || parsed.columns.every((column) => !column)) {
      setUp({ name: fileName, size, pct: 0, err: "The file has no header row." });
      return;
    }
    const fileDomains = detectDomains(parsed.columns);
    const domain: Domain = scope && scope !== "all" ? scope : (fileDomains[0] ?? "cardiovascular");
    const id = `UPLOAD-${fileName
      .replace(/\.(csv|json)$/i, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .slice(0, 18)}`;
    const next: Dataset = {
      id,
      name: fileName,
      source: "User upload",
      domain,
      population: "Defined by uploader",
      populationKind: "User upload",
      origin: "User upload",
      format: fileName.toLowerCase().endsWith(".json") ? "JSON" : "CSV",
      records: `${parsed.rows.length} rows`,
      variables: parsed.columns,
      methods: [],
      suitable: "As described by uploader",
      limitation:
        "Provenance and units are supplied by the uploader and have not been independently verified.",
      description: `Uploaded file ${fileName}.`,
      citation: "Uploaded by user. Add provenance to your report.",
      quality: `${parsed.rows.length} rows, ${parsed.columns.length} columns. See validation for missing values.`,
      modelIds: MODELS.filter((model) => fileDomains.includes(model.domain)).map(
        (model) => model.id,
      ),
      uploaded: {
        columns: parsed.columns,
        rows: parsed.rows,
        size,
        fileName,
        addedAt: new Date().toISOString(),
      },
    };
    setDs(next);
    setUp({ name: fileName, size, pct: 100, err: "" });
  };

  const onFile = async (selected?: File) => {
    if (!selected) return;
    const lower = selected.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".json")) {
      setUp({
        name: selected.name,
        size: selected.size,
        pct: 0,
        err: "Unsupported format. Upload a .csv or .json file.",
      });
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setUp({
        name: selected.name,
        size: selected.size,
        pct: 0,
        err: "File is larger than 20 MB.",
      });
      return;
    }
    setUp({ name: selected.name, size: selected.size, pct: 8, err: "" });
    const timer = window.setInterval(
      () => setUp((state) => (state.pct < 90 ? { ...state, pct: state.pct + 14 } : state)),
      80,
    );
    try {
      const text = await selected.text();
      const parsed = parsePreview(selected.name, text);
      window.clearInterval(timer);
      setFile(selected);
      setLib(null);
      applyUpload(selected.name, selected.size, parsed);
    } catch (error) {
      window.clearInterval(timer);
      setUp({
        name: selected.name,
        size: selected.size,
        pct: 0,
        err: error instanceof Error ? error.message : "Could not parse the file.",
      });
    }
  };

  const pickLibrary = (dataset: LibraryDataset) => {
    const next = libraryToDataset(dataset, scope);
    setLib(dataset);
    setFile(null);
    setDs(next);
    setUp({ name: dataset.file_name, size: 0, pct: 100, err: "" });
    notify(`${dataset.id} selected`);
  };

  const reset = () => {
    setStep(0);
    setSource(null);
    setScope(null);
    setDs(null);
    setLib(null);
    setFile(null);
    setProg(0);
    setResult(null);
    setRunError("");
    setUp({ name: "", size: 0, pct: 0, err: "" });
  };

  const buildUploadFile = async () => {
    if (source === "library" && lib) return libraryDatasetFile(lib);
    if (file) return file;
    if (ds?.uploaded) {
      return new File([recordsToCsv(ds.uploaded.rows, ds.uploaded.columns)], ds.uploaded.fileName, {
        type: "text/csv",
      });
    }
    throw new Error("No dataset is available to analyse.");
  };

  const finish = (analysis: UploadAnalysis, dataset: Dataset) => {
    const primaryDomain: Domain = DOMAIN_KEYS.includes(analysis.primary_domain as Domain)
      ? (analysis.primary_domain as Domain)
      : "cardiovascular";
    const summary = `${statusLabel(analysis.status)} · ${analysis.interaction_type}. ${
      analysis.classification_reason ??
      "Cross-system fusion classified the uploaded dataset across all detected domains."
    } Department risk scores: ${DOMAIN_KEYS.map(
      (domain) =>
        `${DOMAINS[domain].short} ${Number(analysis.domain_scores[domain] ?? 0).toFixed(2)}`,
    ).join(", ")}.`;

    if (dataset.uploaded) {
      const record: Analysis = {
        id: analysis.analysis_id,
        date: new Date().toISOString(),
        datasetId: dataset.id,
        datasetName: dataset.name,
        domain: primaryDomain,
        modelId: "integrated",
        modelName: "MYOSHIELD Integrated Health Intelligence v1",
        subjectId: subj || dataset.id,
        mode: "uploaded",
        status: "Complete",
        variables: analysis.columns?.length ? analysis.columns : dataset.uploaded.columns,
        stats: computeStats(dataset.uploaded.columns, dataset.uploaded.rows),
        series: computeSeries(dataset.uploaded.columns, dataset.uploaded.rows),
        note: summary,
      };
      addAnalysis(record);
      if (!datasets.some((existing) => existing.id === dataset.id)) addDataset(dataset);
    }

    setResult(analysis);
    setProg(100);
    setStage("Result ready");
    setStep(9);
    publishAnalysis(analysis, {
      sourceName:
        source === "library" ? dataset.name : (dataset.uploaded?.fileName ?? dataset.name),
      sourceKind: source === "library" ? "library" : "upload",
      subjectId: subj || dataset.id,
    });
    notify(
      `${analysis.analysis_id}: ${statusLabel(analysis.status)} · ${analysis.interaction_type}`,
    );
  };

  const run = async () => {
    if (!ds || !validation.ok) return;
    setRunError("");
    setResult(null);
    setStep(8);
    setProg(0);
    setStage("Uploading dataset to the inference service");
    let progress = 0;
    const timer = window.setInterval(() => {
      progress = Math.min(94, progress + 3 + Math.random() * 5);
      setProg(Math.round(progress));
      if (progress < 24) setStage("Uploading dataset to the inference service");
      else if (progress < 46) setStage("Parsing rows and resolving recognised columns");
      else if (progress < 70)
        setStage("Scoring radiation · cardiovascular · vestibular · musculoskeletal");
      else if (progress < 92) setStage("Fusing domain scores and checking synergy rules");
      else setStage("Finalising the result");
    }, 120);

    const started = Date.now();
    try {
      const upload = await buildUploadFile();
      const analysis = await analyzeHealthUpload(upload);
      const remaining = 1500 - (Date.now() - started);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      window.clearInterval(timer);
      finish(analysis, ds);
    } catch (error) {
      window.clearInterval(timer);
      setProg(0);
      setRunError(error instanceof Error ? error.message : "The analysis request failed.");
      setStep(7);
    }
  };

  const canNext = [
    !!source,
    !!scope,
    !!ds,
    !!subj,
    !!ds?.uploaded,
    validation.ok,
    modelsReady,
    false,
    false,
    false,
  ][step];

  const next = () => {
    if (step === 2 && ds?.uploaded) setSubj(subjectId);
    setStep(step + 1);
  };

  const libraryOptions = useMemo(() => {
    if (!scope) return library;
    if (scope === "all") return library.filter((dataset) => dataset.domains.length >= 2);
    return library.filter((dataset) => dataset.domains.includes(scope));
  }, [library, scope]);

  const scopeLabel = scope
    ? scope === "all"
      ? "All Multi-Stressor Models"
      : DOMAINS[scope].label
    : "—";

  const Big = ({
    kind,
    icon,
    title,
    description,
  }: {
    kind: "upload" | "library";
    icon: "upload" | "database";
    title: string;
    description: string;
  }) => (
    <button
      onClick={() => {
        setSource(kind);
        setDs(null);
        setLib(null);
        setFile(null);
        setUp({ name: "", size: 0, pct: 0, err: "" });
      }}
      className={`hud-panel flex flex-1 flex-col items-start gap-3 rounded-[2px] border bg-[#121214] p-7 text-left transition ${
        source === kind
          ? "border-[#FFCC00] bg-[#FFCC00]/[0.06]"
          : "border-white/[0.08] hover:border-[#FFCC00]/45"
      }`}
    >
      <span
        className={`grid h-12 w-12 place-items-center rounded-full ${
          source === kind
            ? "bg-[#FFCC00] text-[#0B0B0C]"
            : "border border-[#FFCC00]/40 text-[#FFCC00]"
        }`}
      >
        <Icon name={icon} size={22} />
      </span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#6E6E73]">
        Option {kind === "upload" ? "A" : "B"}
      </span>
      <span className="serif text-[30px] leading-none">{title}</span>
      <span className="text-[14px] text-muted">{description}</span>
    </button>
  );

  return (
    <div className="rise">
      <PageTitle
        kicker="CORE WORKFLOW"
        title="Start new analysis"
        desc="Select real data, validate it against the loaded .joblib models, run inference, then review the result."
        actions={
          <Badge
            tone={modelsLoading ? "neutral" : models?.all_expected_loaded ? "success" : "warning"}
          >
            {modelsLoading
              ? "Checking model registry…"
              : models
                ? models.badge
                : "Model registry offline"}
          </Badge>
        }
      />

      <ol
        className="no-scrollbar mb-10 flex items-start overflow-x-auto pb-1"
        aria-label="Progress"
      >
        {STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li
              key={label}
              className="relative flex min-w-[64px] flex-1 flex-col items-center"
              title={label}
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-[13px] -z-0 h-px w-full -translate-y-1/2 ${
                    done || active ? "bg-[#FFCC00]/45" : "bg-[rgba(255,255,255,0.08)]"
                  }`}
                />
              )}
              <span
                className={`font-mono relative z-10 grid h-[26px] w-[26px] place-items-center rounded-full border text-[9.5px] tabular-nums transition ${
                  active
                    ? "border-[#FFCC00] bg-[#FFCC00] text-[#0B0B0C]"
                    : done
                      ? "border-[#FFCC00]/50 bg-[#FFCC00]/12 text-[#FFCC00]"
                      : "border-[rgba(255,255,255,0.08)] bg-[#121214] text-[#6E6E73]"
                }`}
              >
                {done ? <Icon name="check" size={12} /> : String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`font-mono mt-2 hidden max-w-[86px] text-center text-[8px] leading-tight tracking-[0.06em] uppercase md:block ${
                  active ? "text-[#FFCC00]" : done ? "text-[#8E8E93]" : "text-[#6E6E73]"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <div className="flex flex-col gap-4 md:flex-row">
          <Big
            kind="upload"
            icon="upload"
            title="Upload your data"
            description="Drag in a .csv or .json file. It is parsed and validated before any model runs."
          />
          <Big
            kind="library"
            icon="database"
            title="Choose from dataset library"
            description="Pick a prepared NASA/ISS dataset that runs through the real .joblib models."
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {DOMAIN_KEYS.map((domain) => (
              <button
                key={domain}
                onClick={() => {
                  setScope(domain);
                  setDs(null);
                  setLib(null);
                  setFile(null);
                  setUp({ name: "", size: 0, pct: 0, err: "" });
                }}
                className={`flex items-center gap-4 rounded-[2px] border bg-[#121214] p-5 text-left transition ${
                  scope === domain
                    ? "border-[#FFCC00] bg-[#FFCC00]/[0.06]"
                    : "border-white/[0.08] hover:border-[#FFCC00]/45"
                }`}
              >
                <span
                  className="h-10 w-2 rounded-full"
                  style={{ background: DOMAINS[domain].color }}
                />
                <span>
                  <span className="serif block text-[24px] leading-none">
                    {DOMAINS[domain].label}
                  </span>
                  <span className="text-[13px] text-muted">{DOMAINS[domain].blurb}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setScope("all");
              setDs(null);
              setLib(null);
              setFile(null);
              setUp({ name: "", size: 0, pct: 0, err: "" });
            }}
            className={`flex w-full items-center gap-4 rounded-[2px] border bg-[#121214] p-5 text-left transition ${
              scope === "all"
                ? "border-[#FFCC00] bg-[#FFCC00]/[0.06]"
                : "border-white/[0.08] hover:border-[#FFCC00]/45"
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FFCC00] text-[#0B0B0C]">
              <Icon name="cpu" size={19} />
            </span>
            <span>
              <span className="serif block text-[24px] leading-none">
                All Multi-Stressor Models
              </span>
              <span className="text-[13px] text-muted">
                Run the four domain models plus the integrated fusion layer. Requires at least two
                recognised health domains in the selected data.
              </span>
            </span>
          </button>
        </div>
      )}

      {step === 2 && source === "upload" && (
        <Card className="p-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDrag(false);
              void onFile(event.dataTransfer.files[0]);
            }}
            className={`flex flex-col items-center rounded-[2px] border border-dashed px-6 py-14 text-center transition ${
              drag
                ? "border-[#FFCC00] bg-[#FFCC00]/[0.08]"
                : "border-[#FFCC00]/35 bg-[#FFCC00]/[0.03] hover:border-[#FFCC00]/60"
            }`}
          >
            <span className="grid h-14 w-14 place-items-center rounded-[2px] border border-[#FFCC00]/30 bg-[#FFCC00]/10 text-[#FFCC00]">
              <Icon name="upload" size={26} />
            </span>
            <p className="serif mt-4 text-[26px]">Drag and drop a .csv or .json file</p>
            <p className="mt-1 text-[13px] text-muted">
              Maximum 20 MB. Parsed in your browser for preview, scored by the backend models.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(event) => void onFile(event.target.files?.[0])}
              aria-label="Choose CSV or JSON file"
            />
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Btn variant="soft" onClick={() => fileRef.current?.click()}>
                Browse files
              </Btn>
              <Btn variant="outline" onClick={() => void onFile(makeSampleAnomalyFile())}>
                Load sample anomaly dataset
              </Btn>
            </div>
          </div>
          {up.name && (
            <div className="mt-5 rounded-[2px] border border-line p-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <Icon name="file" size={16} />
                  <b>{up.name}</b>
                  <span className="text-muted">{(up.size / 1024).toFixed(1)} KB</span>
                </span>
                <span className="font-mono text-[11px]">{up.pct}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ffffff12]">
                <div
                  className={`h-full rounded-full ${up.err ? "bg-critical" : "bg-navy"}`}
                  style={{ width: `${up.pct || 100}%`, transition: "width .2s" }}
                />
              </div>
              {up.err && (
                <p className="mt-2 text-[13px] text-critical" role="alert">
                  {up.err}
                </p>
              )}
              {ds && !up.err && up.pct === 100 && (
                <p className="mt-2 text-[13px] text-[#FFCC00]">
                  Loaded {ds.uploaded?.rows.length} rows, {ds.uploaded?.columns.length} columns.
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {step === 2 && source === "library" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Scope: {scopeLabel}</Badge>
            {lib && <Badge tone="success">Selected: {lib.id}</Badge>}
          </div>
          {libraryLoading && (
            <Callout tone="info">Loading prepared datasets from the backend…</Callout>
          )}
          {libraryError && (
            <div className="space-y-3">
              <Callout tone="error" title="Dataset library unavailable">
                {libraryError}
              </Callout>
              <Btn variant="outline" onClick={() => void loadLibrary()}>
                Retry
              </Btn>
            </div>
          )}
          {!libraryLoading && !libraryError && !libraryOptions.length && (
            <Callout tone="warn" title="No prepared dataset for this scope">
              The backend library has no matching dataset. Upload a .csv or .json file instead.
            </Callout>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {libraryOptions.map((dataset) => {
              const expected = dataset.expected_outcome;
              const critical = expected?.status === "HIGH_STRAIN_ALERT";
              const selected = lib?.id === dataset.id;
              return (
                <button
                  key={dataset.id}
                  onClick={() => pickLibrary(dataset)}
                  className={`flex flex-col rounded-[2px] border bg-[#121214] p-5 text-left transition ${
                    selected
                      ? "border-[#FFCC00] bg-[#FFCC00]/[0.06]"
                      : "border-white/[0.08] hover:border-[#FFCC00]/45"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] text-muted">{dataset.id}</p>
                      <p className="serif mt-1 text-[21px] leading-tight">{dataset.name}</p>
                    </div>
                    <Badge
                      tone={
                        critical
                          ? "critical"
                          : dataset.category === "anomaly"
                            ? "warning"
                            : "success"
                      }
                    >
                      {dataset.category}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[13px] text-muted">{dataset.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {dataset.domains.map((d) => (
                      <span
                        key={d}
                        className="font-mono rounded-full border px-2 py-0.5 text-[8.5px] tracking-[0.1em]"
                        style={{
                          borderColor: `${STRESSOR_COLOR[d]}55`,
                          color: STRESSOR_COLOR[d],
                          background: `${STRESSOR_COLOR[d]}12`,
                        }}
                      >
                        {STRESSOR_LABEL[d]}
                      </span>
                    ))}
                    {dataset.domains.length > 1 && (
                      <span className="font-mono rounded-full border border-[#F5A623]/50 bg-[#F5A623]/10 px-2 py-0.5 text-[8.5px] tracking-[0.1em] text-[#F5A623]">
                        SYNERGISTIC
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{dataset.record_count} records</Badge>
                    <Badge tone={critical ? "critical" : "neutral"}>
                      Expected: {dataset.expected_severity.replace(/_/g, " ")}
                    </Badge>
                    {expected && <Badge>{expected.interaction_type}</Badge>}
                  </div>
                  <p className="mt-3 text-[11.5px] text-muted">{dataset.limitation}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && ds && (
        <Card className="p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Associated subject or study"
              hint={
                source === "upload"
                  ? "Confirm that the upload belongs to this subject or study."
                  : "Prepared library datasets run against the demonstration cohort they were built for."
              }
            >
              <select
                className="input"
                value={subj}
                onChange={(event) => setSubj(event.target.value)}
                disabled={source === "library" && subjOptions.length <= 1}
              >
                {(subjOptions.length ? subjOptions : subjects).map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.id} · {subject.type}
                  </option>
                ))}
              </select>
            </Field>
            <div className="rounded-[2px] border border-white/[0.08] bg-white/[0.02] p-4 text-[13px]">
              <p className="font-mono text-[10px] text-muted">SELECTED DATA</p>
              <p className="mt-1">
                <b>{ds.id}</b> · {ds.origin}
              </p>
              <p className="text-muted">{ds.source}</p>
              <p className="mt-2 text-muted">Scope: {scopeLabel}</p>
              <p className="text-muted">Population: {ds.population}</p>
            </div>
          </div>
          {ds.populationKind === "Animal" && (
            <div className="mt-4">
              <Callout tone="warn" title="Animal data">
                These data remain linked to the animal study and are not astronaut measurements.
              </Callout>
            </div>
          )}
        </Card>
      )}

      {step === 4 && ds && (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="serif text-[26px]">Data preview</h3>
            <div className="flex flex-wrap gap-2">
              <Badge tone={ds.origin === "User upload" ? "upload" : "real"}>
                {ds.origin} · {ds.format}
              </Badge>
              {detected.map((domain) => (
                <Badge key={domain} tone="success">
                  {DOMAINS[domain].short}
                </Badge>
              ))}
            </div>
          </div>
          {ds.uploaded ? (
            <div className="mt-4 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    {ds.uploaded.columns.slice(0, 14).map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ds.uploaded.rows.slice(0, 10).map((row, index) => (
                    <tr key={index}>
                      {ds.uploaded!.columns.slice(0, 14).map((column) => (
                        <td key={column}>
                          {row[column] || <span className="text-coral">missing</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="font-mono mt-2 text-[10.5px] text-muted">
                Showing first {Math.min(10, ds.uploaded.rows.length)} of {ds.uploaded.rows.length}{" "}
                rows · {ds.uploaded.columns.length} columns
                {ds.uploaded.columns.length > 14 ? " (first 14 shown)" : ""}.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <Callout tone="info" title="Preview unavailable">
                Values for {ds.id} are not bundled. Choose a prepared dataset from the library or
                upload a file.
              </Callout>
            </div>
          )}
          {lib?.expected_outcome && (
            <div className="mt-4">
              <Callout tone={statusTone(lib.expected_outcome.status)} title="Prepared expectation">
                The backend pre-scored this dataset as{" "}
                <b>{lib.expected_outcome.status.replace(/_/g, " ")}</b> with a{" "}
                <b>{lib.expected_outcome.interaction_type}</b> interaction. The run repeats the real
                inference from the CSV.
              </Callout>
            </div>
          )}
        </Card>
      )}

      {step === 5 && ds && (
        <Card className="p-6">
          <h3 className="serif text-[26px]">Validation</h3>
          <p className="mt-1 text-[13px] text-muted">
            Checks the selected scope against the domain aliases the backend recognises.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Health domain</th>
                  <th>Recognised columns in this data</th>
                  <th>Required by scope</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {DOMAIN_KEYS.map((domain) => {
                  const present = detected.includes(domain);
                  const required = scope !== "all" && scope === domain;
                  const requiredLabel = required ? "Yes" : "Scored if detected";
                  return (
                    <tr key={domain}>
                      <td>
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: DOMAINS[domain].color }}
                        />
                        <b>{DOMAINS[domain].short}</b>
                      </td>
                      <td className="font-mono text-[11px]">
                        {present
                          ? ALIASES[domain]
                              .filter((alias) =>
                                ds.uploaded?.columns.some(
                                  (column) => normalise(column) === normalise(alias),
                                ),
                              )
                              .join(", ") || "recognised"
                          : "—"}
                      </td>
                      <td>{requiredLabel}</td>
                      <td>
                        {present ? (
                          <Badge tone="success">Detected</Badge>
                        ) : required ? (
                          <Badge tone="critical">Missing</Badge>
                        ) : (
                          <Badge>Not detected</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-2">
            {validation.errors.map((error) => (
              <Callout key={error} tone="error" title="Cannot run">
                {error}
              </Callout>
            ))}
            {validation.warnings.map((warning) => (
              <Callout key={warning} tone="warn">
                {warning}
              </Callout>
            ))}
            {validation.ok && (
              <Callout tone="ok" title="Ready for inference">
                {detected.length} domain{detected.length > 1 ? "s" : ""} detected. The backend will
                score every detected domain and then apply the cross-system fusion rules.
              </Callout>
            )}
          </div>
        </Card>
      )}

      {step === 6 && (
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="serif text-[26px]">Loaded .joblib models</h3>
              <p className="mt-1 text-[13px] text-muted">
                These are the real model artefacts in the backend registry for <b>{scopeLabel}</b>.
              </p>
            </div>
            {modelsLoading && <Badge>Checking registry…</Badge>}
            {!modelsLoading && models && (
              <Badge tone={models.all_expected_loaded ? "success" : "warning"}>
                {models.badge}
              </Badge>
            )}
          </div>
          {modelsError && (
            <div className="mt-4 space-y-3">
              <Callout tone="error" title="Model registry unavailable">
                {modelsError}
              </Callout>
              <Btn variant="outline" onClick={() => void loadModels()}>
                Retry
              </Btn>
            </div>
          )}
          {!modelsError && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {relevantModels.map((model) => (
                <div key={model.key} className="rounded-[2px] border border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] text-muted">{model.key.toUpperCase()}</p>
                      <b className="text-[14px]">{model.name}</b>
                    </div>
                    <Badge tone={model.loaded ? "success" : "critical"}>
                      {model.loaded ? "Loaded" : "Missing"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[12.5px] text-muted">{model.kind}</p>
                  <p className="font-mono mt-2 text-[10.5px] text-muted">
                    {model.filename} · {model.feature_count} features
                  </p>
                </div>
              ))}
            </div>
          )}
          {!modelsLoading && !modelsError && !modelsReady && (
            <div className="mt-4">
              <Callout tone="error" title="Required model missing">
                One or more models needed for {scopeLabel} are not loaded. Restart the backend with
                the model artefacts present, then retry.
              </Callout>
            </div>
          )}
          {modelsReady && (
            <div className="mt-4">
              <Callout tone="ok" title="Models ready">
                {relevantModels.length} model{relevantModels.length > 1 ? "s" : ""} will run. The
                backend scores all four domain models and the integrated fusion layer for every
                upload.
              </Callout>
            </div>
          )}
        </Card>
      )}

      {step === 7 && ds && (
        <Card className="p-6">
          <h3 className="serif text-[26px]">Ready to run</h3>
          <dl className="mt-4 grid gap-4 text-[13px] md:grid-cols-4">
            {[
              ["Dataset", ds.uploaded?.fileName ?? ds.id],
              ["Scope", scopeLabel],
              ["Records", String(ds.uploaded?.rows.length ?? 0)],
              ["Subject / study", subj],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[10px] text-muted">{label.toUpperCase()}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <Callout tone="info" title="What will happen">
              The file is sent to <b>POST /api/health/upload-analyze</b>. The backend parses it,
              runs the four <b>.joblib</b> domain models and the integrated fusion layer, then
              returns real risk scores, an interaction classification and the countermeasure
              protocol.
            </Callout>
          </div>
          {runError && (
            <div className="mt-4">
              <Callout tone="error" title="Analysis failed">
                {runError}
              </Callout>
            </div>
          )}
          <button
            type="button"
            disabled={!validation.ok || !modelsReady}
            onClick={() => void run()}
            className="group mt-6 inline-flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FFCC00] text-[#0B0B0C] transition group-hover:bg-[#FFD633] group-disabled:bg-[#6E6E73]">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M3 10h13M10.5 4.5 16 10l-5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="font-bold-sans text-[13px] uppercase tracking-[0.16em] text-[#FFFFFF]">
              Run Analysis
            </span>
          </button>
          {(!validation.ok || !modelsReady) && (
            <p className="mt-2 text-[13px] text-critical">
              Resolve the validation or model-registry issues before running.
            </p>
          )}
        </Card>
      )}

      {step === 8 && (
        <Card className="p-10 text-center">
          <h3 className="serif text-[30px]">Running real model inference</h3>
          <p className="font-mono mt-2 text-[11px] text-muted">{stage}</p>
          <div className="mx-auto mt-6 h-2 max-w-[560px] overflow-hidden rounded-[2px] bg-[#ffffff12]">
            <div
              className="bar-anim h-full rounded-[2px] bg-navy"
              style={{ width: `${prog}%`, transition: "width .12s" }}
            />
          </div>
          <p className="font-mono mt-2 text-[11px]">{prog}%</p>
        </Card>
      )}

      {step === 9 && result && ds && <Results result={result} ds={ds} />}

      {step < 7 && (
        <div className="mt-8 flex items-center gap-3">
          {step > 0 && (
            <Btn variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Btn>
          )}
          <Btn disabled={!canNext} onClick={next} icon="chevron">
            Continue
          </Btn>
          {step === 2 && source === "library" && !ds && (
            <span className="text-[12.5px] text-muted">Select a prepared dataset to continue.</span>
          )}
          {step === 6 && !modelsReady && (
            <span className="text-[12.5px] text-muted">
              {modelsLoading ? "Checking models…" : "All required models must be loaded."}
            </span>
          )}
        </div>
      )}
      {step === 7 && (
        <div className="mt-6 flex gap-3">
          <Btn variant="ghost" onClick={() => setStep(6)}>
            Back
          </Btn>
        </div>
      )}

      {step === 9 && result && ds && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Btn
            icon="file"
            onClick={() => {
              const primary = DOMAIN_KEYS.includes(result.primary_domain as Domain)
                ? (result.primary_domain as Domain)
                : ds.domain;
              const report = {
                id: `RP-${result.analysis_id.slice(4)}`,
                title: `MYOSHIELD ${result.interaction_type}: ${ds.uploaded?.fileName ?? ds.name}`,
                analysisId: result.analysis_id,
                date: new Date().toISOString(),
                domain: primary,
                subjectId: subj || ds.id,
                sharedWithAstronaut: false,
                simulated: false,
              };
              addReport(report);
              openReport({
                subjectId: subj || ds.id,
                snapshot: {
                  result,
                  at: new Date().toISOString(),
                  sourceName:
                    source === "library" ? ds.name : (ds.uploaded?.fileName ?? ds.name),
                  sourceKind: source === "library" ? "library" : "upload",
                },
              });
            }}
          >
            Generate Report
          </Btn>
          <Btn
            variant="outline"
            onClick={() => {
              const primary = DOMAIN_KEYS.includes(result.primary_domain as Domain)
                ? (result.primary_domain as Domain)
                : ds.domain;
              go(DOMAINS[primary].route as never);
            }}
          >
            Open domain dashboard
          </Btn>
          <Btn variant="ghost" onClick={reset}>
            Start another analysis
          </Btn>
        </div>
      )}
    </div>
  );
}

function Results({ result, ds }: { result: UploadAnalysis; ds: Dataset }) {
  const { setAnomalyOpen, notify } = useApp();
  const primary: Domain = DOMAIN_KEYS.includes(result.primary_domain as Domain)
    ? (result.primary_domain as Domain)
    : ds.domain;
  const critical = isCriticalAnalysis(result);
  const series = useMemo(
    () => (ds.uploaded ? computeSeries(ds.uploaded.columns, ds.uploaded.rows) : []),
    [ds],
  );

  return (
    <div className="space-y-4">
      <Callout
        tone={statusTone(result.status)}
        title={`${statusLabel(result.status)} · ${result.interaction_type}`}
      >
        {result.classification_reason ??
          "Cross-system fusion classified the uploaded dataset across all detected domains."}{" "}
        {critical
          ? "This result meets the critical threshold, so the rescue protocol opened automatically. Review it before continuing operations."
          : "Continue monitoring and re-run the analysis when new telemetry arrives."}
      </Callout>

      {critical && (
        <div className="flex flex-wrap items-center gap-3">
          <Btn
            variant="coral"
            icon="alert"
            onClick={() => {
              setAnomalyOpen(true);
              notify("Rescue protocol reopened");
            }}
          >
            Open rescue protocol
          </Btn>
        </div>
      )}

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">
              {result.analysis_id} · {fmtDate(new Date().toISOString())}
            </p>
            <h3 className="serif text-[30px] leading-none">Multi-stressor result</h3>
            <p className="mt-2 text-[13px] text-muted">
              {ds.uploaded?.fileName ?? ds.name} · {result.records} records ·{" "}
              {result.columns?.length ?? 0} columns
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              tone={
                critical
                  ? "critical"
                  : result.status === "ELEVATED_MONITORING"
                    ? "warning"
                    : "success"
              }
            >
              {statusLabel(result.status)}
            </Badge>
            <Badge>{result.interaction_type}</Badge>
            <Badge tone="real">Real .joblib inference</Badge>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Mission readiness", `${result.mission_readiness_score}%`],
            ["Integrated strain", result.integrated_strain_index.toFixed(3)],
            ["Primary domain", DOMAINS[primary].label],
            ["Affected module", result.affected_module || result.iss_module],
          ].map(([label, value], i) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-4"
            >
              <span className="absolute inset-x-0 top-0 h-[2px] bg-[#FFCC00]/40" />
              <div className="flex items-start justify-between gap-2">
                <dt className="font-mono text-[10px] tracking-[0.1em] text-[#8E8E93]">
                  {label.toUpperCase()}
                </dt>
                <span className="font-mono text-[9px] tabular-nums text-[#6E6E73]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <dd className="font-mono mt-1.5 text-[22px] leading-none tabular-nums text-[#FFFFFF]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-6">
        <h3 className="serif text-[24px]">Domain risk scores</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DOMAIN_KEYS.map((domain) => {
            const score = Number(result.domain_scores[domain] ?? 0);
            const color =
              score >= 0.66 ? "#F06464" : score >= 0.6 ? "#F5A623" : DOMAINS[domain].color;
            return (
              <div
                key={domain}
                className="rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-4"
                style={
                  score >= 0.66
                    ? {
                        borderColor: "rgba(240,100,100,0.5)",
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-[#D6D6D9]">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: DOMAINS[domain].color }}
                    />
                    {DOMAINS[domain].short}
                  </span>
                  <span className="font-mono text-[13px] tabular-nums" style={{ color }}>
                    {score.toFixed(2)}
                  </span>
                </div>
                <div className="gauge-track mt-3 h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(3, Math.min(100, score * 100))}%`,
                      background: color,
                    }}
                  />
                </div>
                <p className="font-mono mt-2 text-[10.5px]" style={{ color: `${color}CC` }}>
                  {score >= 0.66
                    ? "Threshold exceeded"
                    : score >= 0.6
                      ? "Watch threshold"
                      : "Within model baseline"}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {result.detected_domains.map((domain) => (
            <Badge key={domain} tone="success">
              Detected: {domain}
            </Badge>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {DOMAIN_KEYS.map((domain) => {
          const detail = (result.module_details?.[domain] ?? {}) as Record<string, unknown>;
          const anomalyFlag = detail.is_anomaly === true;
          const risk =
            detailNumber(detail, "anomaly_risk_score") ??
            detailNumber(detail, "cardio_risk_score") ??
            detailNumber(detail, "kinematic_anomaly_score") ??
            detailNumber(detail, "transcriptional_stress_score");
          const modelUsed = detailText(detail, "model_used");
          const genes = detailNumber(detail, "genes_evaluated");
          return (
            <Card key={domain} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.12em] text-[#8E8E93]">
                    {domain.toUpperCase()}
                  </p>
                  <h4 className="serif text-[21px] leading-tight text-[#FFFFFF]">
                    {DOMAINS[domain].short} model output
                  </h4>
                </div>
                <Badge tone={anomalyFlag || (risk ?? 0) >= 0.66 ? "critical" : "success"}>
                  {anomalyFlag ? "Anomaly" : "Baseline"}
                </Badge>
              </div>
              {risk !== undefined && (
                <div className="mt-3 rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-3">
                  <p className="font-mono text-[10px] tracking-[0.1em] text-[#8E8E93]">
                    MODEL RISK SCORE
                  </p>
                  <p
                    className="font-mono mt-1 text-[22px] leading-none tabular-nums"
                    style={{ color: risk >= 0.66 ? "#F06464" : "#FFCC00" }}
                  >
                    {risk.toFixed(3)}
                  </p>
                </div>
              )}
              {domain === "musculoskeletal" && genes !== undefined && (
                <p className="mt-1 text-[12.5px] text-muted">Genes evaluated: {genes}</p>
              )}
              {detailText(detail, "condition_evaluated") && (
                <p className="mt-1 text-[12.5px] text-muted">
                  Condition: {detailText(detail, "condition_evaluated")}
                </p>
              )}
              {modelUsed && (
                <p className="font-mono mt-3 break-words text-[10.5px] text-muted">{modelUsed}</p>
              )}
            </Card>
          );
        })}
      </div>

      {result.cross_system_insights?.length > 0 && (
        <Card className="p-6">
          <h3 className="serif text-[24px]">Cross-system insights</h3>
          <ul className="mt-3 space-y-3">
            {result.cross_system_insights.map((insight) => (
              <li
                key={insight.id}
                className="rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-4"
              >
                <p className="font-bold-sans text-[14px] text-[#FFFFFF]">{insight.title}</p>
                <p className="mt-1 text-[13px] leading-[1.5] text-[#8E8E93]">
                  {insight.explanation}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result.protocol_steps && result.protocol_steps.length > 0 && (
        <Card className="p-6">
          <h3 className="serif text-[24px]">Countermeasure protocol</h3>
          <ol className="mt-3 space-y-2">
            {result.protocol_steps.map((protocol, index) => (
              <li
                key={`${protocol.title}-${index}`}
                className="flex gap-3 rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-4"
              >
                <span className="font-mono mt-0.5 shrink-0 text-[11px] tabular-nums text-[#FFCC00]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-bold-sans text-[14px] text-[#FFFFFF]">{protocol.title}</p>
                  <p className="mt-1 text-[13px] leading-[1.5] text-[#8E8E93]">{protocol.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {series[0] && (
        <ChartCard
          title={`${series[0].col} across the uploaded records`}
          source={ds.uploaded?.fileName ?? ds.name}
          xLabel="Record index"
          yLabel={series[0].col}
          legend={[{ name: series[0].col, color: DOMAINS[primary].color }]}
        >
          <LineChart
            series={[
              { name: series[0].col, color: DOMAINS[primary].color, points: series[0].points },
            ]}
            xLabel="Record index"
            yLabel={series[0].col}
          />
        </ChartCard>
      )}

      {result.disclaimer && <Callout tone="info">{result.disclaimer}</Callout>}
    </div>
  );
}
