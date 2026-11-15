import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { DAILY_QUESTS, DAILY_QUESTS_EVENT, DAILY_QUESTS_KEY, dayKey } from "./DailyQuests";

const TOUR_KEY = "myoshield_tour_completed";
const TOUR_HIGHLIGHT = "companion-tour-target";
const TOUR_PULSE = "companion-pulse";

type TourStep = {
  /** Element to bring into view. */
  section: string;
  /** Element that receives the glowing ring. */
  highlight: string;
  kicker: string;
  title: string;
  body: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    section: "sec-hero",
    highlight: "sec-hero",
    kicker: "01 · FLIGHT DECK",
    title: "Mission Control & model status",
    body: "Welcome aboard. This is your live flight deck: astronaut vitals, upload-derived readiness and the four health domains on one console. I'll walk you through the flight sequence.",
  },
  {
    section: "sec-upload",
    highlight: "sec-upload",
    kicker: "02 · TELEMETRY UPLINK",
    title: "Upload orbital telemetry",
    body: "Drop a mission CSV or JSON here. All four domain models score the same file, then cross-system strain rules decide whether the emergency triage protocol must open. The sample anomaly dataset is a fast demo.",
  },
  {
    section: "sec-domains",
    highlight: "sec-domains",
    kicker: "03 · HEALTH DOMAINS",
    title: "Scan the four health domains",
    body: "Radiation, musculoskeletal, vestibular and cardiovascular panels update from the latest analysis. Watch the risk bars, sparklines and notes for strain building across systems.",
  },
  {
    section: "sec-reports",
    highlight: "sec-reports",
    kicker: "04 · TRIAGE & REPORTS",
    title: "Triage, then file the report",
    body: "Critical uploads surface the rescue protocol. When the dust settles, generate a mission report here, review the findings and share them with the crew. That completes pre-flight.",
  },
];

type QuestTarget = { section: string; label: string };

const QUEST_TARGETS: Record<string, QuestTarget> = {
  ared: { section: "sec-musculoskeletal", label: "Musculoskeletal" },
  cardio: { section: "sec-cardiovascular", label: "Cardiovascular" },
  bike: { section: "sec-cardiovascular", label: "Cardiovascular" },
  balance: { section: "sec-vestibular", label: "Vestibular" },
  stretch: { section: "sec-musculoskeletal", label: "Musculoskeletal" },
};

type QuestInfo = {
  kicker: string;
  title: string;
  body: string;
  section: string;
  targetLabel: string;
  done: number | null;
  total: number;
  complete: boolean;
};

/** Build the post-tour mission from the quest state already stored by DailyQuests. */
function readQuestInfo(hasAnalysis: boolean): QuestInfo {
  const total = DAILY_QUESTS.length;

  let stored: { date?: string; done?: string[] } | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(DAILY_QUESTS_KEY) || "null");
  } catch {
    stored = null;
  }

  if (stored && stored.date === dayKey()) {
    const valid = new Set(DAILY_QUESTS.map((q) => q.id));
    const done = Array.isArray(stored.done) ? stored.done.filter((id) => valid.has(id)) : [];
    const next = DAILY_QUESTS.find((q) => !done.includes(q.id));

    if (next) {
      const target = QUEST_TARGETS[next.id] ?? {
        section: "sec-quests",
        label: "Daily Quests",
      };
      return {
        kicker: `DAILY QUEST · ${done.length}/${total}`,
        title: next.title,
        body: `${next.detail}. Tap to jump to the ${target.label} domain.`,
        section: target.section,
        targetLabel: target.label,
        done: done.length,
        total,
        complete: false,
      };
    }

    return {
      kicker: "DAILY QUEST · COMPLETE",
      title: "All quests complete",
      body: "Today's routine is logged. Sweep the health domains for late strain signals while I recharge.",
      section: "sec-domains",
      targetLabel: "Health Domains",
      done: total,
      total,
      complete: true,
    };
  }

  if (hasAnalysis) {
    return {
      kicker: "DAILY QUEST",
      title: "Review health domains",
      body: "Review Radiation & Musculoskeletal health domains before the next status sync.",
      section: "sec-domains",
      targetLabel: "Health Domains",
      done: null,
      total,
      complete: false,
    };
  }

  return {
    kicker: "DAILY QUEST",
    title: "Run 4-model diagnostics",
    body: "Upload orbital telemetry CSV to score all four health domains and surface cross-system strain.",
    section: "sec-upload",
    targetLabel: "Telemetry Uploader",
    done: null,
    total,
    complete: false,
  };
}

