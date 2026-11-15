import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  askFlightSurgeon,
  type ChatAstronaut,
  type ChatEquipment,
  type ChatEquipmentEntry,
  type ChatHistoryEntry,
  type ChatResponse,
  type ChatStep,
  type DomainKey,
  type LiveTelemetry,
  type UploadAnalysis,
} from "../lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  data?: ChatResponse;
  pending?: boolean;
};

const INITIAL_MESSAGE: ChatMessage = {
  id: "fs-welcome",
  role: "assistant",
  text: "Flight Surgeon AI online. Describe the emergency symptom and I will cross-check it against live ISS telemetry, then return the exact equipment and rescue sequence.",
};

type LocalScenario = "respiratory" | "vestibular" | "radiation" | "musculoskeletal" | "status";

const SCENARIO_KEYWORDS: [LocalScenario, string[]][] = [
  ["respiratory", ["breath", "breathe", "spo2", "oxygen", "chest", "hypoxia", "choking", "air"]],
  [
    "vestibular",
    ["dizzy", "vertigo", "spin", "nausea", "balance", "vomit", "head", "vision", "vor"],
  ],
  ["radiation", ["radiation", "flare", "solar", "dose", "msv", "shield", "eva", "burn"]],
  [
    "musculoskeletal",
    ["muscle", "back", "pain", "cramp", "bone", "strain", "leg", "arm", "ared", "weak"],
  ],
];

const DOMAIN_LABEL: Record<string, string> = {
  radiation: "Radiation",
  musculoskeletal: "Musculoskeletal",
  vestibular: "Vestibular",
  cardiovascular: "Cardiovascular & Respiratory",
};

function pickScenario(message: string): LocalScenario {
  const text = message.toLowerCase();
  for (const [scenario, keywords] of SCENARIO_KEYWORDS) {
    if (keywords.some((keyword) => new RegExp(`\\b${keyword}`).test(text))) return scenario;
  }
  return "status";
}

/**
 * Offline triage fallback. Mirrors the backend's five scenarios so the drawer
 * still answers every message differently when the FastAPI link is down.
 */
