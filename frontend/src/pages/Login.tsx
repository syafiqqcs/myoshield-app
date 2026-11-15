import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import { CREW, CREW_PHOTOS, CREW_STATUS_STYLE, type CrewMember } from "../lib/crew";
import { DOMAINS } from "../lib/data";
import { fetchModelStatus } from "../lib/api";
import { Icon, Logo, type IconName } from "../components/ui";

const DOMAIN_ICONS: Record<string, IconName> = {
  radiation: "radiation",
  musculoskeletal: "dna",
  vestibular: "ear",
  cardiovascular: "heart",
};

function UtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono hidden items-center gap-1.5 text-[10.5px] tabular-nums text-[#D6D6D9] lg:inline-flex">
      <span className="text-[#FFCC00]">◷</span>
      {pad(now.getUTCHours())}:{pad(now.getUTCMinutes())}:{pad(now.getUTCSeconds())}
      <span className="text-[9px] tracking-[0.18em] text-[#6E6E73]">UTC</span>
    </span>
  );
}

function ModelsPill() {
  const [state, setState] = useState({ count: 5, online: true });
  useEffect(() => {
    let alive = true;
    fetchModelStatus()
      .then((r) => {
        if (alive) setState({ count: r.count, online: r.online || r.all_expected_loaded });
      })
      .catch(() => {
        /* Keep the catalogued default when the backend registry is unreachable. */
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <span
      className="font-mono inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[9.5px] tracking-[0.14em] whitespace-nowrap"
      style={{
        borderColor: state.online ? "rgba(255,204,0,0.45)" : "rgba(245,166,35,0.45)",
        background: state.online ? "rgba(255,204,0,0.1)" : "rgba(245,166,35,0.1)",
        color: state.online ? "#FFCC00" : "#F5A623",
      }}
    >
      <i
        className={`h-1.5 w-1.5 rounded-full ${state.online ? "live-dot" : ""}`}
        style={{ background: state.online ? "#35D6C0" : "#F5A623" }}
      />
      {state.online ? `${state.count} ML MODELS ONLINE` : "MODEL REGISTRY OFFLINE"}
    </span>
  );
}

function CrewCard({
  member,
  index,
  onSelect,
}: {
  member: CrewMember;
  index: number;
  onSelect: (m: CrewMember) => void;
}) {
  const domain = DOMAINS[member.domain];
  const status = CREW_STATUS_STYLE[member.status];
  // The commander's orbital portrait is shown in full colour; the other cards
  // keep the desaturated NASA-portrait treatment.
  const fullColor = member.id === "AST-01";
  return (
    <button
      type="button"
      onClick={() => onSelect(member)}
      className="group relative flex flex-col bg-[#0B0B0C] text-left transition-colors duration-300 hover:bg-[#121214] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFCC00]/70"
      aria-label={`Open Control Panel for ${member.name}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={CREW_PHOTOS[member.id]}
          alt={`${member.name}, ${member.role}`}
          loading="lazy"
          className={`h-full w-full object-cover object-center transition duration-[900ms] ease-out group-hover:scale-[1.04] ${
            fullColor ? "" : "grayscale contrast-[1.08] group-hover:grayscale-0"
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-0 ${
            fullColor
              ? "bg-gradient-to-t from-black/80 via-transparent to-black/30"
              : "bg-gradient-to-t from-[#0B0B0C] via-[#0B0B0C]/10 to-transparent"
          }`}
        />
        <span className="font-mono absolute left-3 top-3 border border-white/20 bg-[#0B0B0C]/70 px-2 py-1 text-[9px] tracking-[0.16em] text-[#D6D6D9] backdrop-blur-sm">
          {String(index + 1).padStart(2, "0")} / {member.id}
        </span>
        <span
          className="font-mono absolute right-3 top-3 inline-flex items-center gap-1.5 bg-[#0B0B0C]/70 px-2 py-1 text-[8.5px] tracking-[0.14em] backdrop-blur-sm"
          style={{ color: status.text }}
        >
          <i className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
          {status.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5">
          <Icon name={DOMAIN_ICONS[member.domain]} size={11} />
          <span className="font-mono text-[9px] tracking-[0.16em]" style={{ color: domain.color }}>
            {member.specialty.toUpperCase()}
          </span>
        </div>
        <p className="font-bold-sans mt-2 text-[19px] leading-[1.1] tracking-[-0.025em] text-[#FFFFFF]">
          {member.name}
        </p>
        <p className="mt-1 text-[11.5px] text-[#8E8E93]">{member.role}</p>

        <div className="mt-4 grid grid-cols-2 gap-px bg-white/[0.08]">
          {[
            ["HR", `${member.hr}`, "bpm"],
            ["SPO₂", `${member.spo2}`, "%"],
          ].map(([label, value, unit]) => (
            <div key={label} className="bg-[#0B0B0C] p-2.5">
              <p className="font-mono text-[8.5px] tracking-[0.16em] text-[#6E6E73]">{label}</p>
              <p className="font-mono mt-1 text-[16px] leading-none tabular-nums text-[#FFFFFF]">
                {value}
                <span className="ml-0.5 text-[9px] text-[#8E8E93]">{unit}</span>
              </p>
            </div>
          ))}
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-1.5 border-t border-white/[0.08] pt-3">
          {[
            ["EXP", member.expedition.replace("Expedition ", "EXP "), member.expedition],
            ["MODULE", member.module.split(" ")[0].toUpperCase(), member.module],
            ["EVA", member.evaHours, `${member.evaHours} extravehicular`],
          ].map(([label, short, full]) => (
            <div key={label} title={full}>
              <dt className="font-mono text-[8px] tracking-[0.14em] text-[#6E6E73]">{label}</dt>
              <dd className="font-mono mt-0.5 truncate text-[10px] tabular-nums text-[#D6D6D9]">
                {short}
              </dd>
            </div>
          ))}
        </dl>

        <span className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#FFCC00]">
            Enter dashboard
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full border border-[#FFCC00] text-[#FFCC00] transition duration-300 group-hover:bg-[#FFCC00] group-hover:text-[#0B0B0C]">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2 8h11M8.5 3.5 13 8l-4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      </div>
    </button>
  );
}

export default function Login() {
  const { signIn, go, notify } = useApp();

  // The Control Panel ships with one demonstration profile, so every crew card opens it.
  const enter = (member: CrewMember) => {
    notify(`Opening Control Panel for ${member.name} (demonstration)`);
    signIn("Astronaut", true, member.id);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0B0B0C] text-[#FFFFFF]">
      {/* Mission bar */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#0B0B0C]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-4 py-3 md:px-8">
          <button
            onClick={() => go("landing")}
            aria-label="MYOSHIELD home"
            className="flex items-center gap-3"
          >
            <Logo size={19} />
          </button>
          <span className="hidden h-4 w-px bg-white/15 sm:block" />
          <span className="font-mono hidden items-center gap-2 text-[9.5px] tracking-[0.2em] text-[#8E8E93] sm:flex">
            ORBITAL BIOMEDICAL TELEMETRY <span className="text-[#FFCC00]">//</span> CREW SELECT
          </span>

          <div className="ml-auto flex items-center gap-3">
            <UtcClock />
            <ModelsPill />
            <button
              type="button"
              onClick={() => go("landing")}
              className="font-mono border border-white/[0.08] px-3 py-1.5 text-[9.5px] tracking-[0.16em] text-[#D6D6D9] transition hover:border-[#FFCC00]/60 hover:text-[#FFFFFF]"
            >
              ← HOME
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] flex-col px-4 pb-20 pt-28 md:px-8 md:pt-32">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="font-mono inline-flex items-center gap-2 border border-white/[0.08] bg-[#121214] px-3 py-1.5 text-[9.5px] uppercase tracking-[0.18em] text-[#8E8E93]">
            <i className="live-dot h-1.5 w-1.5 rounded-full bg-[#35D6C0]" />
            Demonstration mode · no account required
          </p>
          <h1 className="font-bold-sans mt-6 text-[46px] leading-[0.9] tracking-[-0.05em] text-[#FFFFFF] md:text-[76px]">
            Select astronaut profile
          </h1>
          <p className="mx-auto mt-5 max-w-[540px] text-[14px] leading-[1.65] text-[#8E8E93]">
            Choose a crew member to open their personal health Control Panel with live models,
            telemetry visuals, and daily quests.
          </p>
        </div>

        <div className="mt-10 grid divide-x divide-y divide-white/[0.08] border border-white/[0.08] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CREW.map((member, i) => (
            <CrewCard key={member.id} member={member} index={i} onSelect={enter} />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span className="font-mono inline-flex items-center gap-1.5 border border-[#35D6C0]/35 bg-[#35D6C0]/8 px-3 py-1 text-[9px] uppercase tracking-[0.16em] text-[#35D6C0]">
            <i className="live-dot h-1.5 w-1.5 rounded-full bg-[#35D6C0]" />5 profiles synced
          </span>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#6E6E73]">
            Demonstration crew · simulated vitals · not a diagnostic system
          </p>
        </div>
      </main>
    </div>
  );
}
