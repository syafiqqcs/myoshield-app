import { useCallback, useEffect, useRef, useState } from "react";
import type { DomainKey, UploadAnalysis } from "../lib/api";
import { cancelAlertAudio, triggerAnalysisAlert } from "../lib/audioAlerts";

const DOMAIN_META: Record<string, { label: string; short: string; color: string; module: string }> =
  {
    cardiovascular: {
      label: "Cardiovascular & Respiratory",
      short: "CARDIO / RESP",
      color: "#F2B84B",
      module: "US Lab",
    },
    vestibular: {
      label: "Vestibular & Eye-Head Kinematics",
      short: "VESTIBULAR / VOR",
      color: "#9B8CFF",
      module: "Node 2",
    },
    musculoskeletal: {
      label: "Musculoskeletal Multi-Omics",
      short: "MUSCULOSKELETAL",
      color: "#FFCC00",
      module: "Node 3",
    },
    radiation: {
      label: "Radiation & Environmental",
      short: "RADIATION",
      color: "#4DA3FF",
      module: "US Lab",
    },
  };

const INTERACTION_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  SYNERGISTIC: { bg: "#F06464", text: "#190707", border: "#F06464" },
  ANTAGONISTIC: { bg: "#9B8CFF", text: "#120b26", border: "#9B8CFF" },
  ADDITIVE: { bg: "#F2B84B", text: "#241700", border: "#F2B84B" },
};

function fallbackSteps(domain: string, module: string) {
  if (domain === "vestibular") {
    return [
      {
        title: "Stabilise head and body",
        detail: "Seat the crew member, secure handrails, and fix gaze on a stationary reference.",
      },
      {
        title: "Administer vestibular kit",
        detail: "Give the antiemetic, fit VOR goggles, and record nystagmus / gaze stability.",
      },
      {
        title: "Escort to the Service Module",
        detail: "Move slowly with two crew if available; avoid rapid head turns.",
      },
    ];
  }
  if (domain === "musculoskeletal") {
    return [
      {
        title: "Immobilise the affected limb",
        detail: "Apply the splint and cold pack, then lock the ARED load.",
      },
      {
        title: "Reduce load and reposition",
        detail: "Lower ARED resistance and move the crew member to a padded station.",
      },
      {
        title: "Survey and report",
        detail: "Check distal pulse, sensation, and range of motion; report to Mission Control.",
      },
    ];
  }
  if (domain === "radiation") {
    return [
      {
        title: "Withdraw to the Service Module",
        detail: `Leave the ${module}, close the hatch, and take the personal dosimeter.`,
      },
      {
        title: "Run contamination check",
        detail: "Survey skin, clothing, and tools; bag contaminated items.",
      },
      {
        title: "Log dose and notify Flight Surgeon",
        detail: "Record dose rate, exposure time, and decontamination actions.",
      },
    ];
  }
  return [
    {
      title: `Move the crew member to the Service Module`,
      detail: `Use handrails, keep the head supported, and leave the affected ${module} rack.`,
    },
    {
      title: "Apply oxygen and vitals monitor",
      detail: "Start 2–4 L/min O₂, attach the pulse oximeter, and re-check SpO₂ every 30 seconds.",
    },
    {
      title: "Lock the module and call Mission Control",
      detail: `Close the ${module} hatch and read live vitals to the Flight Surgeon.`,
    },
  ];
}