function localFallback(
  message: string,
  telemetry: LiveTelemetry,
  astronaut: ChatAstronaut | null,
  analysisResult: UploadAnalysis | null,
): ChatResponse {
  const name = astronaut?.name ?? "Crew member";
  const role = astronaut?.role ?? "ISS crew";
  const module = astronaut?.issModule || telemetry.issModule;
  const scores = analysisResult?.domain_scores ?? null;
  const ranked = (
    scores ? (Object.entries(scores) as [DomainKey, number][]).sort((a, b) => b[1] - a[1]) : []
  ) as [DomainKey, number][];
  const [primaryKey, primaryScore] = ranked[0] ?? (["cardiovascular", 0] as [DomainKey, number]);
  const [secondaryKey, secondaryScore] =
    ranked[1] ?? (["musculoskeletal", 0] as [DomainKey, number]);
  const interaction = analysisResult?.interaction_type ?? telemetry.interactionMode;
  const readiness = analysisResult?.mission_readiness_score ?? 0;
  const strain = analysisResult?.integrated_strain_index ?? 0;
  const critical = telemetry.spo2 < 90 || telemetry.heartRate > 130;
  const severity = critical ? "CRITICAL" : "URGENT";
  const scenario = pickScenario(message);
  const quoted = message.trim();
  const spo2 = Math.round(telemetry.spo2);
  const hr = Math.round(telemetry.heartRate);
  const primaryLabel = DOMAIN_LABEL[primaryKey] ?? primaryKey;
  const secondaryLabel = DOMAIN_LABEL[secondaryKey] ?? secondaryKey;

  let reply: string;
  let equipment: ChatEquipmentEntry[];
  let steps: ChatStep[];

  if (scenario === "respiratory") {
    reply = `${severity} — RESPIRATORY / HYPOXIC EMERGENCY in ${module}. ${name}, you reported: "${quoted}". Live pulse oximetry reads SpO₂ ${spo2}% with HR ${hr} bpm. Protect the airway, drive SpO₂ back to ≥ 92%, and escalate immediately if it falls below 88%. (Local triage fallback — backend offline.)`;
    equipment = [
      "Portable Breathing Apparatus (PBA)",
      "ISS Pulse Oximeter",
      "Crew Medical Restraint System",
    ];
    steps = [
      {
        title: "Open the airway and restrain",
        detail: `Seat ${name} upright in the Crew Medical Restraint System, loosen the straps, and clear the airway.`,
        timing: "0–20 s",
      },
      {
        title: "Apply the PBA and pulse oximeter",
        detail: `Fit the Portable Breathing Apparatus, start O₂ at 2–4 L/min, and titrate SpO₂ from ${spo2}% back to ≥ 92%.`,
        timing: "20–60 s",
      },
      {
        title: "Monitor and report the trend",
        detail: `Recheck SpO₂/HR every 30 seconds against the current ${spo2}% / ${hr} bpm and read the trend to Mission Control.`,
        timing: "Continuous",
      },
    ];
  } else if (scenario === "vestibular") {
    reply = `${severity} — VESTIBULAR / DISORIENTATION EVENT in ${module}. ${name}, you reported: "${quoted}". Freeze head movement, anchor your visual horizon, and treat the nausea before any translation. (Local triage fallback — backend offline.)`;
    equipment = [
      "Visual Horizon Anchor Strap",
      "Meclizine / Promethazine Med-Kit",
      "Handrail Tether",
    ];
    steps = [
      {
        title: "Anchor and freeze the head",
        detail: `Tether ${name} with the Visual Horizon Anchor Strap, fix the gaze on one point, and hold the head still.`,
        timing: "0–30 s",
      },
      {
        title: "Give the vestibular med-kit",
        detail:
          "Administer meclizine (promethazine if vomiting) and re-check gaze stability and nystagmus.",
        timing: "30–90 s",
      },
      {
        title: "Translate slowly with an escort",
        detail: `Move ${name} along the Handrail Tether to the ${module} restraint station without rapid head turns.`,
        timing: "Continuous",
      },
    ];
  } else if (scenario === "radiation") {
    reply = `${severity} — RADIATION / SOLAR PARTICLE EVENT in ${module}. ${name}, you reported: "${quoted}". Time, distance, and shielding are the only countermeasures — relocate to the most shielded water-wall volume now. (Local triage fallback — backend offline.)`;
    equipment = [
      "Personal Active Dosimeter (PAD)",
      "Polyethylene Water-Wall Liner",
      "Potassium Iodide (KI) Pack",
    ];
    steps = [
      {
        title: "Relocate to the shielded core",
        detail: `Move ${name} out of the ${module} to the most heavily shielded water-wall station and clip on the Personal Active Dosimeter.`,
        timing: "0–60 s",
      },
      {
        title: "Deploy polyethylene shielding",
        detail:
          "Position the Polyethylene Water-Wall Liner between the crew and the hull, then log the dose rate and exposure time.",
        timing: "60–180 s",
      },
      {
        title: "Distribute KI and report",
        detail:
          "Issue the Potassium Iodide (KI) pack per protocol, survey skin and clothing, and read the cumulative dose to Mission Control.",
        timing: "Continuous",
      },
    ];
  } else if (scenario === "musculoskeletal") {
    reply = `${severity} — MUSCULOSKELETAL INJURY / STRAIN in ${module}. ${name}, you reported: "${quoted}". Offload the affected segment now and confirm distal neurovascular status before any repositioning. (Local triage fallback — backend offline.)`;
    equipment = [
      "Ultrasound Bone/Muscle Scanner",
      "ISS Cold Compress & Analgesic Kit",
      "ARED Lockout Pin",
    ];
    steps = [
      {
        title: "Offload and lock the ARED",
        detail: `Stop the current exercise, insert the ARED Lockout Pin, and float ${name} into a neutral, unloaded posture.`,
        timing: "0–60 s",
      },
      {
        title: "Scan and compress",
        detail:
          "Run the Ultrasound Bone/Muscle Scanner over the painful segment, then apply the ISS Cold Compress & Analgesic Kit.",
        timing: "60–120 s",
      },
      {
        title: "Recheck distal function and report",
        detail:
          "Confirm pulse, sensation, and movement beyond the injury and report the trend to Mission Control.",
        timing: "Continuous",
      },
    ];
  } else {
    const elevated = ranked.filter(([, value]) => value >= 0.6);
    const riskClause = elevated.length
      ? `${elevated.length} of your four .joblib domains are elevated — ${elevated
          .map(([key, value]) => `${DOMAIN_LABEL[key] ?? key} ${value.toFixed(2)}`)
          .join(", ")} — and the interaction is ${interaction}.`
      : `No domain crosses the 0.60 anomaly threshold; your highest is ${primaryLabel} at ${primaryScore.toFixed(2)}.`;
    reply = `${severity} — FLIGHT SURGEON STATUS BRIEFING for ${name} (${role}) in ${module}. You asked: "${quoted}". ${riskClause} Integrated strain ${strain.toFixed(2)}, mission readiness ${Math.round(readiness)}%, consensus ${interaction}. Primary focus is ${primaryLabel} (${primaryScore.toFixed(2)}); secondary watch is ${secondaryLabel} (${secondaryScore.toFixed(2)}). Live vitals: SpO₂ ${spo2}% · HR ${hr} bpm. (Local triage fallback — backend offline.)`;
    equipment = [
      ...(primaryKey === "radiation"
        ? ["Personal Active Dosimeter (PAD)", "Radiation Survey Meter"]
        : primaryKey === "musculoskeletal"
          ? ["Ultrasound Bone/Muscle Scanner", "ARED Lockout Pin"]
          : primaryKey === "vestibular"
            ? ["Visual Horizon Anchor Strap", "VOR Goggles / Eye Tracker"]
            : ["ISS Pulse Oximeter", "12-Lead ECG / Rhythm Monitor"]),
      "ISS Medical Checklist + Comms",
    ];
    steps = [
      {
        title: `Stabilise the ${primaryLabel} system`,
        detail: `Treat ${primaryLabel} first (${primaryScore.toFixed(2)}); secure ${name} and apply the ${equipment[0]}.`,
        timing: "0–60 s",
      },
      {
        title: `Rule out ${secondaryLabel}`,
        detail: `Your next-highest score is ${secondaryLabel} (${secondaryScore.toFixed(2)}); screen it before clearing ${name}.`,
        timing: "60–180 s",
      },
      {
        title: "Re-run the .joblib panel and report",
        detail: `Re-upload ${name}'s telemetry to refresh all four domain models, then read the ${interaction} consensus to Mission Control.`,
        timing: "Continuous",
      },
    ];
  }

  return {
    reply,
    telemetry_alert: `LIVE VITALS: SpO2 ${spo2}% • HR ${hr} BPM • ${interaction} — ${severity}`,
    equipment,
    steps,
    severity,
    domain: scenario,
    scenario,
    offline: true,
    disclaimer: "Local fallback only. Start the FastAPI backend for the full structured response.",
  };
}

