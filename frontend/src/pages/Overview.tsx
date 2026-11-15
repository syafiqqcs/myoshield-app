import { useRef, useState } from "react";
import { useApp } from "../lib/store";
import { DOMAINS, fmtDate, type Domain } from "../lib/data";
import {
  DOMAIN_DISCLAIMERS,
  clockTime,
  domainStatusLabel,
  domainStatusTone,
  getDomainPrediction,
  relativeTime,
  riskPercent,
  shortDate,
  sourceTypeLabel,
} from "../lib/analysis";
import { Badge, Btn, Callout, Icon, PageTitle, type IconName } from "../components/ui";

const ICON: Record<Domain, IconName> = {
  radiation: "radiation",
  musculoskeletal: "dna",
  vestibular: "ear",
  cardiovascular: "heart",
};

/** Magnetic Hover Pill wrapper for the 4 Health Domain cards */
function MagneticDomainGrid({
  domains,
  datasets,
  analyses,
  onNavigate,
}: {
  domains: Domain[];
  datasets: ReturnType<typeof useApp>["datasets"];
  analyses: ReturnType<typeof useApp>["analyses"];
  onNavigate: (route: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const [pill, setPill] = useState({ x: 0, y: 0, w: 0, h: 0, on: false });
  const { latest } = useApp();
  const liveAt = latest ? new Date(latest.at) : null;
  const justNow = liveAt ? Date.now() - liveAt.getTime() < 90_000 : false;

  const show = (i: number) => {
    const w = wrap.current;
    const c = cards.current[i];
    if (!w || !c) return;
    const wr = w.getBoundingClientRect();
    const r = c.getBoundingClientRect();
    setPill({
      x: r.left - wr.left - 5,
      y: r.top - wr.top - 5,
      w: r.width + 10,
      h: r.height + 10,
      on: true,
    });
  };

  const hide = () => setPill((p) => ({ ...p, on: false }));

  return (
    <div ref={wrap} onMouseLeave={hide} className="relative grid gap-4 md:grid-cols-2">
      {/* Sliding telemetry highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-10 rounded-[2px]"
        style={{
          width: pill.w,
          height: pill.h,
          transform: `translate(${pill.x}px, ${pill.y}px) scale(${pill.on ? 1 : 0.98})`,
          opacity: pill.on ? 1 : 0,
          background: "rgba(255,204,0,0.045)",
          border: "1px solid rgba(255,204,0,0.55)",
          transition:
            "transform .28s ease, width .28s ease, height .28s ease, opacity .2s ease",
        }}
      />

      {domains.map((d, i) => {
        const meta = DOMAINS[d];
        const lib = datasets.filter((x) => x.domain === d);
        const a = analyses.find((x) => x.domain === d);
        const none = lib.length === 0;
        const prediction = getDomainPrediction(latest?.result, d);
        const status = prediction?.status ?? null;
        const anomaly = status === "ANOMALY_DETECTED";
        const pct = prediction ? riskPercent(prediction.risk_score) : null;
        const stateColor = anomaly
          ? "#F06464"
          : status === "ELEVATED"
            ? "#F5A623"
            : status === "NOMINAL"
              ? "#35D6C0"
              : "#6E6E73";
        const badgeLabel = status
          ? domainStatusLabel(status)
          : none
            ? "Data unavailable"
            : "Not analyzed";
        const badgeTone = status ? domainStatusTone(status) : none ? "warning" : "neutral";
        const updated = latest
          ? justNow
            ? "Just now"
            : relativeTime(latest.at)
          : a
            ? fmtDate(a.date)
            : "Not analyzed";

        return (
          <div
            key={d}
            ref={(el) => {
              cards.current[i] = el;
            }}
            onMouseEnter={() => show(i)}
            onMouseMove={() => show(i)}
            className="hud-panel hud-panel-hover group relative z-20 flex flex-col justify-between border border-white/[0.08] bg-[#121214] p-6"
            style={
              anomaly
                ? {
                    borderColor: "rgba(240,100,100,0.55)",
                  }
                : undefined
            }
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{ background: anomaly ? "#F06464" : "#FFCC00" }}
            />
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[2px] border"
                    style={{
                      borderColor: `${meta.color}55`,
                      background: `${meta.color}14`,
                      color: meta.color,
                    }}
                  >
                    <Icon name={ICON[d]} size={21} />
                  </span>
                  <div>
                    <h3 className="serif text-[25px] leading-none text-[#FFFFFF]">{meta.label}</h3>
                    <p className="mt-1 text-[12.5px] text-[#8E8E93]">{meta.blurb}</p>
                  </div>
                </div>
                <Badge tone={badgeTone} className={anomaly ? "animate-pulse" : ""}>
                  {badgeLabel}
                </Badge>
              </div>

              {/* Risk gauge */}
              <div className="mt-5">
                <div className="flex items-end justify-between gap-3">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-[#8E8E93]">
                    RISK SCORE
                  </p>
                  <p
                    className="font-mono text-[20px] leading-none tabular-nums"
                    style={{ color: stateColor }}
                  >
                    {pct === null ? "--" : pct}
                    <span className="ml-0.5 text-[11px] text-[#8E8E93]">%</span>
                  </p>
                </div>
                <div className="gauge-track mt-2 h-[6px] w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${pct ?? 0}%`,
                      background: stateColor,
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[rgba(255,255,255,0.08)] pt-4 text-[13px]">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em] text-[#8E8E93]">
                    AVAILABILITY
                  </p>
                  <p className="mt-1 font-medium text-[#FFFFFF]">
                    {prediction
                      ? "Live dataset analyzed"
                      : none
                        ? "Data unavailable"
                        : "Not analyzed"}
                  </p>
                  {prediction && (
                    <p className="mt-1 text-[11.5px] text-[#8E8E93]">
                      Live • {prediction.key_metric}
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em] text-[#8E8E93]">
                    LAST UPDATED
                  </p>
                  <p className="font-mono mt-1 tabular-nums text-[#FFFFFF]">
                    {latest ? `${updated} • ${shortDate(latest.at)}` : updated}
                  </p>
                  {latest && (
                    <p className="font-mono mt-1 text-[11.5px] tabular-nums text-[#8E8E93]">
                      at {clockTime(latest.at)}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="font-mono text-[10px] tracking-[0.1em] text-[#8E8E93]">DATA TYPE</p>
                  <p className="mt-1 break-all font-medium text-[#FFFFFF]">
                    {latest && prediction ? latest.sourceName : "—"}
                  </p>
                  {latest && prediction && (
                    <p className="mt-1 text-[11.5px] text-[#8E8E93]">
                      {sourceTypeLabel(latest)} · {latest.result.interaction_type}
                    </p>
                  )}
                  {a?.mode === "simulated" && (
                    <Badge tone="sim" className="mt-1">
                      SIMULATED
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-[2px] border border-white/[0.08] bg-[#0E0E10] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#FFCC00]">
                  What this means
                </p>
                <p
                  className={`mt-1 text-[12.5px] leading-[1.5] ${
                    prediction ? "text-[#EDEDEF]" : "text-[#8E8E93]"
                  }`}
                >
                  {prediction?.summary ??
                    "No model has scored this domain yet. Upload a CSV or choose a prepared dataset in Start new analysis."}
                </p>
                <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] leading-[1.45] text-[#6E6E73]">
                  {DOMAIN_DISCLAIMERS[d]}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => onNavigate(meta.route)}
                className="font-mono inline-flex items-center gap-2 rounded-[2px] border border-[#FFCC00]/50 bg-[#FFCC00]/8 px-3.5 py-2 text-[9.5px] uppercase tracking-[0.14em] text-[#FFCC00] transition hover:border-[#FFCC00] hover:bg-[#FFCC00]/15"
              >
                View detailed analysis <Icon name="arrow" size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Overview() {
  const { role, go, datasets, analyses, reports, subjects, subjectId, settings, openReport } =
    useApp();
  const simple = role === "Astronaut";
  const subj = subjects.find((s) => s.id === subjectId);
  const last = analyses[0];
  const uploaded = datasets.filter((d) => d.origin === "User upload");
  const myReports = simple ? reports.filter((r) => r.sharedWithAstronaut) : reports;
  const domainKeys = Object.keys(DOMAINS) as Domain[];

  return (
    <div className="rise">
      <PageTitle
        kicker={`${role?.toUpperCase()} VIEW`}
        title={`Welcome${settings.displayName ? `, ${settings.displayName}` : ""}.`}
        desc={
          simple
            ? "Your available health information, how recent it is, and what is missing."
            : "A summary of available data and analyses across the four health domains."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" icon="file" onClick={() => openReport({ subjectId })}>
              Generate Report
            </Btn>
            {(!simple || settings.allowAstronautUploads) && (
              <Btn icon="play" onClick={() => go("analysis")}>
                Start New Analysis
              </Btn>
            )}
          </div>
        }
      />

      {/* Top summary metrics */}
      <div className="mb-5 grid gap-0 overflow-hidden border border-white/[0.08] bg-[#121214] md:grid-cols-3 md:divide-x md:divide-white/[0.08]">
        {[
          ["Selected subject", subj ? `${subj.id}` : "None", subj?.type ?? ""],
          [
            "Current data source",
            subj?.type === "Demonstration subject"
              ? "Simulated demonstration"
              : (subj?.study ?? ""),
            "Always shown with results",
          ],
          [
            "Last analysis",
            last ? fmtDate(last.date) : "Not analyzed",
            last
              ? `${last.id}${last.mode === "simulated" ? " · simulated" : ""}`
              : "Run an analysis to begin",
          ],
        ].map(([k, v, s], i) => (
          <div
            key={k}
            className="relative overflow-hidden bg-transparent p-5 transition-colors hover:bg-white/[0.02]"
          >
            <span className="absolute inset-x-0 top-0 h-[2px] bg-[#FFCC00]" />
            <div className="flex items-start justify-between gap-2">
              <p className="kicker">{k}</p>
              <span className="font-mono text-[9px] tabular-nums text-[#6E6E73]">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="font-mono mt-2 text-[24px] leading-none tabular-nums text-[#FFFFFF]">
              {v}
            </p>
            <p className="mt-2 text-[13px] text-[#8E8E93]">{s}</p>
          </div>
        ))}
      </div>

      {/* 4 Health Domains with Magnetic Hover Pill */}
      <MagneticDomainGrid
        domains={domainKeys}
        datasets={datasets}
        analyses={analyses}
        onNavigate={(r) => go(r as never)}
      />

      {/* Integrated Health Overview Table */}
      <div className="mt-6 rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="kicker mb-2">FUSION SUMMARY</p>
            <h2 className="serif text-[30px] leading-none text-[#FFFFFF]">
              Integrated health overview
            </h2>
          </div>
          <Badge>{domainKeys.length} DOMAINS TRACKED</Badge>
        </div>
        <p className="mt-2 max-w-[720px] text-[14px] leading-[1.45] text-[#8E8E93]">
          Findings are listed per domain. No overall health score is computed, and the absence of a
          warning is not a statement that someone is healthy.
        </p>
        <div className="mt-5 overflow-x-auto rounded-[2px] border border-white/[0.08] bg-[#0E0E10]">
          <table className="tbl">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Data availability</th>
                <th>Latest analysis</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {domainKeys.map((d) => {
                const a = analyses.find((x) => x.domain === d);
                const n = datasets.filter((x) => x.domain === d).length;
                return (
                  <tr key={d}>
                    <td className="font-medium text-[#FFFFFF]">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: DOMAINS[d].color }}
                      />
                      {DOMAINS[d].short}
                    </td>
                    <td>{n ? `${n} dataset(s)` : "Data unavailable"}</td>
                    <td>{a ? `${a.modelName}` : "Not analyzed"}</td>
                    <td>
                      {a ? (
                        <Badge tone={a.mode === "simulated" ? "sim" : "real"}>
                          {a.mode === "simulated" ? "Simulated demo" : "Descriptive stats"}
                        </Badge>
                      ) : (
                        <Badge>Not analyzed</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom 3 Activity Cards */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="hud-panel hud-panel-hover rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
          <h3 className="serif text-[24px] leading-none text-[#FFFFFF]">Recent analyses</h3>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {analyses.slice(0, 4).map((a) => (
              <li key={a.id} className="py-3 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[#FFFFFF]">{a.modelName}</b>
                  {a.mode === "simulated" && <Badge tone="sim">SIM</Badge>}
                </div>
                <p className="font-mono text-[11.5px] tabular-nums text-[#8E8E93]">
                  {a.datasetId} · {fmtDate(a.date)}
                </p>
              </li>
            ))}
            {!analyses.length && <li className="py-3 text-[13px] text-[#8E8E93]">Not analyzed.</li>}
          </ul>
        </div>

        {!simple && (
          <div className="hud-panel hud-panel-hover rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
            <h3 className="serif text-[24px] leading-none text-[#FFFFFF]">
              Recent uploaded datasets
            </h3>
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {uploaded.slice(0, 4).map((d) => (
                <li key={d.id} className="py-3 text-[13px]">
                  <b className="text-[#FFFFFF]">{d.uploaded?.fileName}</b>
                  <p className="text-[#8E8E93]">
                    {DOMAINS[d.domain].short} · {d.records}
                  </p>
                </li>
              ))}
              {!uploaded.length && (
                <li className="py-3 text-[13px] text-[#8E8E93]">No uploads yet.</li>
              )}
            </ul>
            <Btn
              small
              variant="outline"
              className="mt-2"
              onClick={() => go("analysis")}
              icon="upload"
            >
              Upload CSV
            </Btn>
          </div>
        )}

        <div className="hud-panel hud-panel-hover rounded-[2px] border border-white/[0.08] bg-[#121214] p-6">
          <h3 className="serif text-[24px] leading-none text-[#FFFFFF]">
            {simple ? "Reports shared with you" : "Recent reports"}
          </h3>
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {myReports.slice(0, 4).map((r) => (
              <li key={r.id} className="py-3 text-[13px]">
                <button
                  className="font-bold-sans text-left text-[#FFFFFF] transition hover:text-[#FFCC00]"
                  onClick={() => go("reports", { reportId: r.id })}
                >
                  {r.title}
                </button>
                <p className="font-mono text-[11.5px] tabular-nums text-[#8E8E93]">
                  {fmtDate(r.date)}
                </p>
              </li>
            ))}
            {!myReports.length && (
              <li className="py-3 text-[13px] text-[#8E8E93]">
                {simple ? "No reports have been shared with you yet." : "No reports yet."}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <Callout tone="warn" title="Missing data">
          <ul className="list-disc pl-4">
            <li>
              Cardiovascular and respiratory: no prepared research dataset. Upload a compatible CSV
              or view a labelled simulation.
            </li>
            <li>Radiation: environmental data only. Personal absorbed dose is unavailable.</li>
            {simple && <li>Technical analysis details are available to your health specialist.</li>}
          </ul>
        </Callout>
      </div>
    </div>
  );
}
