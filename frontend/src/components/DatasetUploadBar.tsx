import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  analyzeHealthUpload,
  makeSampleAnomalyFile,
  type DomainKey,
  type UploadAnalysis,
} from "../lib/api";
import { DOMAINS } from "../lib/data";
import { useApp } from "../lib/store";

const DOMAIN_KEYS: DomainKey[] = ["radiation", "musculoskeletal", "vestibular", "cardiovascular"];

const STATUS_LABEL: Record<string, string> = {
  NOMINAL: "Nominal",
  ELEVATED_MONITORING: "Elevated",
  HIGH_STRAIN_ALERT: "High strain",
};

const INTERACTION_COLOR: Record<string, string> = {
  SYNERGISTIC: "#F06464",
  ANTAGONISTIC: "#9B8CFF",
  ADDITIVE: "#F2B84B",
};

function statusTone(status: string) {
  if (status === "HIGH_STRAIN_ALERT") return { bg: "#F06464", text: "#190707" };
  if (status === "ELEVATED_MONITORING") return { bg: "#F2B84B", text: "#241700" };
  return { bg: "#35D6C0", text: "#0B0B0C" };
}

function isCritical(result: UploadAnalysis) {
  return result.status === "HIGH_STRAIN_ALERT" || result.interaction_type === "SYNERGISTIC";
}

