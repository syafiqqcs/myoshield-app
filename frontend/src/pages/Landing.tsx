import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import { CREW, CREW_PHOTOS, CREW_STATUS_STYLE } from "../lib/crew";
import { DOMAINS } from "../lib/data";
import { fetchModelStatus } from "../lib/api";
import { Icon, Logo, type IconName } from "../components/ui";

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

const DOMAIN_ICONS: Record<string, IconName> = {
  radiation: "radiation",
  musculoskeletal: "dna",
  vestibular: "ear",
  cardiovascular: "heart",
};

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1600&q=85";

function ModelsPill() {
  // The catalogue ships with five models, so the header reads "5 ML MODELS ONLINE"
  // until the registry reports otherwise.
  const [state, setState] = useState({ count: 5, online: true, all: true });
  useEffect(() => {
    let alive = true;
    fetchModelStatus()
      .then((r) => {
        if (alive) setState({ count: r.count, online: r.online, all: r.all_expected_loaded });
      })
      .catch(() => {
        /* The pill stays on the catalogued default when the registry is unreachable. */
      });
    return () => {
      alive = false;
    };
  }, []);
  const online = state.online || state.all;
  return (
    <span
      className="font-mono inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[9.5px] tracking-[0.16em] whitespace-nowrap"
      style={{
        borderColor: online ? "rgba(255,204,0,0.45)" : "rgba(245,166,35,0.45)",
        background: online ? "rgba(255,204,0,0.1)" : "rgba(245,166,35,0.1)",
        color: online ? "#FFCC00" : "#F5A623",
      }}
    >
      <i
        className={`h-1.5 w-1.5 rounded-full ${online ? "live-dot" : ""}`}
        style={{ background: online ? "#35D6C0" : "#F5A623" }}
      />
      {online ? `${state.count} ML MODELS ONLINE` : "MODEL REGISTRY OFFLINE"}
    </span>
  );
}

