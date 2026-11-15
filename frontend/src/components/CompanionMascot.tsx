import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { DAILY_QUESTS, DAILY_QUESTS_EVENT, DAILY_QUESTS_KEY, dayKey } from "./DailyQuests";

const TOUR_KEY = "myoshield_tour_completed";
const TOUR_HIGHLIGHT = "companion-tour-target";
const TOUR_PULSE = "companion-pulse";
/** Daily Quest panel: "Keep Myo Energized" (also matched by heading text below). */
const ENERGY_SECTION_ID = "sec-quests";

type TourStep = {
  /** Section element that is scrolled to and receives the glowing ring. */
  id: string;
  kicker: string;
  title: string;
  body: string;
};

type TourCopy = {
  label: string;
  title: string;
  body: string;
};

/** Curated narration for the console sections the Space Bear knows by heart. */
const TOUR_COPY: Record<string, TourCopy> = {
  "sec-hero": {
    label: "FLIGHT DECK",
    title: "Mission Control & model status",
    body: "Welcome aboard. This is your live flight deck: astronaut vitals, upload-derived readiness and the four health domains on one console. I'll walk you through the flight sequence.",
  },
  "sec-upload": {
    label: "TELEMETRY UPLINK",
    title: "Upload orbital telemetry",
    body: "Drop a mission CSV or JSON here. All four domain models score the same file, then cross-system strain rules decide whether the emergency triage protocol must open. The sample anomaly dataset is a fast demo.",
  },
  "sec-domains": {
    label: "HEALTH DOMAINS",
    title: "Scan the four health domains",
    body: "Radiation, musculoskeletal, vestibular and cardiovascular panels update from the latest analysis. Watch the risk bars, sparklines and notes for strain building across systems.",
  },
  "sec-vitals": {
    label: "LIVE VITALS",
    title: "Crew vitals at a glance",
    body: "Heart rate, oxygen saturation, temperature and blood pressure sit in the vitals bay. Use them as a quick sanity check against the domain-model risk scores.",
  },
  "sec-quests": {
    label: "KEEP MYO ENERGIZED",
    title: "Keep Myo energized",
    body: "Daily Quests keep the companion — and the crew routine — in shape. Complete today's blocks to raise energy and build a streak. Tap me any time and I'll bring you back here.",
  },
  "sec-coverage": {
    label: "DATA COVERAGE",
    title: "Dataset coverage",
    body: "Each bar counts the datasets loaded for a health domain. A thin or empty bar means the models have less evidence to work with.",
  },
  "sec-overview": {
    label: "OVERVIEW",
    title: "Mission overview",
    body: "A roll-up of all four domains: loaded datasets, latest predictions and the current readiness call in one sweep.",
  },
  "sec-profiles": {
    label: "CREW PROFILES",
    title: "Crew profile records",
    body: "Subject details, available datasets, health-domain summaries and analysis history for the selected astronaut.",
  },
  "sec-datasets": {
    label: "DATASETS",
    title: "Dataset library",
    body: "Browse the study catalogue, variables, sample previews and source citations behind every model input.",
  },
  "sec-analysis": {
    label: "ANALYSIS",
    title: "Run the analysis pipeline",
    body: "Upload telemetry, pick a dataset and follow the four-model pipeline from preprocessing through cross-system strain detection.",
  },
  "sec-radiation": {
    label: "RADIATION",
    title: "Radiation exposure domain",
    body: "Dose accumulation, shielding context and radiation risk trends. Watch for elevated exposure combined with other domain strain.",
  },
  "sec-musculoskeletal": {
    label: "MUSCULOSKELETAL",
    title: "Musculoskeletal domain",
    body: "Strength, bone density and load-bearing signals. Falling performance here often pairs with cardiovascular deconditioning.",
  },
  "sec-vestibular": {
    label: "VESTIBULAR",
    title: "Vestibular domain",
    body: "Balance, gaze stability and sensorimotor scores. These track the crew's adaptation to microgravity.",
  },
  "sec-cardiovascular": {
    label: "CARDIOVASCULAR",
    title: "Cardiovascular domain",
    body: "Heart-rate response, blood pressure and aerobic capacity. Combine with vitals for the full circulatory picture.",
  },
  "sec-intelligence": {
    label: "INTELLIGENCE",
    title: "Cross-domain intelligence",
    body: "Integrated analysis compares all four domains, highlights missing information, model uncertainty and follow-up suggestions.",
  },
  "sec-reports": {
    label: "TRIAGE & REPORTS",
    title: "Triage, then file the report",
    body: "Critical uploads surface the rescue protocol. When the dust settles, generate a mission report here, review the findings and share them with the crew.",
  },
  "sec-settings": {
    label: "SETTINGS",
    title: "Console settings",
    body: "Review datasets, model endpoints, version history and audit activity. That completes the full pre-flight walkthrough.",
  },
};

