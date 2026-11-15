import { useEffect, useMemo, useState } from "react";
import Myo3D from "./Myo3D";

export type DailyQuest = { id: string; title: string; detail: string; xp: number };

// Daily routine. Durations follow typical ISS crew exercise blocks; this is a gamified demo, not medical advice.
export const DAILY_QUESTS: DailyQuest[] = [
  { id: "ared", title: "Resistive exercise", detail: "30 min strength block", xp: 30 },
  { id: "cardio", title: "Treadmill cardio", detail: "30 min harnessed run", xp: 30 },
  { id: "bike", title: "Cycle ergometer", detail: "20 min steady ride", xp: 20 },
  { id: "balance", title: "Balance and gaze drills", detail: "10 min vestibular work", xp: 10 },
  { id: "stretch", title: "Core and stretch", detail: "10 min mobility", xp: 10 },
];
const QUESTS = DAILY_QUESTS;
const TOTAL_XP = QUESTS.reduce((n, q) => n + q.xp, 0);

type Store = { date: string; done: string[]; history: string[] };
const KEY = "myoshield-daily-quests";

/** Read by the floating companion so its Daily Quest bubble always matches this panel. */
export const DAILY_QUESTS_KEY = KEY;
/** Fired in-tab whenever the quest state changes; the companion listens for it. */
export const DAILY_QUESTS_EVENT = "myoshield:daily-quests";

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

function load(): Store {
  const today = dayKey();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Store | null;
    if (raw && raw.date === today) return raw;
    // New day: yesterday's progress is archived only if every quest was done.
    const history = raw?.history ?? [];
    if (raw && raw.done.length === QUESTS.length && !history.includes(raw.date))
      history.push(raw.date);
    return { date: today, done: [], history };
  } catch {
    return { date: today, done: [], history: [] };
  }
}

type Mood = "tired" | "warming" | "energetic";

const MOODS: Record<Mood, { label: string; line: (left: number) => string; color: string }> = {
  tired: {
    label: "TIRED",
    line: () => "I have not moved all day... I feel so heavy. Can we start a quest?",
    color: "#8E8E93",
  },
  warming: {
    label: "WARMING UP",
    line: (left) =>
      `Nice start! ${left} more ${left === 1 ? "quest" : "quests"} and I will be full of energy.`,
    color: "#F2B84B",
  },
  energetic: {
    label: "ENERGETIC",
    line: () => "All quests done! I feel amazing. See you tomorrow, astronaut!",
    color: "#FFCC00",
  },
};

function Mascot({ mood }: { mood: Mood }) {
  return (
    <div
      className={`relative aspect-square w-full max-w-[300px] overflow-hidden rounded-[2px] border transition-colors duration-700 ${
        mood === "energetic" ? "border-[#FFCC00]" : "border-white/[0.08]"
      }`}
      style={{
        background: "radial-gradient(80% 70% at 50% 35%, #1C1C1F 0%, #121214 55%, #0B0B0C 100%)",
      }}
      role="img"
      aria-label={`3D mascot, mood: ${MOODS[mood].label.toLowerCase()}. Drag to rotate.`}
    >
      <Myo3D mood={mood} />
      {mood === "tired" && (
        <>
          <span className="quest-zzz font-bold-sans pointer-events-none absolute right-6 top-6 text-[28px] text-[#D6D6D9]">
            Z
          </span>
          <span
            className="quest-zzz font-bold-sans pointer-events-none absolute right-12 top-14 text-[20px] text-[#D6D6D9]"
            style={{ animationDelay: "0.8s" }}
          >
            z
          </span>
          <span
            className="quest-zzz font-bold-sans pointer-events-none absolute right-[4.5rem] top-[5.5rem] text-[15px] text-[#D6D6D9]"
            style={{ animationDelay: "1.6s" }}
          >
            z
          </span>
        </>
      )}
      <span className="font-mono pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.14em] text-white/40">
        DRAG TO ROTATE
      </span>
    </div>
  );
}