function CrewTile({ member, index }: { member: (typeof CREW)[number]; index: number }) {
  const { go } = useApp();
  const status = CREW_STATUS_STYLE[member.status];
  const domain = DOMAINS[member.domain];
  return (
    <button
      type="button"
      onClick={() => go("login")}
      className="group relative flex flex-col bg-[#0B0B0C] text-left transition-colors duration-300 hover:bg-[#121214] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFCC00]/70"
      aria-label={`Open the demonstration control panel for ${member.name}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={CREW_PHOTOS[member.id]}
          alt={`${member.name}, ${member.role}`}
          loading="lazy"
          className="h-full w-full object-cover grayscale contrast-[1.08] transition duration-[900ms] ease-out group-hover:scale-[1.04] group-hover:grayscale-0"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0B0C] via-[#0B0B0C]/10 to-transparent" />
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
        <h3 className="font-bold-sans mt-2 text-[18px] leading-[1.1] tracking-[-0.025em] text-[#FFFFFF]">
          {member.name}
        </h3>
        <p className="mt-1 text-[11.5px] text-[#8E8E93]">{member.role}</p>

        <div className="mt-auto flex items-end justify-between pt-5">
          <div>
            <p className="font-mono text-[8.5px] tracking-[0.18em] text-[#6E6E73]">READINESS</p>
            <p className="font-mono mt-1 text-[17px] leading-none tabular-nums text-[#FFFFFF]">
              {member.readiness}%
            </p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[#FFCC00] text-[#FFCC00] transition duration-300 group-hover:bg-[#FFCC00] group-hover:text-[#0B0B0C]">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2 8h11M8.5 3.5 13 8l-4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </button>
  );
}

const BENEFITS: [IconName, string, string][] = [
  [
    "heart",
    "Four domains, one workflow",
    "Radiation, musculoskeletal, vestibular and cardiovascular data move through the same upload, validate, analyse and report path.",
  ],
  [
    "database",
    "Open research data",
    "Work with prepared datasets from NASA OSDR, ICPSR and NASA RadLab, or bring your own CSV.",
  ],
  [
    "users",
    "Built for two audiences",
    "Researchers get technical depth. Astronauts get a simple view of what is available, when it was updated, and what is missing.",
  ],
  [
    "file",
    "Reports you can cite",
    "Every report records its dataset, population, model version, variables and limitations.",
  ],
];

const STEPS = [
  "Choose a prepared dataset, or upload a CSV.",
  "Validate variables, units and missing values against the model.",
  "Run the compatible analysis, then review the results.",
  "Generate a report with sources and limitations included.",
];

const SPECS: [string, string[]][] = [
  [
    "MYOSHIELD",
    [
      "Software only, no hardware",
      "CSV upload and dataset library",
      "Input validation before any run",
      "Per-domain model integration layer",
      "Exportable reports",
    ],
  ],
  [
    "Data you can use",
    [
      "NASA OSD-139, OSD-684",
      "ICPSR 235362, Apollo AP006",
      "NASA RadLab",
      "Your own CSV files",
      "Labelled simulated demos",
    ],
  ],
  [
    "Safeguards",
    [
      "Source shown on every dataset",
      "Missing data stays visible",
      "Populations never merged",
      "No invented health score",
      "Decision support, not diagnosis",
    ],
  ],
];

export default function Landing() {
  const { go } = useApp();

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-[#FFFFFF]">
      {/* ---- Mission bar ---- */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#0B0B0C]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 md:px-8">
          <button onClick={() => jump("top")} aria-label="MYOSHIELD home">
            <Logo size={19} />
          </button>
          <span className="hidden h-4 w-px bg-white/15 sm:block" />
          <p className="font-mono hidden items-center gap-2 text-[9.5px] tracking-[0.2em] text-[#8E8E93] sm:flex">
            <span className="text-[#FFCC00]">//</span>
            ORBITAL BIOMEDICAL TELEMETRY
          </p>

          <div className="ml-auto flex items-center gap-3">
            <ModelsPill />
            <button
              onClick={() => go("login")}
              className="font-bold-sans hidden rounded-full bg-[#FFCC00] px-4 py-2 text-[11.5px] tracking-[-0.01em] text-[#0B0B0C] transition hover:bg-[#FFD633] sm:inline-flex"
            >
              Launch demo
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="pt-14">
        {/* ---- Editorial hero ---- */}
        <section className="relative overflow-hidden border-b border-white/[0.08]">
          <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-14 md:px-8 md:pt-20">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <div>
                <p className="font-mono inline-flex items-center gap-2 text-[10px] tracking-[0.2em] text-[#8E8E93]">
                  <i className="live-dot h-1.5 w-1.5 rounded-full bg-[#35D6C0]" />
                  ISS EXPEDITION 74 · CREW TELEMETRY NOMINAL
                </p>
                <h1 className="font-bold-sans mt-5 text-[76px] leading-[0.78] tracking-[-0.06em] text-[#FFFFFF] sm:text-[112px] lg:text-[148px]">
                  Monitor
                </h1>
              </div>

              <div className="max-w-[430px] pb-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFCC00]">
                  The manifesto
                </p>
                <p className="mt-3 text-[14.5px] leading-[1.65] text-[#D6D6D9]">
                  MYOSHIELD runs existing, already-trained{" "}
                  <b className="font-bold text-[#FFFFFF]">.joblib</b> models across four
                  physiological domains, then fuses the outputs into one flight-surgeon-grade
                  readout. Every result shows its source, method and limits.
                </p>
                <button
                  onClick={() => go("login")}
                  className="font-bold-sans mt-5 inline-flex items-center gap-2 rounded-full bg-[#FFCC00] px-5 py-2.5 text-[12.5px] text-[#0B0B0C] transition hover:bg-[#FFD633]"
                >
                  Enter demo mode
                  <Icon name="arrow" size={13} />
                </button>
              </div>
            </div>

            <div className="relative mt-10 h-[420px] overflow-hidden border border-white/[0.08] md:h-[600px]">
              <img
                src={HERO_IMAGE}
                alt="Earth's limb and the Moon's horizon photographed from orbit"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0B0C] via-[#0B0B0C]/25 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0B0B0C]/55 via-transparent to-[#0B0B0C]/35" />

              <span className="font-mono absolute left-5 top-5 border border-white/20 bg-[#0B0B0C]/60 px-2.5 py-1.5 text-[9px] tracking-[0.18em] text-[#D6D6D9] backdrop-blur-sm">
                ORBITAL LIMB · 408 KM
              </span>
              <span className="font-mono absolute right-5 top-5 hidden border border-white/20 bg-[#0B0B0C]/60 px-2.5 py-1.5 text-[9px] tracking-[0.18em] text-[#D6D6D9] backdrop-blur-sm sm:block">
                OPTICAL PAYLOAD / 4 DOMAINS
              </span>

              <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div className="max-w-[440px]">
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#8E8E93]">
                      Five operators · four systems · one readout
                    </p>
                    <p className="mt-2 text-[13px] leading-[1.55] text-[#D6D6D9]">
                      Research-grade physiological intelligence for the people living beyond the
                      atmosphere.
                    </p>
                  </div>
                  <h2 className="font-bold-sans text-[54px] leading-[0.82] tracking-[-0.055em] text-[#FFFFFF] sm:text-[86px] lg:text-[112px]">
                    Beyond
                    <br />
                    Earth.
                  </h2>
                </div>
              </div>
            </div>

            <div className="relative -mt-9 flex justify-center">
              <button
                onClick={() => jump("crew")}
                className="group inline-flex flex-col items-center gap-2.5"
                aria-label="Explore crew telemetry"
              >
                <span className="grid h-[72px] w-[72px] place-items-center rounded-full border-2 border-[#FFCC00] bg-[#FFCC00] text-[#0B0B0C] shadow-[0_0_0_6px_#0B0B0C] transition duration-300 group-hover:bg-[#FFD633]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 4v15M5.5 12.5 12 19l6.5-6.5"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="font-mono pl-1 text-[9.5px] uppercase tracking-[0.2em] text-[#FFCC00]">
                  Explore Crew Telemetry
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ---- Crew roster ---- */}
        <section id="crew" className="border-b border-white/[0.08]">
          <div className="mx-auto max-w-[1500px] px-4 py-16 md:px-8 lg:py-20">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="font-mono flex items-center gap-2.5 text-[10px] uppercase tracking-[0.2em] text-[#FFCC00]">
                  <span aria-hidden className="inline-block h-px w-7 bg-[#FFCC00]/70" />
                  Crew roster · Expedition 74
                </p>
                <h2 className="font-bold-sans mt-4 max-w-[680px] text-[40px] leading-[0.92] tracking-[-0.045em] text-[#FFFFFF] md:text-[60px]">
                  Five operators. One telemetry grid.
                </h2>
              </div>
              <p className="max-w-[400px] text-[13.5px] leading-[1.6] text-[#8E8E93]">
                Each profile opens a personal control panel with live model outputs, domain risk
                gauges and the flight-surgeon AI. Vitals shown here are simulated.
              </p>
            </div>

            <div className="grid divide-x divide-y divide-white/[0.08] border border-white/[0.08] sm:grid-cols-2 lg:grid-cols-5">
              {CREW.map((member, i) => (
                <CrewTile key={member.id} member={member} index={i} />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="font-mono inline-flex items-center gap-1.5 border border-[#35D6C0]/35 bg-[#35D6C0]/8 px-3 py-1 text-[9px] uppercase tracking-[0.16em] text-[#35D6C0]">
                <i className="live-dot h-1.5 w-1.5 rounded-full bg-[#35D6C0]" />5 profiles synced
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#6E6E73]">
                Demonstration crew · simulated vitals · not a diagnostic system
              </span>
            </div>
          </div>
        </section>

        {/* ---- Data sources ---- */}
        <section className="border-b border-white/[0.08] px-4 py-8 md:px-8">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#6E6E73]">
              Built around open data sources
            </p>
            <div className="flex flex-wrap gap-2">
              {["NASA OSDR", "ICPSR", "NASA RadLab", "Apollo records", "Your CSV files"].map(
                (n) => (
                  <span
                    key={n}
                    className="font-mono border border-white/[0.08] px-3 py-1.5 text-[10px] text-[#D6D6D9]"
                  >
                    {n}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ---- Benefits ---- */}
        <section id="benefits" className="border-b border-white/[0.08] px-4 py-16 md:px-8 lg:py-20">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFCC00]">
                  Benefits
                </p>
                <h2 className="font-bold-sans mt-4 text-[40px] leading-[0.92] tracking-[-0.045em] text-[#FFFFFF] md:text-[54px]">
                  Research-grade, without the data overload.
                </h2>
              </div>
              <p className="self-end text-[14px] leading-[1.65] text-[#8E8E93] lg:max-w-[480px]">
                MYOSHIELD runs existing, already-trained models on the data you choose, and shows
                exactly where each result came from — no invented health scores.
              </p>
            </div>
            <div className="mt-10 grid gap-px bg-white/[0.08] md:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map(([icon, title, desc], i) => (
                <article key={title} className="flex flex-col bg-[#0B0B0C] p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center border border-[#FFCC00]/40 text-[#FFCC00]">
                      <Icon name={icon} size={19} />
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-[#6E6E73]">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="font-bold-sans mt-6 text-[19px] leading-[1.15] tracking-[-0.025em] text-[#FFFFFF]">
                    {title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-[1.6] text-[#8E8E93]">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Workflow ---- */}
        <section id="how" className="border-b border-white/[0.08] px-4 py-16 md:px-8 lg:py-20">
          <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFCC00]">
                Workflow
              </p>
              <h2 className="font-bold-sans mt-4 text-[40px] leading-[0.92] tracking-[-0.045em] text-[#FFFFFF] md:text-[54px]">
                See the big picture.
              </h2>
              <p className="mt-4 text-[14px] leading-[1.65] text-[#8E8E93]">
                MYOSHIELD turns datasets into clear, labelled visuals that show what is measured,
                what is modelled, and what is still missing.
              </p>
              <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-start gap-4 py-4">
                    <span className="font-mono text-[12px] tabular-nums text-[#FFCC00]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[13px] leading-[1.55] text-[#D6D6D9]">{s}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <button
                  onClick={() => jump("contact")}
                  className="font-bold-sans inline-flex items-center gap-2 border border-white/15 px-5 py-2.5 text-[12.5px] text-[#D6D6D9] transition hover:border-[#FFCC00]/60 hover:text-[#FFFFFF]"
                >
                  Try the workflow
                  <Icon name="arrow" size={13} />
                </button>
              </div>
            </div>

            <div className="hud-panel flex flex-col justify-between p-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6E6E73]">
                  Analysis pipeline
                </p>
                <div className="mt-5 space-y-5">
                  {[
                    ["01", "SELECT", "Library dataset or CSV uplink"],
                    ["02", "VALIDATE", "Column, unit and missing-value checks"],
                    ["03", "INFER", "4 domain models + fusion layer"],
                    ["04", "REPORT", "Source, model version, limitations"],
                  ].map(([n, label, detail]) => (
                    <div key={n}>
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-[10px] tracking-[0.16em] text-[#D6D6D9]">
                          <span className="mr-2 text-[#FFCC00]">{n}</span>
                          {label}
                        </span>
                        <span className="font-mono text-[9px] text-[#35D6C0]">100%</span>
                      </div>
                      <p className="font-mono ml-7 mt-1 text-[9.5px] text-[#6E6E73]">{detail}</p>
                      <div className="mt-2 ml-7 h-px bg-white/[0.08]">
                        <div className="h-px w-full bg-[#FFCC00]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="font-mono mt-6 border-t border-white/[0.08] pt-4 text-[9px] leading-[1.7] tracking-[0.12em] text-[#6E6E73]">
                Every run repeats real inference from the selected file · no value is invented
              </p>
            </div>
          </div>
        </section>

        {/* ---- Platform / specs ---- */}
        <section id="specs" className="border-b border-white/[0.08] px-4 py-16 md:px-8 lg:py-20">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col items-center text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFCC00]">
                Platform
              </p>
              <h2 className="font-bold-sans mt-4 text-[40px] leading-[0.92] tracking-[-0.045em] text-[#FFFFFF] md:text-[54px]">
                Why MYOSHIELD?
              </h2>
              <p className="mt-4 max-w-[560px] text-[14px] leading-[1.65] text-[#8E8E93]">
                It is software for research and decision support. It is not a medical device, and it
                never presents simulated values as astronaut measurements.
              </p>
            </div>

            <div className="mt-12 grid gap-px border border-white/[0.08] bg-white/[0.08] lg:grid-cols-3">
              {SPECS.map(([title, rows], i) => (
                <section key={title} className="flex flex-col bg-[#0B0B0C]">
                  <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-6">
                    <p className="font-bold-sans text-[16px] tracking-[-0.02em] text-[#FFFFFF]">
                      {title}
                    </p>
                    {i === 0 && (
                      <span className="font-mono border border-[#FFCC00]/40 px-2 py-0.5 text-[8.5px] uppercase tracking-[0.16em] text-[#FFCC00]">
                        Core
                      </span>
                    )}
                  </div>
                  {rows.map((r) => (
                    <div
                      key={r}
                      className="flex items-center gap-2.5 border-b border-white/[0.08] px-6 py-4 text-[12.5px] text-[#D6D6D9] last:border-b-0"
                    >
                      <Icon name="check" size={14} className="shrink-0 text-[#FFCC00]" />
                      {r}
                    </div>
                  ))}
                </section>
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <button
                onClick={() => go("login")}
                className="font-bold-sans inline-flex items-center gap-2 rounded-full bg-[#FFCC00] px-6 py-3 text-[13px] text-[#0B0B0C] transition hover:bg-[#FFD633]"
              >
                Open the demo
                <Icon name="arrow" size={13} />
              </button>
            </div>
          </div>
        </section>

        {/* ---- Principle ---- */}
        <section className="border-b border-white/[0.08] px-4 py-16 md:px-8">
          <div className="mx-auto grid max-w-[1500px] items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-bold-sans text-[24px] leading-[1.3] tracking-[-0.03em] text-[#FFFFFF] md:text-[34px]">
                “Model outputs are decision support, not diagnosis. Every result shows its source,
                its method, and its limits.”
              </p>
              <p className="font-mono mt-4 text-[9.5px] uppercase tracking-[0.2em] text-[#6E6E73]">
                Design principle · MYOSHIELD scientific rules
              </p>
            </div>
            <div className="hud-panel flex items-center gap-4 px-5 py-4">
              <Icon name="shield" size={22} className="text-[#FFCC00]" />
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#6E6E73]">
                  Safeguard status
                </p>
                <p className="font-mono mt-1 text-[11px] uppercase tracking-[0.14em] text-[#FFCC00]">
                  Provenance locked
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- CTA ---- */}
        <section id="contact" className="relative overflow-hidden border-b border-white/[0.08] px-4 py-20 text-center md:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 70% at 50% 100%, rgba(255,204,0,0.12), transparent 70%)",
            }}
          />
          <div className="relative mx-auto max-w-[760px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFCC00]">
              Demo mode
            </p>
            <h2 className="font-bold-sans mt-4 text-[44px] leading-[0.9] tracking-[-0.05em] text-[#FFFFFF] md:text-[64px]">
              Explore the platform.
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-[14px] leading-[1.65] text-[#8E8E93]">
              Explore as an astronaut, researcher or mission health specialist, with no account
              needed.
            </p>
            <span className="mt-8 inline-flex">
              <button
                onClick={() => go("login")}
                className="font-bold-sans inline-flex items-center gap-3 rounded-[2px] border border-[#FFCC00] bg-[#FFCC00] px-7 py-4 text-[14px] text-[#0B0B0C] transition hover:bg-[#FFD633]"
              >
                Enter demo mode
                <Icon name="arrow" size={14} />
              </button>
            </span>
            <p className="font-mono mt-8 text-[9px] uppercase tracking-[0.18em] text-[#6E6E73]">
              Research and decision-support software · not a clinically validated diagnostic system
            </p>
          </div>
        </section>
      </main>

      <footer className="px-4 py-8 md:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-end justify-between gap-4">
          <div>
            <Logo size={18} />
            <p className="font-mono mt-3 max-w-[440px] text-[9px] leading-[1.8] tracking-[0.1em] text-[#6E6E73]">
              Research and decision-support software. Not a clinically validated diagnostic system.
            </p>
          </div>
          <div className="font-mono flex flex-wrap gap-5 text-[9.5px] uppercase tracking-[0.16em] text-[#8E8E93]">
            {[
              ["Crew", "crew"],
              ["Benefits", "benefits"],
              ["Workflow", "how"],
              ["Platform", "specs"],
            ].map(([l, id]) => (
              <button key={id} onClick={() => jump(id)} className="transition hover:text-[#FFCC00]">
                {l}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