function clearTourHighlight() {
  document
    .querySelectorAll(`.${TOUR_HIGHLIGHT}`)
    .forEach((el) => el.classList.remove(TOUR_HIGHLIGHT));
}

export default function CompanionMascot({ suppressed = false }: { suppressed?: boolean }) {
  const { latest, notify, anomalyOpen, reportRequest } = useApp();
  const [quest, setQuest] = useState<QuestInfo>(() => readQuestInfo(!!latest));
  const [completed, setCompleted] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [step, setStep] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const pulseTimer = useRef<number | null>(null);

  /* First visit: reveal the flight guide after the dashboard has settled. */
  useEffect(() => {
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

  /* Keep the Daily Quest bubble in sync with the quest panel and other tabs. */
  useEffect(() => {
    const sync = () => setQuest(readQuestInfo(!!latest));
    sync();
    window.addEventListener(DAILY_QUESTS_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(DAILY_QUESTS_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [latest]);

  /* Scroll to the active tour step and ring the matching section. */
  useEffect(() => {
    if (!tourActive) return;
    const current = TOUR_STEPS[step];
    clearTourHighlight();
    const highlight = document.getElementById(current.highlight);
    highlight?.classList.add(TOUR_HIGHLIGHT);

    const timer = window.setTimeout(() => {
      document
        .getElementById(current.section)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 90);

    return () => {
      window.clearTimeout(timer);
      highlight?.classList.remove(TOUR_HIGHLIGHT);
    };
  }, [tourActive, step]);

  /* Clean up transient DOM highlights if the companion unmounts. */
  useEffect(
    () => () => {
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
      clearTourHighlight();
      document.querySelectorAll(`.${TOUR_PULSE}`).forEach((el) => el.classList.remove(TOUR_PULSE));
    },
    [],
  );

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
    },
    [notify],
  );

  const startTour = useCallback(() => {
    setCollapsed(false);
    setStep(0);
    setTourActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (step >= TOUR_STEPS.length - 1) finishTour("done");
    else setStep((n) => n + 1);
  }, [step, finishTour]);

  const jumpTo = useCallback((section: string) => {
    const el = document.getElementById(section);
    if (!el) return;

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

  const current = TOUR_STEPS[step];
  const lastStep = step === TOUR_STEPS.length - 1;
  const progress = quest.total ? Math.round(((quest.done ?? 0) / quest.total) * 100) : 0;

  // Keep the companion clear of the flight-surgeon drawer and modal dialogs.
  if (suppressed || anomalyOpen || reportRequest) return null;

  return (
    <div className="no-print pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {tourActive ? (
        <div
          aria-live="polite"
          className="companion-bubble-in pointer-events-auto relative w-[calc(100vw-3rem)] max-w-[336px] rounded-[2px] border border-[#FFCC00]/40 bg-[#0E0E10]/95 p-4 text-left backdrop-blur-xl"
          style={{
            boxShadow:
              "0 24px 70px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,204,0,0.06), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <BubbleTail />
          <div className="fs-scroll max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#FFCC00]">
                MYO · {current.kicker}
              </span>
              <span className="font-mono shrink-0 rounded-[2px] border border-white/[0.12] px-2 py-0.5 text-[9px] tabular-nums text-[#D6D6D9]">
                {step + 1}/{TOUR_STEPS.length}
              </span>
            </div>

            <h3 className="font-bold-sans mt-2 text-[19px] leading-[1.1] tracking-[-0.02em] text-[#FFFFFF]">
              {current.title}
            </h3>
            <p className="mt-2 text-[12.5px] leading-[1.55] text-[#C9C9CE]">{current.body}</p>

            <div className="mt-3 flex gap-1" aria-hidden>
              {TOUR_STEPS.map((_, i) => (
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
          title={`Jump to ${quest.targetLabel}`}
          onClick={() => jumpTo(quest.section)}
          className="companion-bubble-in pointer-events-auto relative w-[calc(100vw-3rem)] max-w-[336px] cursor-pointer rounded-[2px] border border-[#FFCC00]/30 bg-[#0E0E10]/95 p-4 text-left backdrop-blur-xl transition hover:border-[#FFCC00]/60"
          style={{
            boxShadow:
              "0 24px 70px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,204,0,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <BubbleTail />
          <div className="fs-scroll max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain">
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

            {quest.done !== null && (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.09]">
                  <div
                    className="h-full rounded-full bg-[#FFCC00] transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] tabular-nums text-[#6E6E73]">
                  {quest.done}/{quest.total}
                </span>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#6E6E73]">
                {quest.complete ? "Mission logged" : "Tap to navigate"}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  jumpTo(quest.section);
                }}
                className="font-mono inline-flex items-center gap-1.5 rounded-[2px] text-[9px] font-bold uppercase tracking-[0.1em] text-[#FFCC00] transition hover:brightness-110"
              >
                {quest.targetLabel} <ArrowIcon />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-2.5">
        <div className="pointer-events-auto mb-2 flex flex-col items-center gap-1.5">
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
              className="font-mono grid h-8 w-8 place-items-center rounded-full border border-white/[0.14] bg-[#0B0B0C]/90 text-[11px] font-bold text-[#D6D6D9] backdrop-blur-md transition hover:border-[#FFCC00]/60 hover:text-[#FFCC00]"
            >
              ?
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!tourActive) jumpTo(quest.section);
          }}
          aria-label={
            tourActive ? "MYO guided tour in progress" : `Ask MYO to open ${quest.targetLabel}`
          }
          title={tourActive ? "MYO · guided tour" : `Jump to ${quest.targetLabel}`}
          className="companion-float pointer-events-auto group relative grid h-[80px] w-[80px] place-items-center rounded-full border border-[#FFCC00]/40 bg-[#0B0B0C]/90 backdrop-blur-md transition hover:border-[#FFCC00] sm:h-[88px] sm:w-[88px]"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 18px 50px rgba(0,0,0,0.55)",
          }}
        >
          <span
            aria-hidden
            className="companion-halo absolute -inset-2 rounded-full bg-[#FFCC00]/20 blur-xl"
          />
          <span
            aria-hidden
            className="absolute -inset-[5px] rounded-full border border-dashed border-[#FFCC00]/20"
          />
          <span aria-hidden className="absolute inset-0 rounded-full border border-white/[0.06]" />
          <MascotSvg />
          <span className="font-mono pointer-events-none absolute -bottom-0.5 text-[7px] tracking-[0.22em] text-[#FFCC00]/80">
            MYO
          </span>
        </button>
      </div>
    </div>
  );
}

function BubbleTail() {
  return (
    <span
      aria-hidden
      className="absolute -bottom-[7px] right-7 h-3 w-3 rotate-45 border-b border-r border-[#FFCC00]/40 bg-[#0E0E10]"
    />
  );
}

function MascotSvg() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="relative z-10 h-[66px] w-[66px] sm:h-[74px] sm:w-[74px]"
      aria-hidden
    >
      <defs>
        <radialGradient id="cp-body" cx="50%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#25252B" />
          <stop offset="58%" stopColor="#121214" />
          <stop offset="100%" stopColor="#08080A" />
        </radialGradient>
        <linearGradient id="cp-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0A2B2A" />
          <stop offset="48%" stopColor="#0F4C49" />
          <stop offset="100%" stopColor="#07100F" />
        </linearGradient>
        <linearGradient id="cp-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE58A" />
          <stop offset="45%" stopColor="#FFCC00" />
          <stop offset="100%" stopColor="#A67C00" />
        </linearGradient>
        <filter id="cp-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Twin orbital rings */}
      <g className="companion-orbit" style={{ transformOrigin: "48px 48px" }}>
        <ellipse
          cx="48"
          cy="48"
          rx="43"
          ry="15"
          fill="none"
          stroke="#FFCC00"
          strokeOpacity="0.38"
          strokeWidth="1"
          strokeDasharray="3 5"
          transform="rotate(-18 48 48)"
        />
        <circle cx="9.5" cy="55" r="2" fill="#FFCC00" filter="url(#cp-glow)" />
        <circle cx="86.5" cy="41" r="1.3" fill="#FFCC00" opacity="0.8" />
      </g>
      <g className="companion-orbit-reverse" style={{ transformOrigin: "48px 48px" }}>
        <ellipse
          cx="48"
          cy="48"
          rx="39"
          ry="12"
          fill="none"
          stroke="#35D6C0"
          strokeOpacity="0.32"
          strokeWidth="1"
          transform="rotate(58 48 48)"
        />
        <circle cx="17" cy="22" r="1.6" fill="#35D6C0" filter="url(#cp-glow)" />
      </g>

      {/* Antenna */}
      <path d="M48 27V19" stroke="url(#cp-gold)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="48" cy="16.5" r="2.2" fill="#FFCC00" filter="url(#cp-glow)" />

      {/* Companion shell */}
      <circle
        cx="48"
        cy="47"
        r="26"
        fill="url(#cp-body)"
        stroke="#FFCC00"
        strokeOpacity="0.55"
        strokeWidth="1.2"
      />
      <path
        d="M25 47c0-4 3-8 8-10M71 47c0-4-3-8-8-10"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Side thruster pods */}
      <rect x="18.5" y="42" width="4.5" height="11" rx="1.4" fill="#FFCC00" opacity="0.55" />
      <rect x="73" y="42" width="4.5" height="11" rx="1.4" fill="#FFCC00" opacity="0.55" />
      <rect x="18.5" y="46.5" width="4.5" height="2" rx="1" fill="#0B0B0C" opacity="0.7" />
      <rect x="73" y="46.5" width="4.5" height="2" rx="1" fill="#0B0B0C" opacity="0.7" />

      {/* Helmet */}
      <circle cx="48" cy="43" r="18.5" fill="#0E0E10" stroke="url(#cp-gold)" strokeWidth="1.7" />
      <path
        d="M33.5 40.5c1.2-6.2 7.3-10.2 14.5-10.2s13.3 4 14.5 10.2v5.2c0 6.6-6.5 11.8-14.5 11.8s-14.5-5.2-14.5-11.8z"
        fill="url(#cp-visor)"
        stroke="#35D6C0"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      {/* Visor reflection + scanning line */}
      <path
        d="M37 36.5c2.3-2.4 6-3.8 9.7-3.8"
        stroke="#DFFFFA"
        strokeOpacity="0.32"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M35 47.5h26"
        stroke="#7DFFF0"
        strokeOpacity="0.55"
        strokeWidth="0.9"
        strokeDasharray="2 3"
        className="companion-scan"
      />
      {/* Telemetry eyes */}
      <circle cx="42" cy="42.5" r="1.7" fill="#9CFFF4" filter="url(#cp-glow)" />
      <circle cx="54" cy="42.5" r="1.7" fill="#9CFFF4" filter="url(#cp-glow)" />
      <path
        d="M43.5 50.5c1.4 1.2 3 1.8 4.5 1.8s3.1-.6 4.5-1.8"
        fill="none"
        stroke="#9CFFF4"
        strokeOpacity="0.55"
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      {/* Chest telemetry module */}
      <rect
        x="38"
        y="62.5"
        width="20"
        height="8"
        rx="1.6"
        fill="#121214"
        stroke="#FFCC00"
        strokeOpacity="0.45"
      />
      <rect x="41" y="65.5" width="5" height="1.4" rx="0.7" fill="#35D6C0" />
      <rect x="47.5" y="65.5" width="4" height="1.4" rx="0.7" fill="#FFCC00" />
      <rect x="53" y="65.5" width="2.5" height="1.4" rx="0.7" fill="#9B8CFF" />
      <circle cx="41.5" cy="68.4" r="0.6" fill="#35D6C0" />

      {/* Ambient stars */}
      <g fill="#FFFFFF">
        <circle cx="26" cy="20" r="0.8" opacity="0.5" />
        <circle cx="68" cy="16" r="0.7" opacity="0.35" />
        <circle cx="80" cy="70" r="0.7" opacity="0.3" />
        <circle cx="17" cy="72" r="0.9" opacity="0.35" />
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