export default function DailyQuests() {
  const [state, setState] = useState<Store>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(DAILY_QUESTS_EVENT, { detail: state }));
  }, [state]);

  const toggle = (id: string) =>
    setState((s) => {
      const done = s.done.includes(id) ? s.done.filter((x) => x !== id) : [...s.done, id];
      // Keep today's entry in history in sync with "all quests done".
      const full = done.length === QUESTS.length;
      const history = s.history.filter((d) => d !== s.date);
      if (full) history.push(s.date);
      return { ...s, done, history };
    });

  const doneCount = state.done.length;
  const mood: Mood =
    doneCount === 0 ? "tired" : doneCount === QUESTS.length ? "energetic" : "warming";
  const xp = QUESTS.filter((q) => state.done.includes(q.id)).reduce((n, q) => n + q.xp, 0);
  const energy = Math.round((xp / TOTAL_XP) * 100);

  const streak = useMemo(() => {
    let n = 0;
    // Today counts if complete; otherwise the streak is judged up to yesterday.
    for (let i = state.history.includes(dayKey()) ? 0 : 1; ; i++) {
      if (state.history.includes(shift(-i))) n++;
      else break;
    }
    return n;
  }, [state.history]);

  const week = Array.from({ length: 7 }, (_, i) => {
    const k = shift(i - 6);
    return { k, done: state.history.includes(k), today: i === 6 };
  });

  const m = MOODS[mood];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-[#FFCC00]">DAILY QUESTS</p>
          <h2 className="serif mt-3 text-[48px] leading-none text-[#FFFFFF]">
            Keep Myo energized.
          </h2>
          <p className="mt-3 max-w-[520px] text-[15px] text-[#8E8E93]">
            Finish today's workout routine. If you skip it, your companion gets tired.
          </p>
        </div>
        <span className="font-mono rounded-[2px] border border-white/[0.08] px-3 py-1 text-[9.5px] uppercase tracking-[0.14em] text-[#8E8E93]">
          RESETS EVERY DAY AT MIDNIGHT
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Pet */}
        <div className="flex flex-col items-center self-start rounded-[2px] border border-white/[0.08] bg-[#121214] p-5">
          <Mascot mood={mood} />
          <div
            className="relative mt-5 w-full rounded-[2px] border border-white/[0.08] bg-[#0E0E10] px-4 py-3 text-[14px] leading-[1.4] text-[#FFFFFF]"
            aria-live="polite"
          >
            {m.line(QUESTS.length - doneCount)}
          </div>
          <div className="mt-5 w-full">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] tracking-[0.14em]" style={{ color: m.color }}>
                MYO · {m.label}
              </span>
              <span className="font-mono text-[11px] text-[#8E8E93]">ENERGY {energy}%</span>
            </div>
            <div className="mt-2 h-[8px] overflow-hidden rounded-full bg-[#ffffff14]">
              <div
                className="h-full rounded-full transition-[width,background] duration-700"
                style={{
                  width: `${energy}%`,
                  background: m.color,
                }}
              />
            </div>
          </div>
        </div>

        {/* Quests */}
        <div className="flex flex-col rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-bold-sans text-[32px] leading-none text-[#FFFFFF]">
                {doneCount}/{QUESTS.length}
                <span className="ml-2 text-[15px] font-normal text-[#8E8E93]">quests today</span>
              </p>
              <p className="font-mono mt-2 text-[11px] tracking-[0.1em] text-[#6E6E73]">
                {xp} / {TOTAL_XP} XP
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-[2px] border border-white/[0.08] bg-[#121214] px-4 py-2">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="#F2B84B">
                <path d="M12 2c1 4-2 5-2 8 0 1.5 1 2.5 2 2.5s2-1 2-2.5c2 1 4 3.5 4 6.5a6 6 0 0 1-12 0c0-5 4-7 6-14Z" />
              </svg>
              <span className="font-bold-sans text-[15px] text-[#FFFFFF]">{streak}</span>
              <span className="text-[13px] text-[#8E8E93]">day streak</span>
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            {QUESTS.map((q) => {
              const on = state.done.includes(q.id);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => toggle(q.id)}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-4 rounded-[2px] border px-4 py-4 text-left transition ${
                      on
                        ? "border-[#FFCC00]/50 bg-[#FFCC00]/8"
                        : "border-white/[0.08] bg-[#121214] hover:border-[#FFCC00]/40"
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-[2px] border transition ${
                        on ? "border-[#FFCC00] bg-[#FFCC00] text-[#0B0B0C]" : "border-white/20"
                      }`}
                    >
                      {on && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[16px] ${on ? "text-[#8E8E93] line-through" : "text-[#FFFFFF]"}`}
                      >
                        {q.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-[#8E8E93]">{q.detail}</span>
                    </span>
                    <span className="font-mono shrink-0 text-[12px] text-[#FFCC00]">
                      +{q.xp} XP
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto pt-6">
            <p className="font-mono mb-3 text-[11px] tracking-[0.14em] text-[#6E6E73]">
              LAST 7 DAYS
            </p>
            <div className="flex gap-2">
              {week.map((d) => (
                <span
                  key={d.k}
                  title={d.k}
                  className={`h-2.5 flex-1 rounded-[1px] ${d.done ? "bg-[#FFCC00]" : "bg-[#ffffff14]"} ${d.today ? "ring-1 ring-[#8E8E93]" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="font-mono mt-6 text-[10.5px] text-[#6E6E73]">
        GAMIFIED DEMO ROUTINE · NOT MEDICAL OR TRAINING ADVICE
      </p>
    </div>
  );
}
