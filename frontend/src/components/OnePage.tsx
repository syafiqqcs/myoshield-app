import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp, type Route } from "../lib/store";
import { DOMAINS, type Domain } from "../lib/data";
import { deriveHealthDomains } from "../lib/healthDomains";
import Overview from "../pages/Overview";
import Profiles from "../pages/Profiles";
import Datasets from "../pages/Datasets";
import AnalysisPage from "../pages/Analysis";
import { Cardiovascular, Musculoskeletal, Radiation, Vestibular } from "../pages/Domains";
import Intelligence from "../pages/Intelligence";
import Reports from "../pages/Reports";
import DailyQuests from "./DailyQuests";
import Settings from "../pages/Settings";
import DatasetUploadBar from "./DatasetUploadBar";
import FlightSurgeonChat from "./FlightSurgeonChat";
import AnomalyPopupModal from "./AnomalyPopupModal";
import MissionReportModal from "./MissionReportModal";
import AudioAlertToggle from "./AudioAlertToggle";
import CompanionMascot from "./CompanionMascot";
import { Icon, Logo } from "./ui";
import type {
  ChatAstronaut,
  DomainScores,
  LiveTelemetry,
  UploadAnalysis,
  Vitals as VitalsValues,
} from "../lib/api";

type Section = { r: Route; label: string; el: ReactNode; roles?: string[] };

const SECTIONS: Section[] = [
  { r: "overview", label: "Overview", el: <Overview /> },
  {
    r: "profiles",
    label: "Profiles",
    el: <Profiles />,
    roles: ["Researcher", "Mission Health Specialist"],
  },
  {
    r: "datasets",
    label: "Datasets",
    el: <Datasets />,
    roles: ["Researcher", "Mission Health Specialist"],
  },
  { r: "analysis", label: "Analysis", el: <AnalysisPage /> },
  { r: "radiation", label: "Radiation", el: <Radiation /> },
  { r: "musculoskeletal", label: "Musculoskeletal", el: <Musculoskeletal /> },
  { r: "vestibular", label: "Vestibular", el: <Vestibular /> },
  { r: "cardiovascular", label: "Cardiovascular", el: <Cardiovascular /> },
  {
    r: "intelligence",
    label: "Intelligence",
    el: <Intelligence />,
    roles: ["Researcher", "Mission Health Specialist"],
  },
  { r: "reports", label: "Reports", el: <Reports /> },
  { r: "settings", label: "Settings", el: <Settings /> },
];

type SecId = Route | "quests";
const secId = (r: SecId) => `sec-${r}`;
const DOMAIN_KEYS = Object.keys(DOMAINS) as Domain[];