export default function AnomalyPopupModal({
  open,
  result,
  filename,
  onClose,
}: {
  open: boolean;
  result: UploadAnalysis | null;
  filename?: string;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<boolean[]>([false, false, false]);
  const lastAlert = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = useCallback(() => {
    cancelAlertAudio();
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (open) setChecked([false, false, false]);
  }, [open, result?.analysis_id]);

  // Spacecraft chime + spoken warning whenever a non-nominal rescue overlay opens.
  useEffect(() => {
    if (!open || !result) {
      lastAlert.current = null;
      return;
    }
    const key = `${result.analysis_id}|${result.status}|${result.interaction_type}|${result.integrated_strain_index}`;
    if (lastAlert.current === key) return;
    lastAlert.current = key;
    triggerAnalysisAlert(result);
  }, [open, result]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      cancelAlertAudio();
    };
  }, [open, handleClose]);

  if (!open || !result) return null;

  const interaction = String(result.interaction_type || "ADDITIVE").toUpperCase();
  const interactionStyle = INTERACTION_STYLE[interaction] ?? INTERACTION_STYLE.ADDITIVE;
  const primaryDomain = String(result.primary_domain || "cardiovascular");
  const meta = DOMAIN_META[primaryDomain] ?? DOMAIN_META.cardiovascular;
  const affectedModule = result.affected_module || meta.module;
  const steps = (
    result.protocol_steps?.length
      ? result.protocol_steps
      : fallbackSteps(primaryDomain, affectedModule)
  ).slice(0, 3);
  const checkedCount = checked.filter(Boolean).length;
  const datasetName = result.filename || filename || "uploaded_dataset";
  const domainScores = result.domain_scores ?? {
    radiation: 0,
    musculoskeletal: 0,
    vestibular: 0,
    cardiovascular: 0,
  };

  const toggle = (index: number) => {
    setChecked((current) => current.map((value, i) => (i === index ? !value : value)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-5">
      <button
        type="button"
        aria-label="Dismiss anomaly overlay"
        onClick={handleClose}
        className="absolute inset-0 bg-[#000000]/85 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="anomaly-title"
        className="anomaly-frame relative flex max-h-[96vh] w-full max-w-[1380px] flex-col overflow-hidden rounded-[2px] border-2 bg-[#121214] text-[#FFFFFF]"
        style={{ borderColor: "#F06464" }}
      >
        <div className="anomaly-scanline pointer-events-none absolute inset-0 z-20 opacity-40" />

        <header className="relative z-30 shrink-0 border-b border-[rgba(255,255,255,0.08)] bg-[#121214] px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#F06464]/70 bg-[#F06464]/15 px-3 py-1.5 text-[#F06464]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F06464] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#F06464]" />
                </span>
                <span className="font-mono animate-pulse text-[9px] font-bold tracking-[0.16em]">
                  CRITICAL ANOMALY
                </span>
              </span>
              <div className="min-w-0">
                <h2
                  id="anomaly-title"
                  className="truncate text-[19px] font-semibold leading-tight text-[#FFFFFF] md:text-[22px]"
                >
                  Cross-system instability detected
                </h2>
                <p className="font-mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] tracking-[0.08em] text-[#8E8E93]">
                  <span className="text-[#FFCC00]">UPLINKED DATASET</span>
                  <span className="truncate">{datasetName}</span>
                  <span>·</span>
                  <span>{result.records} RECORDS</span>
                  <span>·</span>
                  <span>{result.status.replace(/_/g, " ")}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="font-mono rounded-full border px-3 py-1.5 text-[9px] font-bold tracking-[0.14em]"
                style={{
                  background: interactionStyle.bg,
                  color: interactionStyle.text,
                  borderColor: interactionStyle.border,
                }}
              >
                {interaction}
              </span>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close anomaly modal"
                className="grid h-9 w-9 place-items-center rounded-[2px] border border-white/[0.08] bg-[#121214] text-[#8E8E93] transition hover:border-[#F06464]/60 hover:text-[#F06464]"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="READINESS" value={`${result.mission_readiness_score}%`} accent="#FFCC00" />
            <Stat
              label="STRAIN INDEX"
              value={result.integrated_strain_index.toFixed(3)}
              accent="#F06464"
            />
            <Stat label="AFFECTED MODULE" value={affectedModule} accent="#F2B84B" />
            <Stat label="PRIMARY DOMAIN" value={meta.short} accent={meta.color} />
          </div>
        </header>

        <div className="relative z-10 grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[3fr_2fr]">
          <section className="border-b border-[rgba(255,255,255,0.08)] p-4 md:p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[9px] font-bold tracking-[0.16em] text-[#FFCC00]">
                  COUNTERMEASURE BLUEPRINT
                </p>
                <p className="mt-1 text-[14px] font-semibold text-[#FFFFFF]">
                  {meta.label} rescue route
                </p>
              </div>
              <span className="font-mono rounded-[2px] border border-white/[0.08] bg-[#121214] px-2.5 py-1 text-[8.5px] tracking-[0.1em] text-[#8E8E93]">
                01 → 02 → 03
              </span>
            </div>

            <div className="mt-3 overflow-hidden rounded-[2px] border border-white/[0.08] bg-[#0E0E10]">
              <CountermeasureBlueprint
                domain={primaryDomain}
                module={affectedModule}
                interaction={interaction}
              />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {(Object.keys(DOMAIN_META) as DomainKey[]).map((key) => {
                const score = Number(domainScores[key] ?? 0);
                const item = DOMAIN_META[key];
                return (
                  <div
                    key={key}
                    className="rounded-[2px] border border-white/[0.08] bg-[#121214] px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono truncate text-[7.5px] tracking-[0.08em] text-[#8E8E93]">
                        {item.short}
                      </span>
                      <span
                        className="font-mono text-[9px] font-bold"
                        style={{ color: item.color }}
                      >
                        {score.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, Math.min(100, score * 100))}%`,
                          background: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {result.cross_system_insights?.length > 0 && (
              <div className="mt-3 rounded-[2px] border border-[#F06464]/35 bg-[#F06464]/8 p-3">
                <p className="font-mono text-[8.5px] font-bold tracking-[0.14em] text-[#F06464]">
                  CROSS-SYSTEM INSIGHT
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#FFFFFF]">
                  {result.cross_system_insights[0].title}
                </p>
                <p className="mt-1 text-[10px] leading-[1.5] text-[#8E8E93]">
                  {result.cross_system_insights[0].explanation}
                </p>
              </div>
            )}
          </section>

          <aside className="flex flex-col p-4 md:p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[9px] font-bold tracking-[0.16em] text-[#FFCC00]">
                  RESCUE PROTOCOL
                </p>
                <p className="mt-1 text-[14px] font-semibold text-[#FFFFFF]">
                  Acknowledge each action
                </p>
              </div>
              <span className="font-mono rounded-[2px] border border-white/[0.08] bg-[#121214] px-2.5 py-1 text-[8.5px] tracking-[0.1em] text-[#8E8E93]">
                {checkedCount}/3 ACK
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <TelemetryMini
                label="SpO2"
                value={`${Math.round(result.vitals.spo2)}%`}
                critical={result.vitals.spo2 < 92}
              />
              <TelemetryMini
                label="HEART RATE"
                value={`${Math.round(result.vitals.heart_rate)} bpm`}
                critical={result.vitals.heart_rate > 115}
              />
              <TelemetryMini
                label="RESPIRATION"
                value={`${Math.round(result.vitals.respiration)}/min`}
                critical={result.vitals.respiration > 24}
              />
              <TelemetryMini
                label="CORE TEMP"
                value={`${result.vitals.core_temp.toFixed(1)} °C`}
                critical={result.vitals.core_temp >= 38.5}
              />
            </div>

            <div className="mt-3 space-y-2.5">
              {steps.map((step, index) => {
                const isChecked = checked[index];
                return (
                  <button
                    key={`${step.title}-${index}`}
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => toggle(index)}
                    className={`group flex w-full items-start gap-3 rounded-[2px] border p-3.5 text-left transition ${
                      isChecked
                        ? "border-[#FFCC00]/70 bg-[#FFCC00]/8"
                        : "border-white/[0.08] bg-[#121214] hover:border-[#FFCC00]/45 hover:bg-[#17171A]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[2px] border transition ${
                        isChecked
                          ? "border-[#FFCC00] bg-[#FFCC00] text-[#0B0B0C]"
                          : "border-white/[0.08] bg-[#121214] text-transparent group-hover:border-[#FFCC00]/50"
                      }`}
                    >
                      <CheckIcon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <span className="font-mono mt-0.5 text-[11px] font-bold leading-none text-[#FFCC00]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`text-[12.5px] font-semibold leading-tight ${
                            isChecked ? "text-[#8E8E93] line-through" : "text-[#FFFFFF]"
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[10.5px] leading-[1.55] text-[#8E8E93]">
                        {step.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-4">
              <div className="mb-2 flex items-center justify-between font-mono text-[8.5px] tracking-[0.1em] text-[#6E6E73]">
                <span>ACKNOWLEDGEMENT</span>
                <span>{checkedCount === steps.length ? "PROTOCOL COMPLETE" : "IN PROGRESS"}</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="font-mono flex w-full items-center justify-center gap-2 rounded-[2px] border border-[#F06464] bg-[#F06464] px-4 py-3 text-[10px] font-bold tracking-[0.14em] text-[#190707] transition hover:bg-[#ff7c7c]"
              >
                ACKNOWLEDGE &amp; DISMISS <CheckIcon />
              </button>
              <p className="mt-2 text-center font-mono text-[7.5px] leading-relaxed tracking-[0.08em] text-[#6E6E73]">
                {result.classification_reason ||
                  "Cross-system risk classification generated from the uploaded dataset."}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-[2px] border border-white/[0.08] bg-[#121214] px-3 py-2">
      <p className="font-mono text-[7.5px] tracking-[0.14em] text-[#6E6E73]">{label}</p>
      <p className="font-mono mt-1 truncate text-[11px] font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function TelemetryMini({
  label,
  value,
  critical,
}: {
  label: string;
  value: string;
  critical?: boolean;
}) {
  return (
    <div
      className={`rounded-[2px] border px-2.5 py-2 ${
        critical ? "border-[#F06464]/60 bg-[#F06464]/10" : "border-white/[0.08] bg-[#121214]"
      }`}
    >
      <p className="font-mono text-[7px] tracking-[0.12em] text-[#6E6E73]">{label}</p>
      <p
        className={`font-mono mt-0.5 text-[11px] font-bold ${
          critical ? "text-[#F06464]" : "text-[#FFFFFF]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Marker({ x, y, n }: { x: number; y: number; n: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="13" fill="#121214" stroke="#FFCC00" strokeWidth="2" />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="9"
        fontWeight="700"
        fill="#FFCC00"
      >
        {n}
      </text>
    </g>
  );
}

function CountermeasureBlueprint({
  domain,
  module,
  interaction,
}: {
  domain: string;
  module: string;
  interaction: string;
}) {
  return (
    <svg
      viewBox="0 0 760 500"
      className="h-auto w-full"
      role="img"
      aria-label="Countermeasure blueprint"
    >
      <defs>
        <pattern id="bp-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth="1" />
        </pattern>
        <filter id="bp-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="bp-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0 0 9 4.5 0 9Z" fill="#FFCC00" />
        </marker>
        <linearGradient id="bp-cyan" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#FFCC00" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#FFCC00" />
          <stop offset="1" stopColor="#FFCC00" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      <rect width="760" height="500" fill="#0E0E10" />
      <rect width="760" height="500" fill="url(#bp-grid)" opacity="0.85" />
      <g stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none">
        <path
          d="M18 52V18h34M728 18h34v34M18 448v34h34M742 448v34h-34"
          stroke="#FFCC00"
          strokeOpacity="0.65"
        />
      </g>

      <text x="34" y="42" fontFamily="monospace" fontSize="9" fill="#FFCC00" letterSpacing="2">
        ISS COUNTERMEASURE ROUTE
      </text>
      <text
        x="726"
        y="42"
        textAnchor="end"
        fontFamily="monospace"
        fontSize="9"
        fill="#6E6E73"
        letterSpacing="1.5"
      >
        {interaction} / {module.toUpperCase()}
      </text>

      {domain === "vestibular" ? (
        <VestibularBlueprint />
      ) : domain === "musculoskeletal" ? (
        <MusculoskeletalBlueprint />
      ) : (
        <ModuleMapBlueprint module={module} radiation={domain === "radiation"} />
      )}

      <text x="34" y="478" fontFamily="monospace" fontSize="8" fill="#6E6E73" letterSpacing="1.2">
        AFFECTED MODULE: {module.toUpperCase()} · SHELTER: SERVICE MODULE
      </text>
      <text
        x="726"
        y="478"
        textAnchor="end"
        fontFamily="monospace"
        fontSize="8"
        fill="#6E6E73"
        letterSpacing="1.2"
      >
        EXECUTE IN ORDER · REASSESS AFTER EACH STEP
      </text>
    </svg>
  );
}

function ModuleMapBlueprint({ module, radiation }: { module: string; radiation: boolean }) {
  const modules = [
    { name: "US Lab", x: 74, y: 132, w: 178, h: 104, note: "DESTINY" },
    { name: "Node 2", x: 292, y: 132, w: 146, h: 104, note: "HARMONY" },
    { name: "Columbus", x: 74, y: 276, w: 150, h: 92, note: "ESA LAB" },
    { name: "Node 3", x: 276, y: 276, w: 162, h: 92, note: "TRANQUILITY" },
    { name: "Service Module", x: 504, y: 164, w: 176, h: 132, note: "SHIELDED" },
  ];
  const affected = modules.find((item) => item.name === module) ?? modules[0];
  const node2 = modules.find((item) => item.name === "Node 2")!;
  const service = modules.find((item) => item.name === "Service Module")!;
  const startX = affected.x + affected.w * 0.5;
  const startY = affected.y + affected.h * 0.5;
  const n2X = node2.x + node2.w * 0.5;
  const n2Y = node2.y + node2.h * 0.5;
  const smX = service.x + service.w * 0.5;
  const smY = service.y + service.h * 0.5;

  return (
    <g>
      {radiation &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={startX}
            cy={startY}
            r={72 + i * 28}
            fill="none"
            stroke="#4DA3FF"
            strokeOpacity={0.18 - i * 0.04}
            strokeDasharray="5 9"
          />
        ))}

      {modules.map((item) => {
        const isAffected = item.name === affected.name;
        const isShelter = item.name === "Service Module";
        return (
          <g key={item.name}>
            <rect
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              rx="2"
              fill={isAffected ? "#F06464" : isShelter ? "#FFCC00" : "#121214"}
              fillOpacity={isAffected ? 0.18 : isShelter ? 0.09 : 0.9}
              stroke={isAffected ? "#F06464" : isShelter ? "#FFCC00" : "rgba(255,255,255,0.08)"}
              strokeWidth={isAffected || isShelter ? 2.5 : 1.5}
              filter={isAffected ? "url(#bp-glow)" : undefined}
            />
            <text
              x={item.x + 13}
              y={item.y + 25}
              fontFamily="monospace"
              fontSize="11"
              fontWeight="700"
              fill={isAffected ? "#F06464" : isShelter ? "#FFCC00" : "#D6D6D9"}
            >
              {item.name.toUpperCase()}
            </text>
            <text
              x={item.x + 13}
              y={item.y + 41}
              fontFamily="monospace"
              fontSize="7.5"
              fill="#6E6E73"
              letterSpacing="1"
            >
              {item.note}
            </text>
            {isAffected && (
              <g>
                <rect
                  x={item.x + 13}
                  y={item.y + item.h - 25}
                  width="70"
                  height="15"
                  rx="7.5"
                  fill="#F06464"
                />
                <text
                  x={item.x + 48}
                  y={item.y + item.h - 14.5}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="7"
                  fontWeight="700"
                  fill="#190707"
                  letterSpacing="0.8"
                >
                  AFFECTED
                </text>
              </g>
            )}
            {isShelter && (
              <g>
                <rect
                  x={item.x + 13}
                  y={item.y + item.h - 25}
                  width="70"
                  height="15"
                  rx="7.5"
                  fill="#FFCC00"
                />
                <text
                  x={item.x + 48}
                  y={item.y + item.h - 14.5}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="7"
                  fontWeight="700"
                  fill="#0B0B0C"
                  letterSpacing="0.8"
                >
                  SHELTER
                </text>
              </g>
            )}
          </g>
        );
      })}

      <path
        d={`M${startX} ${startY} C ${startX + 40} ${startY - 76}, ${n2X - 46} ${n2Y - 70}, ${n2X} ${n2Y} S ${smX - 58} ${smY - 94}, ${smX} ${smY}`}
        fill="none"
        stroke="url(#bp-cyan)"
        strokeWidth="3.2"
        strokeDasharray="8 7"
        markerEnd="url(#bp-arrow)"
        className="bp-dash"
      />
      <Marker x={startX} y={startY} n="01" />
      <Marker x={n2X} y={n2Y} n="02" />
      <Marker x={smX} y={smY} n="03" />

      <g fontFamily="monospace" fontSize="8" fill="#8E8E93" letterSpacing="0.8">
        <text x={startX - 12} y={startY + 34}>
          ISOLATE
        </text>
        <text x={n2X - 22} y={n2Y - 24}>
          O₂ + MONITOR
        </text>
        <text x={smX - 24} y={smY + 32}>
          SHELTER
        </text>
      </g>

      <g transform="translate(504 340)">
        <rect width="176" height="86" rx="2" fill="#121214" stroke="rgba(255,255,255,0.08)" />
        <text x="12" y="18" fontFamily="monospace" fontSize="8" fill="#6E6E73" letterSpacing="1">
          CARRY LIST
        </text>
        {["Portable O₂ + mask", "Pulse oximeter", "Medical checklist"].map((item, i) => (
          <g key={item}>
            <circle cx="17" cy={34 + i * 16} r="2.5" fill="#FFCC00" />
            <text x="26" y={37 + i * 16} fontFamily="monospace" fontSize="8" fill="#D6D6D9">
              {item}
            </text>
          </g>
        ))}
      </g>
    </g>
  );
}

function VestibularBlueprint() {
  return (
    <g>
      <circle
        cx="194"
        cy="244"
        r="86"
        fill="#121214"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.5"
      />
      <path
        d="M194 158c-38 0-68 27-68 61 0 18 8 34 21 46-10-16-14-34-11-52 4-28 27-48 58-48 24 0 43 12 54 30"
        fill="none"
        stroke="#F06464"
        strokeWidth="3"
        filter="url(#bp-glow)"
      />
      <circle cx="194" cy="244" r="52" fill="#121214" stroke="rgba(255,255,255,0.08)" />
      <path
        d="M172 236c10-20 34-18 42 0 7 15-4 31-20 31-15 0-26-14-22-31Z"
        fill="none"
        stroke="#9B8CFF"
        strokeWidth="2"
      />
      <path d="M182 238h20M192 228v20" stroke="#9B8CFF" strokeWidth="1.5" />
      <circle cx="188" cy="236" r="5" fill="#9B8CFF" />
      <path
        d="M206 250c18-10 34-11 48-4"
        fill="none"
        stroke="#FFCC00"
        strokeWidth="2.4"
        markerEnd="url(#bp-arrow)"
      />
      <text
        x="194"
        y="342"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="8"
        fill="#8E8E93"
        letterSpacing="1"
      >
        VOR / GAZE LOCK
      </text>

      <g transform="translate(332 172)">
        <rect width="160" height="142" rx="2" fill="#121214" stroke="rgba(255,255,255,0.08)" />
        <text x="13" y="22" fontFamily="monospace" fontSize="8" fill="#FFCC00" letterSpacing="1">
          VESTIBULAR KIT
        </text>
        <rect
          x="18"
          y="38"
          width="124"
          height="40"
          rx="2"
          fill="#121214"
          stroke="rgba(255,255,255,0.08)"
        />
        <path d="M32 58h96M46 58v8M74 58v8M102 58v8" stroke="#9B8CFF" strokeWidth="2" />
        <text x="18" y="102" fontFamily="monospace" fontSize="8" fill="#D6D6D9">
          VOR goggles
        </text>
        <path d="M30 118h54" stroke="#9B8CFF" strokeWidth="2" />
        <text x="18" y="134" fontFamily="monospace" fontSize="8" fill="#D6D6D9">
          Antiemetic kit
        </text>
      </g>

      <g transform="translate(528 172)">
        <rect
          width="168"
          height="132"
          rx="2"
          fill="#121214"
          stroke="#FFCC00"
          strokeOpacity="0.55"
        />
        <text x="13" y="22" fontFamily="monospace" fontSize="8" fill="#FFCC00" letterSpacing="1">
          ESCORT ROUTE
        </text>
        <path
          d="M24 62h120M34 46v32M134 46v32"
          stroke="#FFCC00"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M44 62c18-18 58-18 86 0"
          fill="none"
          stroke="#FFCC00"
          strokeOpacity="0.4"
          strokeDasharray="4 5"
        />
        <text x="24" y="96" fontFamily="monospace" fontSize="8" fill="#D6D6D9">
          Handrail restraint
        </text>
        <text x="24" y="112" fontFamily="monospace" fontSize="8" fill="#6E6E73">
          Service Module shelter
        </text>
      </g>

      <path
        d="M232 292 C 286 356, 328 358, 390 300 S 510 274, 562 226"
        fill="none"
        stroke="url(#bp-cyan)"
        strokeWidth="3.2"
        strokeDasharray="8 7"
        markerEnd="url(#bp-arrow)"
        className="bp-dash"
      />
      <Marker x={232} y={292} n="01" />
      <Marker x={390} y={300} n="02" />
      <Marker x={562} y={226} n="03" />
      <text x={34} y={456} fontFamily="monospace" fontSize="8" fill="#8E8E93" letterSpacing="1">
        FIX GAZE · ANTIEMETIC · SLOW HEAD MOVEMENTS
      </text>
    </g>
  );
}

function MusculoskeletalBlueprint() {
  return (
    <g>
      <g transform="translate(74 164)">
        <circle cx="52" cy="34" r="21" fill="#121214" stroke="rgba(255,255,255,0.08)" />
        <path
          d="M52 56v56M52 74l-28 22M52 74l28 22M52 112l-20 48M52 112l22 48"
          stroke="#D6D6D9"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M30 150l-14 34M76 150l14 34"
          stroke="#F06464"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#bp-glow)"
        />
        <circle
          cx="76"
          cy="128"
          r="15"
          fill="none"
          stroke="#F06464"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <text
          x="52"
          y="222"
          textAnchor="middle"
          fontFamily="monospace"
          fontSize="8"
          fill="#8E8E93"
          letterSpacing="1"
        >
          AFFECTED LIMB
        </text>
      </g>

      <g transform="translate(248 176)">
        <rect width="156" height="130" rx="2" fill="#121214" stroke="rgba(255,255,255,0.08)" />
        <text x="13" y="22" fontFamily="monospace" fontSize="8" fill="#FFCC00" letterSpacing="1">
          SPLINT / COLD
        </text>
        <rect x="18" y="42" width="120" height="26" rx="13" fill="#121214" stroke="#FFCC00" />
        <path d="M44 42v26M74 42v26M104 42v26" stroke="#FFCC00" strokeWidth="1.5" />
        <path d="M38 90h80M78 76v28" stroke="#4DA3FF" strokeWidth="2.5" />
        <text x="18" y="114" fontFamily="monospace" fontSize="8" fill="#D6D6D9">
          Immobilise · cold pack
        </text>
      </g>

      <g transform="translate(440 164)">
        <rect width="250" height="154" rx="2" fill="#121214" stroke="rgba(255,255,255,0.08)" />
        <text x="14" y="22" fontFamily="monospace" fontSize="8" fill="#FFCC00" letterSpacing="1">
          ARED LOAD CONTROL
        </text>
        <path
          d="M24 94h196M38 74v40M206 74v40"
          stroke="#FFCC00"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect
          x="82"
          y="58"
          width="82"
          height="38"
          rx="8"
          fill="#121214"
          stroke="rgba(255,255,255,0.08)"
        />
        <text x="123" y="81" textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#D6D6D9">
          LOAD 0
        </text>
        <path
          d="M54 132h140"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path d="M54 132h52" stroke="#FFCC00" strokeWidth="8" strokeLinecap="round" />
        <text x="24" y="126" fontFamily="monospace" fontSize="8" fill="#6E6E73">
          REDUCE RESISTANCE
        </text>
      </g>

      <path
        d="M196 314 C 260 372, 312 360, 354 306 S 480 340, 540 286"
        fill="none"
        stroke="url(#bp-cyan)"
        strokeWidth="3.2"
        strokeDasharray="8 7"
        markerEnd="url(#bp-arrow)"
        className="bp-dash"
      />
      <Marker x={196} y={314} n="01" />
      <Marker x={354} y={306} n="02" />
      <Marker x={540} y={286} n="03" />
      <text x={34} y={456} fontFamily="monospace" fontSize="8" fill="#8E8E93" letterSpacing="1">
        IMMOBILISE · UNLOAD ARED · CHECK DISTAL CIRCULATION
      </text>
    </g>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m4 12 5 5L20 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