const FALLBACK_IDS = ["sec-hero", "sec-upload", "sec-domains", "sec-vitals", "sec-quests"];
const FALLBACK_STEPS: TourStep[] = FALLBACK_IDS.map((id, index) => ({
  id,
  kicker: `${String(index + 1).padStart(2, "0")} · ${TOUR_COPY[id].label}`,
  title: TOUR_COPY[id].title,
  body: TOUR_COPY[id].body,
}));

/**
 * Walk every section currently mounted in the console, in document order.
 * New/role-specific sections are picked up automatically, so the tour always
 * covers the whole site instead of a stale hard-coded list.
 */
function discoverTourSteps(): TourStep[] {
  if (typeof document === "undefined") return FALLBACK_STEPS;

  const seen = new Set<string>();
  const steps: TourStep[] = [];

  document.querySelectorAll<HTMLElement>("main [id^='sec-']").forEach((el) => {
    const id = el.id;
    if (id === "sec-top" || seen.has(id) || el.getClientRects().length === 0) return;
    seen.add(id);

    const copy = TOUR_COPY[id];
    const label = id.replace(/^sec-/, "").replace(/-/g, " ");
    const heading = el.querySelector("h1, h2, h3")?.textContent?.trim();

    steps.push({
      id,
      kicker: `${String(steps.length + 1).padStart(2, "0")} · ${
        copy?.label ?? label.toUpperCase()
      }`,
      title: copy?.title ?? heading ?? label,
      body:
        copy?.body ??
        `Part of your mission console. Scroll through ${label} to review the latest data before moving on.`,
    });
  });

  return steps.length ? steps : FALLBACK_STEPS;
}

/** Locate the "Keep Myo Energized" panel by ID, then by its heading text. */
function findEnergySection(): HTMLElement | null {
  const byId = document.getElementById(ENERGY_SECTION_ID);
  if (byId) return byId;

  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("main h1, main h2, main h3"),
  ).find((el) => /keep\s+myo\s+energi[sz]ed/i.test(el.textContent ?? ""));

  return heading?.closest<HTMLElement>("section") ?? heading?.parentElement ?? null;
}

/** Mascot energy follows today's workout completion: none, some, or all. */
type EnergyLevel = "low" | "partial" | "full";

type QuestInfo = {
  kicker: string;
  title: string;
  body: string;
  done: number;
  total: number;
  /** XP-weighted energy percentage, matching the "Keep Myo Energized" panel. */
  energy: number;
  level: EnergyLevel;
};

const TOTAL_XP = DAILY_QUESTS.reduce((sum, q) => sum + q.xp, 0);

/** Build the mascot state from the daily quest state shared by DailyQuests. */
function readQuestInfo(): QuestInfo {
  const total = DAILY_QUESTS.length;
  const valid = new Set(DAILY_QUESTS.map((q) => q.id));

  let stored: { date?: string; done?: string[] } | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(DAILY_QUESTS_KEY) || "null");
  } catch {
    stored = null;
  }

  const doneIds =
    stored && stored.date === dayKey() && Array.isArray(stored.done)
      ? stored.done.filter((id) => valid.has(id))
      : [];

  const done = doneIds.length;
  const xp = DAILY_QUESTS.filter((q) => doneIds.includes(q.id)).reduce((n, q) => n + q.xp, 0);
  const energy = TOTAL_XP ? Math.round((xp / TOTAL_XP) * 100) : 0;
  const next = DAILY_QUESTS.find((q) => !doneIds.includes(q.id));

  if (done === 0) {
    return {
      kicker: `DAILY QUEST · 0/${total}`,
      title: "Myo is low on energy...",
      body: next
        ? `Click me to complete today's ${next.title.toLowerCase()} workout and wake Myo up.`
        : "Click me to open today's workout routine and wake Myo up.",
      done,
      total,
      energy,
      level: "low",
    };
  }

  if (done >= total) {
    return {
      kicker: "DAILY QUEST · COMPLETE",
      title: "Myo is 100% energized and mission-ready!",
      body: "Every daily workout is logged. Sweep the health domains while I recharge for tomorrow.",
      done: total,
      total,
      energy: 100,
      level: "full",
    };
  }

  return {
    kicker: `DAILY QUEST · ${done}/${total}`,
    title: `Nice! ${done}/${total} workouts done—keep going to fully energize Myo!`,
    body: next ? `Next up: ${next.title} · ${next.detail}.` : "Keep going to fully energize Myo!",
    done,
    total,
    energy,
    level: "partial",
  };
}

function clearTourHighlight() {
  document
    .querySelectorAll(`.${TOUR_HIGHLIGHT}`)
    .forEach((el) => el.classList.remove(TOUR_HIGHLIGHT));
}