export default function DatasetUploadBar({
  onResult,
  onReview,
}: {
  onResult: (result: UploadAnalysis) => void;
  onReview?: (result: UploadAnalysis) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const { latest } = useApp();
  // Read the shared snapshot so this panel and the health domain cards never diverge.
  const result = latest?.result ?? null;
  const shownFileName = busy ? fileName : (latest?.sourceName ?? "");

  const processFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".json")) {
      setError("Unsupported file type. Upload a .csv or .json health dataset.");
      return;
    }

    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      const analysis = await analyzeHealthUpload(file);
      onResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const loadSample = () => {
    if (busy) return;
    void processFile(makeSampleAnomalyFile());
  };

  const tone = result ? statusTone(result.status) : null;
  const critical = result ? isCritical(result) : false;

  return (
    <section className="rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-[#8E8E93]">
            DATASET UPLINK · HEALTH ANALYZER
          </p>
          <h2 className="font-bold-sans mt-2 text-[22px] leading-none text-[#FFFFFF]">
            Upload a mission health dataset
          </h2>
          <p className="mt-2 max-w-[600px] text-[13px] leading-[1.5] text-[#8E8E93]">
            Drop a CSV or JSON file. All four domain models run, then the cross-system strain rules
            decide whether an emergency rescue protocol must open.
          </p>
        </div>
        <span className="font-mono shrink-0 rounded-[2px] border border-[#FFCC00]/45 bg-[#FFCC00]/10 px-3 py-1 text-[9.5px] uppercase tracking-[0.14em] text-[#FFCC00]">
          {busy ? "ANALYZING…" : "READY"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center rounded-[2px] border border-dashed px-4 py-6 text-center transition ${
            dragging ? "border-[#FFCC00] bg-[#FFCC00]/8" : "border-white/20 bg-[#0E0E10]"
          }`}
        >
          <span className="grid h-11 w-11 place-items-center rounded-[2px] border border-[#FFCC00]/40 bg-[#FFCC00]/10 text-[#FFCC00]">
            <UploadIcon />
          </span>
          <p className="mt-3 text-[14px] text-[#FFFFFF]">
            {busy ? "Running inference across all four models…" : "Drag & drop a dataset here"}
          </p>
          <p className="font-mono mt-1 text-[10px] tracking-[0.08em] text-[#6E6E73]">
            .CSV OR .JSON · SINGLE FILE
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="font-mono inline-flex items-center gap-2 rounded-[2px] border border-white/[0.12] bg-transparent px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#FFFFFF] transition hover:border-[#FFCC00]/60 hover:text-[#FFCC00] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <UploadIcon size={12} /> CHOOSE FILE
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={loadSample}
              className="font-mono inline-flex items-center gap-2 rounded-[2px] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "#FFCC00", color: "#0B0B0C" }}
            >
              <PulseIcon /> LOAD SAMPLE ANOMALY DATASET
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={onFileChange}
          />

          <p className="font-mono mt-3 h-4 text-[9.5px] tracking-[0.04em] text-[#6E6E73]">
            {shownFileName || "No file selected"}
          </p>
        </div>

        <div className="rounded-[2px] border border-white/[0.08] bg-[#0E0E10] p-4">
          {result && tone ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] tracking-[0.12em] text-[#8E8E93]">
                  ANALYSIS RESULT
                </p>
                <span
                  className="font-mono rounded-[1px] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em]"
                  style={{ background: tone.bg, color: tone.text }}
                >
                  {STATUS_LABEL[result.status] ?? result.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="mt-3 flex items-end gap-3">
                <p className="font-bold-sans text-[40px] leading-none text-[#FFFFFF]">
                  {result.mission_readiness_score.toFixed(0)}
                  <span className="ml-1 text-[14px] font-normal text-[#8E8E93]">%</span>
                </p>
                <div className="pb-1">
                  <p className="font-mono text-[9px] tracking-[0.1em] text-[#6E6E73]">READINESS</p>
                  <p
                    className="font-mono mt-0.5 text-[11px] font-bold"
                    style={{ color: INTERACTION_COLOR[result.interaction_type] ?? "#F2B84B" }}
                  >
                    {result.interaction_type}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {DOMAIN_KEYS.map((key) => {
                  const score = Number(result.domain_scores?.[key] ?? 0);
                  const colored = score >= 0.66;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="font-mono w-[86px] shrink-0 truncate text-[8px] tracking-[0.06em] text-[#8E8E93]">
                        {DOMAINS[key].short.toUpperCase()}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(3, Math.min(100, score * 100))}%`,
                            background: colored ? "#F06464" : DOMAINS[key].color,
                          }}
                        />
                      </div>
                      <span className="font-mono w-8 shrink-0 text-right text-[8.5px] font-bold text-[#8E8E93]">
                        {score.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {critical && onReview && (
                <button
                  type="button"
                  onClick={() => onReview(result)}
                  className="font-mono mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[2px] border border-[#F06464] bg-[#F06464]/15 px-3 py-2 text-[9px] font-bold tracking-[0.14em] transition hover:brightness-110"
                  style={{ color: "#F06464" }}
                >
                  <AlertIcon size={12} /> OPEN RESCUE PROTOCOL
                </button>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.12em] text-[#8E8E93]">
                  ANALYSIS RESULT
                </p>
                <p className="mt-3 text-[20px] font-semibold leading-tight text-[#FFFFFF]">
                  Awaiting dataset
                </p>
                <p className="mt-1 text-[12px] leading-[1.5] text-[#8E8E93]">
                  Every upload is scored across all four health domains.
                </p>
              </div>
              <ul className="font-mono mt-4 space-y-1.5 text-[9.5px] tracking-[0.06em] text-[#6E6E73]">
                <li>01 · PARSE CSV / JSON ROWS</li>
                <li>02 · SCORE FOUR DOMAIN MODELS</li>
                <li>03 · CHECK SYNERGY RULES</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mt-3 flex items-start gap-2 rounded-[2px] border border-[#F06464]/60 bg-[#F06464]/10 px-3 py-2 text-[11.5px] leading-[1.5]"
          style={{ color: "#F06464" }}
        >
          <AlertIcon size={14} />
          <p>{error}</p>
        </div>
      )}
    </section>
  );
}

function UploadIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12h4l2.5-7 4.5 14 2.5-7H21" />
    </svg>
  );
}

function AlertIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-0.5 shrink-0"
    >
      <path d="M12 3 2 20h20Z" />
      <path d="M12 10v5M12 18v.01" />
    </svg>
  );
}