export default function FlightSurgeonChat({
  open,
  onClose,
  liveTelemetry,
  astronaut = null,
  analysisResult = null,
}: {
  open: boolean;
  onClose: () => void;
  liveTelemetry: LiveTelemetry;
  astronaut?: ChatAstronaut | null;
  analysisResult?: UploadAnalysis | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);
  const messagesRef = useRef(messages);

  const nextId = () => {
    idRef.current += 1;
    return `fs-${idRef.current}`;
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 280);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;

    const userMessage: ChatMessage = { id: nextId(), role: "user", text: message };
    const pendingId = nextId();
    const pendingMessage: ChatMessage = { id: pendingId, role: "assistant", pending: true };

    // Last four turns, oldest first, so the backend can stay context-aware.
    const conversationHistory: ChatHistoryEntry[] = messagesRef.current
      .slice(-4)
      .map((entry) => ({ role: entry.role, content: entry.text ?? entry.data?.reply ?? "" }))
      .filter((entry) => entry.content.trim() !== "");

    setInput("");
    setBusy(true);
    setMessages((current) => [...current, userMessage, pendingMessage]);

    try {
      const data = await askFlightSurgeon(message, liveTelemetry, {
        conversationHistory,
        astronaut,
        analysisResult,
      });
      setMessages((current) =>
        current.map((entry) =>
          entry.id === pendingId ? { id: pendingId, role: "assistant", data } : entry,
        ),
      );
    } catch {
      const data = localFallback(message, liveTelemetry, astronaut, analysisResult);
      setMessages((current) =>
        current.map((entry) =>
          entry.id === pendingId
            ? { id: pendingId, role: "assistant", data: { ...data, offline: true } }
            : entry,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(input);
  };

  const quick = (symptom: string) => {
    if (busy) return;
    void send(symptom);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close flight surgeon"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#000000]/55 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-hidden={!open}
        aria-label="AI Flight Surgeon emergency chat"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-[rgba(255,255,255,0.08)] bg-[#121214] text-[#FFFFFF] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-[2px] w-full bg-[#FFCC00]" />

        <header className="border-b border-[rgba(255,255,255,0.08)] bg-[#121214] px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[2px] border border-[#FFCC00]/45 bg-[#FFCC00]/10 text-[#FFCC00]">
                <SurgeonMark />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[8.5px] font-semibold tracking-[0.18em] text-[#FFCC00]">
                  AI FLIGHT SURGEON
                </p>
                <h2 className="mt-0.5 truncate text-[18px] font-semibold leading-tight text-[#FFFFFF]">
                  Emergency consult
                </h2>
                <p className="font-mono mt-1 truncate text-[8.5px] tracking-[0.12em] text-[#8E8E93]">
                  ISS MEDICAL • {liveTelemetry.issModule.toUpperCase()} •{" "}
                  {liveTelemetry.interactionMode.toUpperCase()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close flight surgeon chat"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[2px] border border-white/[0.08] bg-[#121214] text-[#8E8E93] transition hover:border-[#FFCC00]/60 hover:text-[#FFCC00]"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-[2px] border border-white/[0.08] bg-[#121214] px-2.5 py-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFCC00] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFCC00]" />
            </span>
            <span className="font-mono text-[8.5px] tracking-[0.12em] text-[#FFCC00]">
              LINK ACTIVE
            </span>
            <span className="ml-auto font-mono text-[8.5px] text-[#8E8E93]">
              SpO2 {Math.round(liveTelemetry.spo2)}% · HR {Math.round(liveTelemetry.heartRate)} BPM
            </span>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="fs-scroll flex-1 space-y-3.5 overflow-y-auto bg-[#121214] px-4 py-4"
        >
          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[86%] rounded-[2px] border border-[#FFCC00]/40 bg-[#FFCC00]/10 px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-[#FFFFFF]">
                    {message.text}
                  </div>
                </div>
              );
            }

            if (message.pending) {
              return (
                <div
                  key={message.id}
                  className="flex w-fit items-center gap-2 rounded-[2px] border border-white/[0.08] bg-[#121214] px-3.5 py-3 text-[#8E8E93]"
                >
                  <span className="font-mono text-[9px] tracking-[0.12em]">CONSULTING</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <i
                        key={i}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFCC00]"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              );
            }

            if (message.data) {
              return (
                <div key={message.id} className="max-w-[94%]">
                  <EmergencyResponseCard data={message.data} telemetry={liveTelemetry} />
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className="max-w-[92%] rounded-[2px] border border-white/[0.08] bg-[#121214] px-3.5 py-3 text-[12.5px] leading-[1.5] text-[#D6D6D9]"
              >
                {message.text}
              </div>
            );
          })}
        </div>

        <div className="border-t border-[rgba(255,255,255,0.08)] bg-[#121214] px-3 pb-3 pt-2.5">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2.5">
            <QuickPill disabled={busy} onClick={() => quick("Shortness of Breath")}>
              Shortness of Breath
            </QuickPill>
            <QuickPill disabled={busy} onClick={() => quick("Severe Vertigo")}>
              Severe Vertigo
            </QuickPill>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 rounded-[2px] border border-white/[0.08] bg-[#121214] p-1.5 transition focus-within:border-[#FFCC00]/60"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type symptom, e.g. severe vertigo…"
              aria-label="Emergency symptom"
              className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[12.5px] text-[#FFFFFF] outline-none placeholder:text-[#6E6E73]"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="font-mono inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[2px] bg-[#FFCC00] px-3 text-[9.5px] font-bold tracking-[0.1em] text-[#0B0B0C] transition hover:bg-[#FFD633] disabled:cursor-not-allowed disabled:opacity-35"
            >
              SEND <SendIcon />
            </button>
          </form>

          <p className="font-mono mt-2 text-center text-[8px] tracking-[0.12em] text-[#6E6E73]">
            DECISION SUPPORT ONLY · NOT A CLINICAL DIAGNOSIS
          </p>
        </div>
      </aside>
    </>
  );
}

const EQUIPMENT_ICON_RULES: { match: RegExp; icon: string }[] = [
  { match: /breathing|pba|\bo2\b|oxygen|o₂/i, icon: "oxygen" },
  { match: /oximeter/i, icon: "pulse_oximeter" },
  { match: /restraint|strap|tether|anchor|handrail/i, icon: "handrail" },
  { match: /meclizine|promethazine/i, icon: "antiemetic" },
  { match: /dosimeter|\bpad\b/i, icon: "dosimeter" },
  { match: /water-wall|polyethylene|shield|radiation|survey/i, icon: "radiation" },
  { match: /ultrasound|scanner|bone/i, icon: "monitor" },
  { match: /cold|compress/i, icon: "cold_pack" },
  { match: /ared|lockout/i, icon: "ared" },
  { match: /ecg|rhythm/i, icon: "ecg" },
  { match: /\bvor\b|goggle|eye/i, icon: "eye_goggles" },
  { match: /comms|checklist/i, icon: "radio" },
  { match: /iodide|analgesic|med-kit|medical kit/i, icon: "medkit" },
];

function equipmentIcon(name: string): string {
  for (const rule of EQUIPMENT_ICON_RULES) if (rule.match.test(name)) return rule.icon;
  return "medkit";
}

/** The backend sends scenario equipment as plain names; older replies sent objects. */
function normalizeEquipment(equipment: ChatEquipmentEntry[] | undefined): ChatEquipment[] {
  return (equipment ?? []).map((item) =>
    typeof item === "string" ? { name: item, icon: equipmentIcon(item) } : item,
  );
}

function EmergencyResponseCard({
  data,
  telemetry,
}: {
  data: ChatResponse;
  telemetry: LiveTelemetry;
}) {
  const equipment = normalizeEquipment(data.equipment);
  const steps = data.steps ?? [];

  return (
    <div className="space-y-2.5">
      <div className="rounded-[2px] border border-[#F06464] bg-[#F06464] px-3 py-2 text-[#190707]">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[8px] font-bold tracking-[0.16em]">LIVE VITALS</p>
          <span className="font-mono text-[8px] font-bold tracking-[0.12em]">
            {data.severity ?? "ALERT"}
          </span>
        </div>
        <p className="font-mono mt-0.5 text-[10.5px] font-bold leading-tight">
          SpO2 {Math.round(telemetry.spo2)}% • HR {Math.round(telemetry.heartRate)} BPM •{" "}
          {telemetry.interactionMode.toUpperCase()}
        </p>
      </div>

      <p className="text-[12px] leading-[1.55] text-[#D6D6D9]">{data.reply}</p>

      {data.offline && (
        <div className="rounded-[2px] border border-[#F2B84B]/50 bg-[#F2B84B]/10 px-2.5 py-1.5 font-mono text-[8.5px] tracking-[0.08em] text-[#F2B84B]">
          BACKEND UNREACHABLE — LOCAL TRIAGE FALLBACK
        </div>
      )}

      <section className="rounded-[2px] border border-white/[0.08] bg-[#121214] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[8.5px] font-bold tracking-[0.14em] text-[#FFCC00]">
            GRAB EQUIPMENT
          </p>
          <span className="font-mono text-[8px] text-[#6E6E73]">{equipment.length} ITEMS</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {equipment.map((item) => (
            <li
              key={item.name}
              className="flex items-start gap-2 rounded-[2px] border border-white/[0.08] bg-[#0E0E10] px-2 py-1.5"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[1px] border border-[#FFCC00]/35 bg-[#FFCC00]/10 text-[#FFCC00]">
                <EquipmentIcon name={item.icon} />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold leading-tight text-[#FFFFFF]">
                  {item.name}
                </p>
                {item.detail && (
                  <p className="mt-0.5 text-[9px] leading-[1.4] text-[#8E8E93]">{item.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={`${step.title}-${index}`}
            className="flex gap-2.5 rounded-[2px] border border-white/[0.08] bg-[#0E0E10] p-2.5"
          >
            <span className="font-mono mt-0.5 text-[13px] font-bold leading-none text-[#FFCC00]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[11px] font-semibold leading-tight text-[#FFFFFF]">
                  {step.title}
                </p>
                {step.timing && (
                  <span className="font-mono rounded-[1px] border border-white/[0.08] px-1.5 py-0.5 text-[7.5px] tracking-[0.08em] text-[#8E8E93]">
                    {step.timing}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[9.5px] leading-[1.5] text-[#8E8E93]">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickPill({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono shrink-0 rounded-[2px] border border-white/[0.08] bg-[#121214] px-2.5 py-1 text-[9px] uppercase tracking-[0.08em] text-[#8E8E93] transition hover:border-[#FFCC00]/50 hover:text-[#FFCC00] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SurgeonMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.2c2.2-1.2 4.8-.5 6.1 1.6 1.2 2 .8 4.5-.9 6.2l-2.3 2.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 3.2c-2.2-1.2-4.8-.5-6.1 1.6-1.2 2-.8 4.5.9 6.2l2.3 2.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 13.3v6.1M9.5 16.2h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8.2" r="1.3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m4 12 16-8-5.2 16-3.1-6.2L4 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m11.7 13.8 3.1-3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EquipmentIcon({ name }: { name: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "oxygen":
      return (
        <svg {...common}>
          <rect x="7" y="3" width="7" height="13" rx="3.5" />
          <path d="M10.5 3v6M17 11h2.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5H17M17 14h-3" />
        </svg>
      );
    case "pulse_oximeter":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M7 13h2l1.5-4 2.5 7 1.5-3H17" />
        </svg>
      );
    case "stethoscope":
      return (
        <svg {...common}>
          <path d="M6 4v5a5 5 0 0 0 10 0V4" />
          <path d="M11 14v2a4 4 0 0 0 8 0v-2" />
          <circle cx="19" cy="12" r="2" />
          <path d="M6 4H4M16 4h2" />
        </svg>
      );
    case "radio":
      return (
        <svg {...common}>
          <rect x="3" y="9" width="18" height="12" rx="2" />
          <path d="M7 9 17 3M8 14h4M8 18h7" />
          <circle cx="18" cy="13" r="1" />
        </svg>
      );
    case "ecg":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M6 13h3l1.5-5 3 9 1.5-4h3" />
        </svg>
      );
    case "aed":
      return (
        <svg {...common}>
          <path d="M20 5.4a4.5 4.5 0 0 0-6.4 0L12 7l-1.6-1.6A4.5 4.5 0 0 0 4 10.8L12 19l8-8.2a4.5 4.5 0 0 0 0-5.4Z" />
          <path d="m12.5 8-2 4h3l-2 4" />
        </svg>
      );
    case "antiemetic":
      return (
        <svg {...common}>
          <path d="M7.5 4.5a4.5 4.5 0 0 1 6.4 0l5.6 5.6a4.5 4.5 0 0 1-6.4 6.4L7.5 10.9a4.5 4.5 0 0 1 0-6.4Z" />
          <path d="m8 11 5-5" />
        </svg>
      );
    case "eye_goggles":
      return (
        <svg {...common}>
          <path d="M3 13h18M5 13v3a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-3M13 13v3a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-3" />
          <path d="M8 13V9a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "handrail":
      return (
        <svg {...common}>
          <path d="M5 4v16M19 4v16M5 8h14" />
          <path d="M8 12h3M13 12h3" />
        </svg>
      );
    case "neuro_kit":
      return (
        <svg {...common}>
          <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-1 5.8V16a3 3 0 0 0 4 2.8V20h6v-1.2a3 3 0 0 0 4-2.8v-2.2A3 3 0 0 0 18 8V7a3 3 0 0 0-3-3H9Z" />
          <path d="M12 5v14M9 10h6" />
        </svg>
      );
    case "penlight":
      return (
        <svg {...common}>
          <path d="M8 3h8v5l-2 3v10H10V11L8 8V3Z" />
          <path d="M10 16h4M12 19v1" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 17v4M6 10h3l1.5-3 3 6 1.5-3h3" />
        </svg>
      );
    case "dosimeter":
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <circle cx="12" cy="10" r="2.5" />
          <path d="M12 5v1M12 14v1M7.5 10h1M15.5 10h1M9 17h6" />
        </svg>
      );
    case "radiation":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2" />
          <path d="M12 10V4M10 13l-5 3M14 13l5 3" />
          <path d="M9 5.5 6.5 9M15 5.5 17.5 9" />
        </svg>
      );
    case "decon_kit":
      return (
        <svg {...common}>
          <path d="M9 8h5v13H9zM11.5 8V5h5v3M16.5 5h3M16 12h2M16 15h2" />
          <path d="M10.5 12h2M10.5 15h2" />
        </svg>
      );
    case "splint":
      return (
        <svg {...common}>
          <path d="M8 4a3 3 0 0 0-3 3v2a3 3 0 0 0 0 6v2a3 3 0 0 0 3 3h1V4H8ZM16 4a3 3 0 0 1 3 3v2a3 3 0 0 1 0 6v2a3 3 0 0 1-3 3h-1V4h1Z" />
          <path d="M9 8h6M9 12h6M9 16h6" />
        </svg>
      );
    case "cold_pack":
      return (
        <svg {...common}>
          <path d="M12 3v18M5 7l14 10M19 7 5 17" />
          <path d="m12 3 2 2M12 3 10 5M12 21l2-2M12 21l-2-2" />
        </svg>
      );
    case "ared":
      return (
        <svg {...common}>
          <path d="M4 9v6M20 9v6M7 11v2M17 11v2M7 12h10" />
          <rect x="2" y="7" width="3" height="10" rx="1" />
          <rect x="19" y="7" width="3" height="10" rx="1" />
        </svg>
      );
    case "medkit":
    default:
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M9 12h6M12 9v6" />
        </svg>
      );
  }
}