export default function CompanionMascot({ suppressed = false }: { suppressed?: boolean }) {
  const { notify, anomalyOpen, reportRequest } = useApp();
  const [quest, setQuest] = useState<QuestInfo>(readQuestInfo);
  const [completed, setCompleted] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>(FALLBACK_STEPS);
  const [step, setStep] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const pulseTimer = useRef<number | null>(null);

  /* First visit: discover every section on the page, then reveal the flight guide. */
  useEffect(() => {
    setSteps(discoverTourSteps());

    let stored = false;
    try {
      stored = localStorage.getItem(TOUR_KEY) === "true";
    } catch {
      stored = false;
    }
    setCompleted(stored);
    if (stored) return;

    const timer = window.setTimeout(() => {
      setCollapsed(false);
      setStep(0);
      setTourActive(true);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, []);

  /* Keep the mascot's energy state in sync with the quest panel and other tabs. */
  useEffect(() => {
    const sync = () => setQuest(readQuestInfo());
    sync();
    window.addEventListener(DAILY_QUESTS_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(DAILY_QUESTS_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  /* Scroll to the active tour step and ring the matching section. */
  useEffect(() => {
    if (!tourActive) return;
    const current = steps[step];
    if (!current) return;

    clearTourHighlight();
    const target = document.getElementById(current.id);
    target?.classList.add(TOUR_HIGHLIGHT);

    const timer = window.setTimeout(() => {
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 90);

    return () => {
      window.clearTimeout(timer);
      target?.classList.remove(TOUR_HIGHLIGHT);
    };
  }, [tourActive, step, steps]);

  /* Clean up transient DOM highlights if the companion unmounts. */
  useEffect(
    () => () => {
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
      clearTourHighlight();
      document.querySelectorAll(`.${TOUR_PULSE}`).forEach((el) => el.classList.remove(TOUR_PULSE));
    },
    [],
  );

  const pulseAndScroll = useCallback((el: HTMLElement) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove(TOUR_PULSE);
    // Restart the pulse when the same section is clicked twice.
    void el.offsetWidth;
    el.classList.add(TOUR_PULSE);

    if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => {
      el.classList.remove(TOUR_PULSE);
      pulseTimer.current = null;
    }, 2400);
  }, []);

  /* Post-tour mascot click: jump straight to the "Keep Myo Energized" panel. */
  const jumpToEnergy = useCallback(() => {
    const el = findEnergySection();
    if (el) pulseAndScroll(el);
  }, [pulseAndScroll]);

  const finishTour = useCallback(
    (reason: "skip" | "done") => {
      try {
        localStorage.setItem(TOUR_KEY, "true");
      } catch {
        /* Storage can be unavailable in private browsing; the tour still closes. */
      }
      clearTourHighlight();
      setCompleted(true);
      setTourActive(false);
      setStep(0);
      notify(
        reason === "done"
          ? "Tour complete · Daily Quest mode online"
          : "Tour skipped · Daily Quest mode online",
      );
      // A completed tour ends by handing the astronaut to the daily quest panel.
      if (reason === "done") window.setTimeout(jumpToEnergy, 420);
    },
    [jumpToEnergy, notify],
  );

  const startTour = useCallback(() => {
    setSteps(discoverTourSteps());
    setCollapsed(false);
    setStep(0);
    setTourActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (step >= steps.length - 1) finishTour("done");
    else setStep((n) => n + 1);
  }, [step, steps.length, finishTour]);

  const current = steps[step] ?? steps[0] ?? FALLBACK_STEPS[0];
  const lastStep = step >= steps.length - 1;
  const progress = quest.energy;

  // Keep the companion clear of the flight-surgeon drawer and modal dialogs.
  if (suppressed || anomalyOpen || reportRequest) return null;

  const energized = quest.level === "full";
  const energySummary =
    quest.level === "full"
      ? "Myo is fully energized"
      : quest.level === "partial"
        ? `Myo is charging: ${quest.done} of ${quest.total} workouts done`
        : "Myo is low on energy: no workouts completed";

  return (
    <div className="no-print pointer-events-none fixed bottom-0 right-6 z-50">
      <div className="relative flex items-end">
        {/* Speech bubble sits above and slightly left of the helmet; tail points down-right at the bear. */}
        {tourActive ? (
          <div
            aria-live="polite"
            className="companion-bubble-in pointer-events-auto absolute bottom-[10.5rem] right-6 w-[calc(100vw-5rem)] max-w-[336px] rounded-[14px] border border-[#FFCC00]/40 bg-[#0E0E10]/95 p-4 text-left backdrop-blur-xl sm:bottom-[11.5rem]"
            style={{
              boxShadow:
                "0 24px 70px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,204,0,0.06), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <BubbleTail />
            <div className="fs-scroll max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#FFCC00]">
                  MYO · {current.kicker}
                </span>
                <span className="font-mono shrink-0 rounded-[2px] border border-white/[0.12] px-2 py-0.5 text-[9px] tabular-nums text-[#D6D6D9]">
                  {step + 1}/{steps.length}
                </span>
              </div>

              <h3 className="font-bold-sans mt-2 text-[19px] leading-[1.1] tracking-[-0.02em] text-[#FFFFFF]">
                {current.title}
              </h3>
              <p className="mt-2 text-[12.5px] leading-[1.55] text-[#C9C9CE]">{current.body}</p>

              <div className="mt-3 flex gap-1" aria-hidden>
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className="h-[3px] flex-1 rounded-full transition-colors duration-300"
                    style={{ background: i <= step ? "#FFCC00" : "rgba(255,255,255,0.12)" }}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
                <button
                  type="button"
                  onClick={() => finishTour("skip")}
                  className="font-mono rounded-[2px] px-1.5 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[#8E8E93] transition hover:text-[#FFFFFF]"
                >
                  Skip Tour
                </button>
                <div className="flex items-center gap-1.5">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep((n) => Math.max(0, n - 1))}
                      className="font-mono inline-flex items-center gap-1 rounded-[2px] border border-white/[0.12] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#D6D6D9] transition hover:border-[#FFCC00]/50 hover:text-[#FFFFFF]"
                    >
                      <ArrowIcon direction="left" />
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={nextStep}
                    className="font-mono inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] transition hover:brightness-110"
                    style={{ background: "#FFCC00", color: "#0B0B0C" }}
                  >
                    {lastStep ? "Finish" : "Next"}
                    {!lastStep && <ArrowIcon />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : !collapsed ? (
          <div
            aria-live="polite"
            title="Jump to Keep Myo Energized"
            onClick={jumpToEnergy}
            className={`companion-bubble-in pointer-events-auto absolute bottom-[10.5rem] right-6 w-[calc(100vw-5rem)] max-w-[336px] cursor-pointer rounded-[14px] border bg-[#0E0E10]/95 p-4 text-left backdrop-blur-xl transition sm:bottom-[11.5rem] ${
              energized
                ? "border-[#FFCC00]/60"
                : quest.level === "partial"
                  ? "border-[#FFCC00]/40"
                  : "border-[#FFCC00]/25 hover:border-[#FFCC00]/45"
            }`}
            style={{
              boxShadow: energized
                ? "0 24px 70px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,204,0,0.24), 0 0 44px rgba(255,204,0,0.16), inset 0 1px 0 rgba(255,255,255,0.05)"
                : "0 24px 70px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,204,0,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <BubbleTail />
            <div className="fs-scroll max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#FFCC00]">
                  MYO · {quest.kicker}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setCollapsed(true);
                  }}
                  aria-label="Minimize companion message"
                  title="Minimize message"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-[2px] border border-white/[0.1] text-[#8E8E93] transition hover:border-[#FFCC00]/50 hover:text-[#FFFFFF]"
                >
                  <MinimizeIcon />
                </button>
              </div>

              <h3 className="font-bold-sans mt-2 text-[18px] leading-[1.1] tracking-[-0.02em] text-[#FFFFFF]">
                {quest.title}
              </h3>
              <p className="mt-2 text-[12.5px] leading-[1.55] text-[#C9C9CE]">{quest.body}</p>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.09]">
                  <div
                    className="h-full rounded-full bg-[#FFCC00] transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] tabular-nums text-[#6E6E73]">
                  {quest.done}/{quest.total} · {quest.energy}%
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#6E6E73]">
                  {energized
                    ? "Mission logged"
                    : quest.level === "partial"
                      ? "Charging up"
                      : "Low energy · tap to train"}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    jumpToEnergy();
                  }}
                  className="font-mono inline-flex items-center gap-1.5 rounded-[2px] text-[9px] font-bold uppercase tracking-[0.1em] text-[#FFCC00] transition hover:brightness-110"
                >
                  Keep Myo Energized <ArrowIcon />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-auto mb-7 mr-1 flex flex-col items-center gap-1.5">
          {!tourActive && collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Show companion message"
              title="Show Daily Quest"
              className="relative grid h-8 w-8 place-items-center rounded-full border border-[#FFCC00]/40 bg-[#0B0B0C]/90 text-[#FFCC00] backdrop-blur-md transition hover:border-[#FFCC00] hover:bg-[#FFCC00]/10"
            >
              <BubbleIcon />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#FFCC00]" />
            </button>
          )}
          {!tourActive && completed && (
            <button
              type="button"
              onClick={startTour}
              aria-label="Replay guided tour"
              title="Replay Tour"
              className="font-mono grid h-8 w-8 place-items-center rounded-full border border-white/[0.14] bg-[#0B0B0C]/90 text-[13px] font-bold text-[#D6D6D9] backdrop-blur-md transition hover:border-[#FFCC00]/60 hover:text-[#FFCC00]"
            >
              ↻
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!tourActive) jumpToEnergy();
          }}
          aria-label={
            tourActive
              ? "MYO Space Bear guided tour in progress"
              : `${energySummary}. Open Keep Myo Energized.`
          }
          title={
            tourActive
              ? "MYO · guided tour"
              : `MYO · ${quest.energy}% energy · Jump to Keep Myo Energized`
          }
          className="group pointer-events-auto relative block h-[178px] w-[128px] select-none rounded-2xl focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FFCC00]/70 sm:h-[196px] sm:w-[140px]"
        >
          <span
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-[16%] h-24 w-24 -translate-x-1/2 rounded-full bg-[#FFCC00]/10 blur-2xl transition duration-500 group-focus-visible:opacity-100 ${
              energized ? "opacity-100" : quest.level === "partial" ? "opacity-60" : "opacity-0"
            }`}
          />
          <SpaceBearSvg level={quest.level} />
        </button>
      </div>
    </div>
  );
}

function BubbleTail() {
  return (
    <span
      aria-hidden
      className="absolute -bottom-[7px] right-16 h-3 w-3 rotate-[35deg] rounded-[2px] border-b border-r border-[#FFCC00]/40 bg-[#0E0E10]"
    />
  );
}

/** High-detail 2.5D Space Bear Astronaut matching the interactive Myo3D mascot. */
function SpaceBearSvg({ level }: { level: EnergyLevel }) {
  const awake = level !== "low";
  const energized = level === "full";

  return (
    <svg
      viewBox="0 0 200 288"
      className={`space-bear-svg relative z-10 h-full w-full ${awake ? "is-awake" : "is-sleepy"} ${
        energized ? "is-energized" : ""
      }`}
      aria-hidden
    >
      <defs>
        <linearGradient id="sb-fur" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#D8A16F" />
          <stop offset="42%" stopColor="#B67C4F" />
          <stop offset="100%" stopColor="#7E4B2C" />
        </linearGradient>
        <linearGradient id="sb-muzzle" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FBE3C6" />
          <stop offset="70%" stopColor="#E7C09B" />
          <stop offset="100%" stopColor="#C99B74" />
        </linearGradient>
        <linearGradient id="sb-suit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="48%" stopColor="#EEF3F8" />
          <stop offset="100%" stopColor="#BCC7D4" />
        </linearGradient>
        <linearGradient id="sb-suit-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E9EFF5" />
          <stop offset="100%" stopColor="#A6B2C0" />
        </linearGradient>
        <linearGradient id="sb-silver" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FBFDFF" />
          <stop offset="46%" stopColor="#DCE3EA" />
          <stop offset="100%" stopColor="#A1ADBB" />
        </linearGradient>
        <linearGradient id="sb-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFEEA8" />
          <stop offset="42%" stopColor="#FFCC00" />
          <stop offset="100%" stopColor="#A87900" />
        </linearGradient>
        <linearGradient id="sb-tablet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE873" />
          <stop offset="55%" stopColor="#FFD22E" />
          <stop offset="100%" stopColor="#E8A800" />
        </linearGradient>
        <radialGradient id="sb-glass" cx="38%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
          <stop offset="45%" stopColor="#DFF4FF" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#9ED4FF" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id="sb-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.55" />
          <stop offset="65%" stopColor="#000000" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFCC00" stopOpacity="0.3" />
          <stop offset="58%" stopColor="#FFCC00" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#FFCC00" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Fully energized: a warm mission-ready aura pulses behind the bear. */}
      {energized && <circle className="sb-aura" cx="100" cy="118" r="94" fill="url(#sb-aura)" />}

      {/* Ground shadow keeps the bear planted on the viewport edge. */}
      <ellipse
        className="space-bear-shadow"
        cx="100"
        cy="282"
        rx="62"
        ry="7"
        fill="url(#sb-shadow)"
      />

      <g className="space-bear-bob">
        {/* Life-support pack behind the suit */}
        <rect
          x="49"
          y="171"
          width="102"
          height="74"
          rx="30"
          fill="url(#sb-suit-shade)"
          stroke="#93A0AF"
          strokeWidth="1.2"
        />
        <rect
          x="40"
          y="181"
          width="16"
          height="48"
          rx="8"
          fill="url(#sb-silver)"
          stroke="#7F8B9A"
          strokeWidth="1"
        />
        <rect
          x="144"
          y="181"
          width="16"
          height="48"
          rx="8"
          fill="url(#sb-silver)"
          stroke="#7F8B9A"
          strokeWidth="1"
        />
        <rect x="43" y="176" width="10" height="8" rx="3" fill="#8E9AA9" />
        <rect x="147" y="176" width="10" height="8" rx="3" fill="#8E9AA9" />

        {/* Legs and magnetic boots */}
        <g>
          <path
            d="M74 207h20v39c0 8-4 13-10 13s-10-5-10-13z"
            fill="url(#sb-suit)"
            stroke="#AAB6C4"
            strokeWidth="1.2"
          />
          <rect
            x="61"
            y="247"
            width="36"
            height="37"
            rx="13"
            fill="url(#sb-silver)"
            stroke="#8793A2"
            strokeWidth="1.2"
          />
          <rect x="63" y="275" width="32" height="8" rx="4" fill="#697585" />
          <path
            d="M68 255h20"
            stroke="#FFFFFF"
            strokeOpacity="0.6"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
        <g>
          <path
            d="M106 207h20v39c0 8-4 13-10 13s-10-5-10-13z"
            fill="url(#sb-suit)"
            stroke="#AAB6C4"
            strokeWidth="1.2"
          />
          <rect
            x="103"
            y="247"
            width="36"
            height="37"
            rx="13"
            fill="url(#sb-silver)"
            stroke="#8793A2"
            strokeWidth="1.2"
          />
          <rect x="105" y="275" width="32" height="8" rx="4" fill="#697585" />
          <path
            d="M110 255h20"
            stroke="#FFFFFF"
            strokeOpacity="0.6"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>

        {/* Torso */}
        <path
          d="M64 158c-9 10-12 28-8 48l4 18c18 8 62 8 80 0l4-18c4-20 1-38-8-48-20-8-52-8-72 0Z"
          fill="url(#sb-suit)"
          stroke="#AEBAC8"
          strokeWidth="1.3"
        />
        <path
          d="M124 154c11 10 15 29 11 49l-3 17c-6 3-13 5-20 6 8-9 11-27 10-43-1-13-4-22-9-28 4 0 8 0 11-1Z"
          fill="#8E9BAA"
          fillOpacity="0.12"
        />
        <path d="M100 153v72" stroke="#C9D3DF" strokeWidth="1" />
        <path
          d="M76 161c-4 23-6 44-3 64M124 161c4 23 6 44 3 64"
          stroke="#D5DDE6"
          strokeWidth="1"
          fill="none"
        />

        {/* Chest badge, patch and status module */}
        <circle cx="79" cy="180" r="11" fill="url(#sb-gold)" stroke="#967000" strokeWidth="1" />
        <circle
          cx="79"
          cy="180"
          r="7.2"
          fill="none"
          stroke="#7C5A00"
          strokeOpacity="0.65"
          strokeWidth="0.9"
        />
        <path
          d="m79 174.4 1.7 4.1 4.4.4-3.3 2.9 1 4.3-3.8-2.2-3.8 2.2 1-4.3-3.3-2.9 4.4-.4Z"
          fill="#7C5A00"
          fillOpacity="0.8"
        />
        <rect
          x="103"
          y="172.5"
          width="26"
          height="10"
          rx="2"
          fill="#DCE4ED"
          stroke="#A4B0BF"
          strokeWidth="0.9"
        />
        <text
          x="116"
          y="180"
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="6.4"
          fontWeight="700"
          letterSpacing="0.4"
          fill="#34404F"
        >
          MYO
        </text>
        <rect
          x="91"
          y="193"
          width="18"
          height="8"
          rx="2"
          fill="#2A3340"
          stroke="#A4B0BF"
          strokeWidth="0.8"
        />
        <circle cx="95" cy="197" r="1.4" fill="#35D6C0" />
        <rect x="99" y="196.2" width="4.5" height="1.6" rx="0.8" fill="#FFCC00" />
        <rect x="104.5" y="196.2" width="2.2" height="1.6" rx="0.8" fill="#9B8CFF" />

        {/* Utility belt */}
        <rect x="58" y="212" width="84" height="12" rx="6" fill="#707D8D" />
        <rect
          x="90"
          y="209.5"
          width="20"
          height="17"
          rx="4"
          fill="url(#sb-gold)"
          stroke="#8C6800"
          strokeWidth="1"
        />
        <rect x="95" y="214" width="10" height="8" rx="1.5" fill="#6B5000" fillOpacity="0.65" />

        {/* Shoulder pads */}
        <ellipse
          cx="66"
          cy="163"
          rx="15"
          ry="12"
          fill="url(#sb-silver)"
          stroke="#8C98A7"
          strokeWidth="1"
          transform="rotate(-18 66 163)"
        />
        <ellipse
          cx="134"
          cy="163"
          rx="15"
          ry="12"
          fill="url(#sb-silver)"
          stroke="#8C98A7"
          strokeWidth="1"
          transform="rotate(18 134 163)"
        />

        {/* Right arm (viewer left) hanging at ease */}
        <path
          d="M66 168c-7 13-11 28-13 39"
          fill="none"
          stroke="#A5B1BF"
          strokeWidth="19"
          strokeLinecap="round"
        />
        <path
          d="M66 168c-7 13-11 28-13 39"
          fill="none"
          stroke="#F2F6FA"
          strokeWidth="15.5"
          strokeLinecap="round"
        />
        <ellipse cx="53" cy="205" rx="9.5" ry="5" fill="#B9C4D0" transform="rotate(12 53 205)" />
        <circle cx="51.5" cy="214" r="9.5" fill="url(#sb-silver)" stroke="#8B97A6" />
        <path
          d="M45 214q6.5 4.2 13 0"
          fill="none"
          stroke="#7F8B9A"
          strokeWidth="1.1"
          strokeLinecap="round"
        />

        {/* Left arm (viewer right) bent around the yellow tablet */}
        <path
          d="M134 168c9 11 15 24 14 34"
          fill="none"
          stroke="#A5B1BF"
          strokeWidth="19"
          strokeLinecap="round"
        />
        <path
          d="M134 168c9 11 15 24 14 34"
          fill="none"
          stroke="#F2F6FA"
          strokeWidth="15.5"
          strokeLinecap="round"
        />

        {/* Yellow clipboard / tablet */}
        <g transform="rotate(-9 146 214)">
          <rect
            x="124"
            y="194"
            width="42"
            height="58"
            rx="6"
            fill="#C79600"
            stroke="#7A5A00"
            strokeWidth="1.4"
          />
          <rect
            x="127.5"
            y="198"
            width="35"
            height="50"
            rx="4"
            fill="url(#sb-tablet)"
            stroke="#9C7400"
            strokeWidth="1"
          />
          <rect x="137" y="190" width="16" height="8" rx="4" fill="#6F5200" />
          <path
            d="M134 208h22M134 216h18M134 224h21M134 232h14"
            stroke="#8A6500"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="m131.5 205.5 2 2 3.5-4M131.5 213.5l2 2 3.5-4"
            fill="none"
            stroke="#365324"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <ellipse cx="148" cy="201" rx="9" ry="5" fill="#B9C4D0" transform="rotate(-18 148 201)" />
        <circle cx="147" cy="211" r="9.5" fill="url(#sb-silver)" stroke="#8B97A6" />
        <path
          d="M140 209q6-4 12 0"
          fill="none"
          stroke="#7F8B9A"
          strokeWidth="1.1"
          strokeLinecap="round"
        />

        {/* Bear head */}
        <g className="space-bear-head">
          <circle cx="64" cy="62" r="18" fill="url(#sb-fur)" stroke="#6F4529" strokeWidth="1.2" />
          <circle cx="64" cy="63" r="9.5" fill="#C9806E" fillOpacity="0.88" />
          <path
            d="M56 58q8-5 16 0"
            fill="none"
            stroke="#F3C4AA"
            strokeOpacity="0.4"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="136" cy="62" r="18" fill="url(#sb-fur)" stroke="#6F4529" strokeWidth="1.2" />
          <circle cx="136" cy="63" r="9.5" fill="#C9806E" fillOpacity="0.88" />
          <path
            d="M128 58q8-5 16 0"
            fill="none"
            stroke="#F3C4AA"
            strokeOpacity="0.4"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          <ellipse cx="100" cy="98" rx="45" ry="42" fill="url(#sb-fur)" />
          <path
            d="M63 111c8 19 22 27 37 27s29-8 37-27c-4 22-18 31-37 31s-33-9-37-31Z"
            fill="#5C361F"
            fillOpacity="0.14"
          />
          <path
            d="M72 64c5-8 13-13 22-14"
            fill="none"
            stroke="#F0BB91"
            strokeOpacity="0.35"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Muzzle, nose, sleepy smile and tiny fangs */}
          <ellipse
            cx="100"
            cy="116"
            rx="24"
            ry="17"
            fill="url(#sb-muzzle)"
            stroke="#C79B72"
            strokeWidth="1"
          />
          <ellipse cx="100" cy="108.5" rx="5.6" ry="4.6" fill="#3A2418" />
          <ellipse cx="98" cy="106.7" rx="1.6" ry="1" fill="#FFFFFF" fillOpacity="0.55" />
          <path
            d="M94 117q6 6 12 0"
            fill="none"
            stroke="#4A2D1A"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M94 120.5h3.2l-1.6 5Z" fill="#FFFFFF" />
          <path d="M102.8 120.5h3.2L104.4 125.5Z" fill="#FFFFFF" />
          <ellipse cx="69" cy="113" rx="9.5" ry="6" fill="#EE8B86" fillOpacity="0.55" />
          <ellipse cx="131" cy="113" rx="9.5" ry="6" fill="#EE8B86" fillOpacity="0.55" />

          {/* Eyes: driven by today's workout energy, not pointer hover. */}
          <g
            className="sb-awake-eyes"
            style={{ opacity: awake ? 1 : 0, transition: "opacity 220ms ease" }}
          >
            <ellipse
              cx="82"
              cy="95"
              rx={energized ? 8.4 : 7.5}
              ry={energized ? 9.4 : 8.5}
              fill="#2B1B12"
            />
            <ellipse
              cx="118"
              cy="95"
              rx={energized ? 8.4 : 7.5}
              ry={energized ? 9.4 : 8.5}
              fill="#2B1B12"
            />
            <circle cx="84.5" cy="92" r={energized ? 3 : 2.4} fill="#FFFFFF" />
            <circle cx="120.5" cy="92" r={energized ? 3 : 2.4} fill="#FFFFFF" />
            <circle cx="79.5" cy="98.5" r="1.1" fill="#FFFFFF" fillOpacity="0.7" />
            <circle cx="115.5" cy="98.5" r="1.1" fill="#FFFFFF" fillOpacity="0.7" />
            <path
              d="M74 84q8-4 16 0M110 84q8-4 16 0"
              fill="none"
              stroke="#6A4227"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            {energized && (
              <g className="sb-energy-sparkle" fill="#FFF3B0">
                <path d="m70 88 1.1 2.9 2.9 1.1-2.9 1.1L70 96l-1.1-2.9-2.9-1.1 2.9-1.1Z" />
                <path d="m130 88 1.1 2.9 2.9 1.1-2.9 1.1L130 96l-1.1-2.9-2.9-1.1 2.9-1.1Z" />
              </g>
            )}
          </g>
          <g
            className="sb-sleepy-eyes"
            style={{ opacity: awake ? 0 : 1, transition: "opacity 220ms ease" }}
          >
            <ellipse cx="82" cy="97" rx="7" ry="4.2" fill="#2B1B12" />
            <ellipse cx="118" cy="97" rx="7" ry="4.2" fill="#2B1B12" />
            <path
              d="M73 96q9-5.5 18 0M109 96q9-5.5 18 0"
              fill="none"
              stroke="#4B2E1C"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M74 101q8 3 16 0M110 101q8 3 16 0"
              fill="none"
              stroke="#6A4227"
              strokeOpacity="0.55"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle cx="84" cy="97.5" r="1" fill="#FFFFFF" fillOpacity="0.55" />
            <circle cx="120" cy="97.5" r="1" fill="#FFFFFF" fillOpacity="0.55" />
          </g>
        </g>

        {/* Clear glass dome helmet */}
        <circle
          cx="100"
          cy="95"
          r="66"
          fill="url(#sb-glass)"
          stroke="#DFF2FF"
          strokeOpacity="0.75"
          strokeWidth="2"
        />
        <circle
          cx="100"
          cy="95"
          r="62"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.13"
          strokeWidth="1"
        />
        <path
          d="M53 63C62 46 78 36 95 34"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.75"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <ellipse
          cx="124"
          cy="51"
          rx="13"
          ry="4.6"
          fill="#FFFFFF"
          fillOpacity="0.22"
          transform="rotate(39 124 51)"
        />
        <path
          d="M159 108c-4 23-21 40-42 46"
          fill="none"
          stroke="#BFE9FF"
          strokeOpacity="0.26"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Neck seal */}
        <ellipse
          cx="100"
          cy="158"
          rx="42"
          ry="14"
          fill="url(#sb-silver)"
          stroke="#8592A2"
          strokeWidth="1.3"
        />
        <ellipse cx="100" cy="155" rx="34" ry="9" fill="#5E6B7C" />
        <path
          d="M61 157q39 12 78 0"
          fill="none"
          stroke="#FFCC00"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Side ear-caps / comms pods */}
        <rect
          x="21"
          y="80"
          width="19"
          height="42"
          rx="9.5"
          fill="url(#sb-silver)"
          stroke="#8592A2"
          strokeWidth="1.3"
        />
        <rect x="25" y="86" width="11" height="7" rx="3.5" fill="url(#sb-gold)" />
        <circle cx="30.5" cy="107" r="4.8" fill="#2C8C9C" stroke="#EFFFFF" strokeWidth="1" />
        <rect
          x="38"
          y="94"
          width="8"
          height="14"
          rx="3"
          fill="#B7C2CF"
          stroke="#8592A2"
          strokeWidth="1"
        />
        <rect
          x="160"
          y="80"
          width="19"
          height="42"
          rx="9.5"
          fill="url(#sb-silver)"
          stroke="#8592A2"
          strokeWidth="1.3"
        />
        <rect x="164" y="86" width="11" height="7" rx="3.5" fill="url(#sb-gold)" />
        <circle cx="169.5" cy="107" r="4.8" fill="#2C8C9C" stroke="#EFFFFF" strokeWidth="1" />
        <rect
          x="154"
          y="94"
          width="8"
          height="14"
          rx="3"
          fill="#B7C2CF"
          stroke="#8592A2"
          strokeWidth="1"
        />

        {/* Sleepy only: floating Zzz particles while today's workouts are missing. */}
        {level === "low" && (
          <g className="space-bear-zzz">
            <g className="sb-zzz">
              <text
                x="38"
                y="68"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="16"
                fontWeight="700"
                fill="#FFE08A"
                fillOpacity="0.85"
              >
                z
              </text>
            </g>
            <g className="sb-zzz sb-zzz-2">
              <text
                x="49"
                y="52"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="20"
                fontWeight="700"
                fill="#FFCC00"
                fillOpacity="0.9"
              >
                Z
              </text>
            </g>
            <g className="sb-zzz sb-zzz-3">
              <text
                x="64"
                y="35"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="24"
                fontWeight="700"
                fill="#FFF1B8"
                fillOpacity="0.95"
              >
                Z
              </text>
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}

function ArrowIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={direction === "left" ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function BubbleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.6A8 8 0 1 1 21 12Z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </svg>
  );
}