/** Minimal HUD strip: one glowing bar per health domain, filled by how many datasets are loaded. */
function Coverage() {
  const { datasets, subjectId } = useApp();
  const max = Math.max(1, ...DOMAIN_KEYS.map((d) => datasets.filter((x) => x.domain === d).length));
  return (
    <div>
      <p className="font-mono mb-5 text-[11px] tracking-[0.14em] text-[#8E8E93]">DATA COVERAGE</p>
      <div className="grid gap-x-12 gap-y-6 md:grid-cols-2">
        {DOMAIN_KEYS.map((d) => {
          const n = datasets.filter((x) => x.domain === d).length;
          return (
            <div key={d}>
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] text-[#FFFFFF]">{DOMAINS[d].label}</span>
                <span className="font-mono text-[12px] text-[#8E8E93]">
                  {n ? `${n} dataset${n > 1 ? "s" : ""}` : "No data"}
                </span>
              </div>
              <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-[#ffffff14]">
                <div
                  className="h-full rounded-[1px] bg-[#FFCC00]"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="font-mono text-[11px] text-[#6E6E73] md:col-span-2">
          SUBJECT {subjectId} · BARS SHOW LOADED DATASETS PER DOMAIN
        </p>
      </div>
    </div>
  );
}

/* ---- Simulated vitals. No live sensor is connected, so these are fixed demonstration values. ---- */

/** 270-degree ring gauge with a glowing blue arc. */
function Gauge({
  label,
  value,
  unit,
  min,
  max,
  accent = "#35D6C0",
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  accent?: string;
}) {
  const r = 58;
  const C = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return (
    <div className="flex flex-col items-center rounded-[2px] border border-white/[0.08] bg-[#121214] px-4 pb-5 pt-6">
      <div className="relative h-[150px] w-[150px]">
        <svg viewBox="0 0 150 150" className="absolute inset-0" aria-hidden>
          <g transform="rotate(135 75 75)" fill="none" strokeLinecap="round" strokeWidth="9">
            <circle
              cx="75"
              cy="75"
              r={r}
              stroke="rgba(255,255,255,0.07)"
              strokeDasharray={`${0.75 * C} ${C}`}
            />
            <circle
              cx="75"
              cy="75"
              r={r}
              stroke={accent}
              strokeDasharray={`${0.75 * C * frac} ${C}`}
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[36px] leading-none tabular-nums text-[#FFFFFF]">
            {value}
          </span>
          <span className="font-mono mt-1 text-[11px] text-[#8E8E93]">{unit}</span>
        </div>
      </div>
      <p className="mt-1 text-[14px] text-[#D6D6D9]">{label}</p>
    </div>
  );
}

/** One PQRST beat, 100 units wide, centred on y=70. */
const BEAT = "L18 70 Q24 62 30 70 L40 70 L44 76 L50 14 L56 104 L60 70 L72 70 Q82 52 92 70 L100 70";
const ECG_PATH =
  "M0 70 " +
  Array.from(
    { length: 8 },
    (_, i) =>
      `M${i * 100} 70 ${BEAT.replace(/([LQ])([\d.]+) ([\d.]+)(?: ([\d.]+) ([\d.]+))?/g, (_m, c, x, y, x2, y2) => (c === "Q" ? `Q${+x + i * 100} ${y} ${+x2 + i * 100} ${y2}` : `L${+x + i * 100} ${y}`))}`,
  ).join(" ");

function Ecg({ heartRate }: { heartRate: number }) {
  const critical = heartRate > 115;
  const elevated = heartRate > 100;
  const trace = critical ? "#F06464" : elevated ? "#F2B84B" : "#35D6C0";
  const label = critical ? "CRITICAL" : elevated ? "ELEVATED" : "RESTING";
  return (
    <div className="rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8E8E93]">
            HEART RATE
          </p>
          <p className="font-bold-sans mt-2 text-[56px] leading-none text-[#FFFFFF]">
            {heartRate}
            <span className="ml-2 text-[18px] font-normal text-[#8E8E93]">bpm</span>
          </p>
        </div>
        <span
          className="font-mono rounded-[2px] border px-3 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em]"
          style={{
            color: critical ? "#F06464" : elevated ? "#F5A623" : "#35D6C0",
            borderColor: critical ? "#F06464" : elevated ? "#F2B84B" : "#35D6C0",
            background: critical
              ? "rgba(240,100,100,0.12)"
              : elevated
                ? "rgba(242,184,75,0.12)"
                : "rgba(53,214,192,0.12)",
          }}
        >
          {label}
        </span>
      </div>
      <div className="relative mt-6 h-[140px] overflow-hidden">
        <svg viewBox="0 0 600 140" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          <g className="ecg-scroll">
            <path
              d={ECG_PATH}
              fill="none"
              stroke={trace}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#121214] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#121214] to-transparent" />
      </div>
    </div>
  );
}

const WEEK = [61, 63, 60, 62, 64, 61, 62];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function Trend() {
  const lo = 56;
  const hi = 68;
  const pts = WEEK.map((v, i) => [8 + i * (284 / 6), 90 - ((v - lo) / (hi - lo)) * 80] as const);
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <div className="rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8E8E93]">
        RESTING HR · 7 DAYS
      </p>
      <svg viewBox="0 0 300 110" className="mt-5 h-[140px] w-full" aria-hidden>
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#35D6C0" stopOpacity="0.3" />
            <stop offset="1" stopColor="#35D6C0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${line} 300,100`} fill="url(#trend-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#35D6C0"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.2" fill="#0B0B0C" stroke="#35D6C0" strokeWidth="2" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-0.5 font-mono text-[11px] text-[#6E6E73]">
        {DAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </div>
  );
}

const STATS: { label: string; value: string; unit: string; note: string }[] = [
  { label: "Heart rate variability", value: "54", unit: "ms", note: "RMSSD" },
  { label: "Sleep last night", value: "7.1", unit: "h", note: "Deep 1.6 h" },
  { label: "Exercise today", value: "142", unit: "min", note: "Resistive + cardio" },
  {
    label: "Cabin radiation",
    value: "0.52",
    unit: "mSv/day",
    note: "Environment, not personal dose",
  },
];

function MiniBars({ data, color, labels }: { data: number[]; color: string; labels?: string[] }) {
  const lo = Math.min(...data) * 0.9;
  const hi = Math.max(...data);
  return (
    <div>
      <div className="flex h-[96px] items-end gap-2">
        {data.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md transition-[height] duration-500 ease-out"
            style={{
              height: `${12 + ((v - lo) / (hi - lo || 1)) * 88}%`,
              background: color,
              opacity: i === data.length - 1 ? 1 : 0.4,
            }}
          />
        ))}
      </div>
      {labels && (
        <div className="font-mono mt-2 flex justify-between text-[10px] text-[#6E6E73]">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniLine({ data, color, id }: { data: number[]; color: string; id: string }) {
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const pts = data.map(
    (v, i) => `${6 + i * (288 / (data.length - 1))},${14 + (1 - (v - lo) / (hi - lo || 1)) * 62}`,
  );
  return (
    <svg viewBox="0 0 300 96" className="h-[96px] w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`6,96 ${pts.join(" ")} 294,96`} fill={`url(#${id})`} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DomainCard({
  color,
  title,
  big,
  unit,
  children,
  stats,
  note,
}: {
  color: string;
  title: string;
  big: string;
  unit: string;
  children: ReactNode;
  stats: [string, string][];
  note: string;
}) {
  return (
    <div className="flex flex-col rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
      <div className="flex items-center gap-2.5">
        <i className="h-2.5 w-2.5 rounded-[1px]" style={{ background: color }} />
        <span className="text-[15px] text-[#FFFFFF]">{title}</span>
      </div>
      <p className="font-bold-sans mt-5 text-[44px] leading-none text-[#FFFFFF]">
        {big}
        <span className="ml-2 text-[15px] font-normal text-[#8E8E93]">{unit}</span>
      </p>
      <div className="mt-6">{children}</div>
      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[rgba(255,255,255,0.08)] pt-4">
        {stats.map(([k, v]) => (
          <div key={k}>
            <p className="font-mono text-[10px] tracking-[0.1em] text-[#6E6E73]">{k}</p>
            <p className="mt-1 text-[15px] text-[#FFFFFF]">{v}</p>
          </div>
        ))}
      </div>
      <p className="font-mono mt-4 text-[10.5px] text-[#6E6E73]">{note}</p>
    </div>
  );
}

/** Per-domain snapshots, updated from the latest real .joblib result. */
function DomainPanels({ result }: { result: UploadAnalysis | null }) {
  const panels = useMemo(() => deriveHealthDomains(result), [result]);
  return (
    <div>
      <p className="font-mono mb-5 text-[11px] tracking-[0.14em] text-[#8E8E93]">HEALTH DOMAINS</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <DomainCard
          color="#4DA3FF"
          title="Radiation"
          big={panels.radiation.big}
          unit="mSv/day"
          stats={[
            ["7-DAY TOTAL", panels.radiation.weekTotal],
            ["SAA PASSES TODAY", panels.radiation.saaPasses],
          ]}
          note={panels.radiation.note}
        >
          <MiniBars data={panels.radiation.series} color="#4DA3FF" labels={DAYS} />
        </DomainCard>

        <DomainCard
          color="#35D6C0"
          title="Musculoskeletal"
          big={panels.musculoskeletal.big}
          unit="% strength retained"
          stats={[
            ["BONE DENSITY", panels.musculoskeletal.boneDensity],
            ["SESSIONS THIS WEEK", panels.musculoskeletal.sessions],
          ]}
          note={panels.musculoskeletal.note}
        >
          <MiniLine data={panels.musculoskeletal.series} color="#35D6C0" id="musc-fill" />
        </DomainCard>

        <DomainCard
          color="#9B8CFF"
          title="Vestibular"
          big={panels.vestibular.big}
          unit="cm postural sway"
          stats={[
            ["GAZE STABILITY", panels.vestibular.gazeStability],
            ["MOTION SICKNESS", panels.vestibular.motionSickness],
          ]}
          note={panels.vestibular.note}
        >
          <MiniLine data={panels.vestibular.series} color="#9B8CFF" id="vest-fill" />
        </DomainCard>
      </div>
    </div>
  );
}

function Vitals({
  subjectId,
  vitals,
  riskScores,
  readiness,
  interactionMode,
}: {
  subjectId: string;
  vitals: VitalsValues;
  riskScores: DomainScores | null;
  readiness: number | null;
  interactionMode: string;
}) {
  const critical =
    vitals.spo2 < 92 ||
    vitals.heartRate > 115 ||
    vitals.respiration > 24 ||
    vitals.coreTemp >= 38.5;
  const statusLabel = riskScores ? interactionMode : "NOMINAL";

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <i
            className={`live-dot h-2 w-2 rounded-full ${critical ? "bg-[#F06464]" : "bg-[#35D6C0]"}`}
            style={{ boxShadow: critical ? "0 0 10px #F06464" : "0 0 10px #35D6C0" }}
          />
          <span className="font-mono text-[11px] tracking-[0.14em] text-[#8E8E93]">
            {subjectId} · STATUS {statusLabel}
          </span>
        </div>
        <span className="font-mono rounded-[2px] border border-[#F2B84B]/40 bg-[#F2B84B]/10 px-3 py-1 text-[9.5px] uppercase tracking-[0.12em] text-[#F2B84B]">
          {riskScores ? "DATASET-DERIVED VITALS" : "SIMULATED VITALS · NO LIVE SENSOR"}
        </span>
      </div>

      {riskScores && (
        <section className="mb-4 rounded-[2px] border border-white/[0.08] bg-[#121214] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] tracking-[0.14em] text-[#8E8E93]">
              LATEST UPLOAD · DOMAIN RISK
            </p>
            <span className="font-mono text-[11px] text-[#8E8E93]">
              MISSION READINESS {readiness !== null ? `${readiness.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {DOMAIN_KEYS.map((d) => {
              const score = Number(riskScores[d] ?? 0);
              const hot = score >= 0.66;
              return (
                <div key={d}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-[#8E8E93]">{DOMAINS[d].short}</span>
                    <span
                      className="font-mono text-[11px] font-bold"
                      style={{ color: hot ? "#F06464" : "#6E6E73" }}
                    >
                      {score.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-white/[0.06] gauge-track">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(3, Math.min(100, score * 100))}%`,
                        background: hot ? "#F06464" : DOMAINS[d].color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Gauge
          label="Heart rate"
          value={Math.round(vitals.heartRate)}
          unit="bpm"
          min={40}
          max={120}
          accent={vitals.heartRate > 115 ? "#F06464" : "#35D6C0"}
        />
        <Gauge
          label="Blood oxygen"
          value={Math.round(vitals.spo2)}
          unit="% SpO2"
          min={85}
          max={100}
          accent={vitals.spo2 < 92 ? "#F06464" : "#35D6C0"}
        />
        <Gauge
          label="Respiration"
          value={Math.round(vitals.respiration)}
          unit="breaths/min"
          min={8}
          max={30}
          accent={vitals.respiration > 24 ? "#F06464" : "#35D6C0"}
        />
        <Gauge
          label="Core temperature"
          value={Number(vitals.coreTemp.toFixed(1))}
          unit="°C"
          min={35}
          max={39}
          accent={vitals.coreTemp >= 38.5 ? "#F06464" : "#35D6C0"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Ecg heartRate={Math.round(vitals.heartRate)} />
        <Trend />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-[2px] border border-white/[0.08] bg-[#121214] p-5">
            <p className="text-[13px] text-[#8E8E93]">{s.label}</p>
            <p className="font-mono mt-3 text-[28px] leading-none tabular-nums text-[#FFFFFF]">
              {s.value}
              <span className="ml-1.5 text-[14px] font-normal text-[#8E8E93]">{s.unit}</span>
            </p>
            <p className="font-mono mt-3 text-[11px] text-[#6E6E73]">{s.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnePage({ children }: { children?: ReactNode }) {
  const {
    role,
    signOut,
    go,
    subjects,
    subjectId,
    setSubjectId,
    settings,
    navTick,
    route,
    notify,
    latest,
    publishAnalysis,
    anomalyOpen,
    setAnomalyOpen,
  } = useApp();
  const [active, setActive] = useState<SecId>("overview");
  const [chatOpen, setChatOpen] = useState(false);

  // Live telemetry starts at the simulated baseline and is replaced by the
  // uploaded/library dataset's vitals after every real analysis.
  const vitals: VitalsValues = latest
    ? {
        spo2: latest.result.vitals.spo2,
        heartRate: latest.result.vitals.heart_rate,
        respiration: latest.result.vitals.respiration,
        coreTemp: latest.result.vitals.core_temp,
      }
    : { spo2: 98, heartRate: 62, respiration: 15, coreTemp: 36.8 };
  const interactionMode = latest?.result.interaction_type || "NOMINAL";
  const issModule = latest?.result.iss_module || "US Lab";
  const riskScores: DomainScores | null = latest?.result.domain_scores ?? null;
  const readiness: number | null = latest?.result.mission_readiness_score ?? null;
  const anomaly: UploadAnalysis | null = latest?.result ?? null;

  const liveTelemetry: LiveTelemetry = useMemo(
    () => ({ ...vitals, issModule, interactionMode }),
    [vitals, issModule, interactionMode],
  );

  // The selected profile travels with every emergency-chat request so the Flight
  // Surgeon can address the astronaut by name, ID, role and ISS module.
  const astronautProfile: ChatAstronaut = useMemo(() => {
    const subject = subjects.find((s) => s.id === subjectId);
    return {
      id: subject?.id ?? subjectId,
      name: subject?.name ?? subjectId,
      role: subject?.type ?? "ISS crew",
      issModule,
    };
  }, [subjects, subjectId, issModule]);

  const handleUploadResult = (result: UploadAnalysis) => {
    publishAnalysis(result, {
      sourceName: result.filename || "uploaded_dataset",
      sourceKind: "upload",
    });
    notify(`Upload analyzed: ${result.status.replace(/_/g, " ")} · ${result.interaction_type}`);
  };

  const sections = SECTIONS.filter(
    (s) =>
      (!s.roles || s.roles.includes(role!)) &&
      !(s.r === "analysis" && role === "Astronaut" && !settings.allowAstronautUploads),
  );

  const navItems: { r: SecId; label: string }[] = [
    sections[0],
    { r: "quests", label: "Quests" },
    ...sections.slice(1),
  ];

  // Pages call go(route) internally; in one page that means "scroll to that section".
  useEffect(() => {
    if (!navTick) return;
    if (route === "overview") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(secId(route))?.scrollIntoView({ behavior: "smooth" });
  }, [navTick, route]);

  // Highlight the section currently in view.
  useEffect(() => {
    const els = [...sections.map((s) => s.r), "quests" as SecId]
      .map((r) => document.getElementById(secId(r)))
      .filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive(e.target.id.replace("sec-", "") as SecId);
      },
      { rootMargin: "-30% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections.length]);

  const jump = (r: SecId) => {
    if (r === "overview") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(secId(r))?.scrollIntoView({ behavior: "smooth" });
  };

  const railItems = [
    {
      n: "01",
      label: "Crew",
      icon: "users" as const,
      action: () => jump(sections.some((s) => s.r === "profiles") ? "profiles" : "overview"),
    },
    { n: "02", label: "Analysis", icon: "play" as const, action: () => jump("analysis") },
    { n: "03", label: "Domains", icon: "heart" as const, action: () => jump("radiation") },
    { n: "04", label: "AI Surgeon", icon: "shield" as const, action: () => setChatOpen(true) },
  ];
  const railOn = (n: string) =>
    n === "01"
      ? active === "profiles" || active === "overview"
      : n === "02"
        ? active === "analysis"
        : n === "03"
          ? ["radiation", "musculoskeletal", "vestibular", "cardiovascular"].includes(active)
          : chatOpen;

  return (
    <>
      {/* ---- 64px editorial rail ---- */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center border-r border-white/[0.08] bg-[#0B0B0C] lg:flex">
        <button
          onClick={() => go("landing")}
          aria-label="MYOSHIELD home"
          className="flex h-16 w-full items-center justify-center border-b border-white/[0.08]"
        >
          <span className="grid h-8 w-10 place-items-center border-2 border-[#FFCC00]">
            <span className="font-bold-sans text-[15px] leading-none text-[#FFCC00]">M</span>
          </span>
        </button>

        <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
          {railItems.map((item) => {
            const on = railOn(item.n);
            return (
              <button
                key={item.n}
                onClick={item.action}
                aria-label={`${item.n} ${item.label}`}
                aria-current={on ? "true" : undefined}
                className={`group flex w-full flex-col items-center gap-1 border-l-2 py-3 transition ${
                  on
                    ? "border-[#FFCC00] bg-[#FFCC00]/[0.06]"
                    : "border-transparent hover:border-white/20 hover:bg-white/[0.03]"
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-[2px] border transition ${
                    on
                      ? "border-[#FFCC00]/60 text-[#FFCC00]"
                      : "border-white/[0.08] text-[#8E8E93] group-hover:text-[#FFFFFF]"
                  }`}
                >
                  <Icon name={item.icon} size={16} />
                </span>
                <span
                  className={`font-mono text-[8px] tabular-nums ${on ? "text-[#FFCC00]" : "text-[#6E6E73]"}`}
                >
                  {item.n}
                </span>
                <span
                  className={`px-0.5 text-center font-mono text-[7.5px] uppercase leading-tight tracking-[0.1em] ${on ? "text-[#FFFFFF]" : "text-[#8E8E93]"}`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex w-full flex-col items-center gap-2 border-t border-white/[0.08] py-4">
          <button
            onClick={() => setChatOpen(true)}
            aria-label="Ask the Flight Surgeon AI"
            title="Flight Surgeon quick trigger"
            className="grid h-10 w-10 place-items-center rounded-full bg-[#FFCC00] text-[#0B0B0C] transition hover:bg-[#FFD633]"
          >
            <Icon name="shield" size={17} />
          </button>
          <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#6E6E73]">
            AI
          </span>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="grid h-8 w-8 place-items-center text-[#6E6E73] transition hover:text-[#FFFFFF]"
          >
            <Icon name="logout" size={15} />
          </button>
        </div>
      </aside>

      <div className="hud min-h-screen lg:pl-16">
        <header className="no-print sticky top-0 z-30 border-b border-[rgba(255,255,255,0.08)] bg-[#0B0B0C]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-5 py-3 md:px-8">
            <button
              onClick={() => go("landing")}
              className="flex shrink-0 items-center gap-2 text-[#FFFFFF]"
              aria-label="MYOSHIELD home"
            >
              <Logo size={16} />
            </button>
            <nav className="no-scrollbar -mx-2 flex min-w-0 flex-1 gap-1 overflow-x-auto lg:hidden">
              {navItems.map((s) => (
                <button
                  key={s.r}
                  onClick={() => jump(s.r)}
                  aria-current={active === s.r ? "true" : undefined}
                  className={`font-mono shrink-0 rounded-[2px] border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition ${
                    active === s.r
                      ? "border-[#FFCC00] bg-[#FFCC00]/12 text-[#FFCC00]"
                      : "border-transparent text-[#8E8E93] hover:border-white/[0.08] hover:text-[#FFFFFF]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
            <select
              className="hidden !h-8 !w-[170px] shrink-0 !rounded-[2px] !px-3 !text-[12px] 2xl:block input"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                notify(`Selected ${e.target.value}`);
              }}
              aria-label="Selected subject or study"
            >
              {(role === "Astronaut" ? subjects.filter((s) => s.owner) : subjects).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
            </select>
            <AudioAlertToggle />
            <button
              onClick={() => setChatOpen(true)}
              className="font-mono inline-flex shrink-0 items-center gap-2 rounded-[2px] border border-[#FFCC00] px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] transition hover:brightness-110"
              style={{ background: "#FFCC00", color: "#0B0B0C" }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F06464] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#F06464]" />
              </span>
              <span className="hidden md:inline">ASK FLIGHT SURGEON AI</span>
              <span className="md:hidden">AI SURGEON</span>
            </button>
            <button
              onClick={signOut}
              className="shrink-0 text-[13px] text-[#8E8E93] transition hover:text-[#FFFFFF]"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-5 md:px-8">
          <div
            id="sec-hero"
            className="flex scroll-mt-24 flex-wrap items-end justify-between gap-4 pb-6 pt-10"
          >
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8E8E93]">
                MISSION CONTROL · {subjectId}
              </p>
              <p className="serif mt-2 text-[28px] leading-none text-[#FFFFFF] sm:text-[34px]">
                {role === "Astronaut" ? "Crew health uplink." : "Flight surgeon console."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono inline-flex items-center gap-2 rounded-[2px] border border-white/[0.08] bg-[#121214] px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[#8E8E93]">
                <i
                  className={`h-1.5 w-1.5 rounded-full ${latest ? "live-dot bg-[#35D6C0]" : "bg-[#F2B84B]"}`}
                  style={{ boxShadow: latest ? "0 0 8px #35D6C0" : "0 0 8px #F2B84B" }}
                />
                MODEL STATUS · 4 DOMAIN MODELS {latest ? "LIVE" : "STANDBY"}
              </span>
              <span className="font-mono rounded-[2px] border border-[#FFCC00]/35 bg-[#FFCC00]/[0.06] px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[#FFCC00]">
                {latest
                  ? `${latest.result.interaction_type} · READINESS ${latest.result.mission_readiness_score.toFixed(0)}%`
                  : "AWAITING TELEMETRY"}
              </span>
            </div>
          </div>
          <section id="sec-top" className="scroll-mt-24 pb-16">
            <div id="sec-upload" className="scroll-mt-24">
              <DatasetUploadBar
                onResult={handleUploadResult}
                onReview={() => setAnomalyOpen(true)}
              />
            </div>
            <div id="sec-domains" className="mt-6 scroll-mt-24">
              <DomainPanels result={latest?.result ?? null} />
            </div>
            <div id="sec-vitals" className="mt-14 scroll-mt-24">
              <Vitals
                subjectId={subjectId}
                vitals={vitals}
                riskScores={riskScores}
                readiness={readiness}
                interactionMode={interactionMode}
              />
            </div>
          </section>

          <section
            id="sec-quests"
            className="scroll-mt-20 border-t border-[rgba(255,255,255,0.08)] py-14"
          >
            <DailyQuests />
          </section>

          <section
            id="sec-coverage"
            className="scroll-mt-20 border-t border-[rgba(255,255,255,0.08)] py-14"
          >
            <Coverage />
          </section>

          {sections.map((s) => (
            <section
              key={s.r}
              id={secId(s.r)}
              className="scroll-mt-20 border-t border-[rgba(255,255,255,0.08)] py-14"
            >
              {s.el}
            </section>
          ))}

          <footer className="no-print border-t border-[rgba(255,255,255,0.08)] py-8">
            <p className="font-mono text-[10.5px] text-[#6E6E73]">
              MYOSHIELD is a research and decision-support tool, not a clinically validated
              diagnostic system.
            </p>
          </footer>
        </main>
      </div>

      <FlightSurgeonChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        liveTelemetry={liveTelemetry}
        astronaut={astronautProfile}
        analysisResult={anomaly}
      />
      <AnomalyPopupModal
        open={anomalyOpen}
        result={anomaly}
        filename={anomaly?.filename}
        onClose={() => setAnomalyOpen(false)}
      />
      <MissionReportModal />
      <CompanionMascot suppressed={chatOpen} />

      {children}
    </>
  );
}
