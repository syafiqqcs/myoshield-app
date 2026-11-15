import { useMemo, useState, type ReactNode } from "react";
import { isCriticalAnalysis, useApp } from "../lib/store";
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
import {
  DOMAINS,
  MODELS,
  UNITS,
  fmtDate,
  rng,
  simSeries,
  type Analysis,
  type Dataset,
  type Domain,
} from "../lib/data";
import {
  Badge,
  BarChart,
  Btn,
  Callout,
  Card,
  ChartCard,
  Empty,
  Heatmap,
  Histogram,
  Icon,
  LineChart,
  PageTitle,
  Scatter,
  SimBanner,
  Tabs,
  type IconName,
} from "../components/ui";

const LIMITS = DOMAIN_DISCLAIMERS;

/** Editorial section titles used by the four domain pages. */
const SECTION_TITLE: Record<Domain, string> = {
  radiation: "Radiation Monitoring.",
  musculoskeletal: "Musculoskeletal Health.",
  vestibular: "Vestibular Health.",
  cardiovascular: "Cardiovascular and Respiratory.",
};

function useDomain(domain: Domain) {
  const { datasets, analyses } = useApp();
  const list = datasets.filter((d) => d.domain === domain);
  const [selId, setSelId] = useState("");
  const ds =
    list.find((d) => d.id === selId) ??
    list.find((d) => d.origin === "Research dataset") ??
    list[0];
  const real = analyses.find(
    (a) => a.domain === domain && a.mode === "uploaded" && (!ds || a.datasetId === ds.id),
  );
  const history = analyses.filter((a) => a.domain === domain);
  return { list, selId: ds?.id ?? "", setSelId, ds, real, history };
}

function Frame({
  domain,
  children,
  ctx,
  showSim,
  setShowSim,
  extra,
}: {
  domain: Domain;
  children: ReactNode;
  ctx: ReturnType<typeof useDomain>;
  showSim: boolean;
  setShowSim: (b: boolean) => void;
  extra?: ReactNode;
}) {
  const { go } = useApp();
  const m = DOMAINS[domain];
  const { ds } = ctx;
  return (
    <div className="rise">
      <PageTitle
        kicker={`${m.short.toUpperCase()} // DOMAIN MONITOR`}
        title={SECTION_TITLE[domain]}
        desc={m.blurb}
        actions={
          <>
            <Btn variant="outline" icon="upload" onClick={() => go("analysis")}>
              Upload data
            </Btn>
            <Btn icon="play" onClick={() => go("analysis", ds ? { datasetId: ds.id } : undefined)}>
              Run analysis
            </Btn>
          </>
        }
      />
      <Callout tone="warn" title="Interpret with care">
        {LIMITS[domain]}
      </Callout>
      <Card className="mt-4 p-5">
        <div className="grid gap-4 md:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="font-mono mb-1.5 text-[10.5px] tracking-[0.12em] text-[#FFCC00]">
              DATASET
            </p>
            <select
              className="input"
              value={ctx.selId}
              onChange={(e) => {
                ctx.setSelId(e.target.value);
                setShowSim(false);
              }}
              aria-label="Dataset"
            >
              {ctx.list.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id}
                </option>
              ))}
              {!ctx.list.length && <option>No dataset available</option>}
            </select>
            {extra}
          </div>
          {ds ? (
            <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
              {[
                ["Source", ds.source],
                ["Population", ds.population],
                ["Origin", ds.origin],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] text-muted">{k.toUpperCase()}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div className="sm:col-span-3">
                <dt className="font-mono text-[10px] text-muted">LIMITATION</dt>
                <dd>{ds.limitation}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-[13px] text-muted">No dataset selected.</p>
          )}
        </div>
      </Card>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {ctx.real ? (
          <Badge tone="real">Showing your uploaded analysis {ctx.real.id}</Badge>
        ) : showSim ? (
          <Badge tone="sim">SIMULATED DEMONSTRATION</Badge>
        ) : (
          <Badge>Not analyzed</Badge>
        )}
        {!ctx.real && (
          <Btn small variant={showSim ? "soft" : "outline"} onClick={() => setShowSim(!showSim)}>
            {showSim ? "Hide simulated demonstration" : "Show simulated demonstration"}
          </Btn>
        )}
      </div>
      <div className="mt-4 space-y-4">
        <DomainDetail domain={domain} />
        {children}
      </div>
      <Card className="mt-6 p-6">
        <h3 className="serif text-[24px]">Previous analyses</h3>
        {ctx.history.length ? (
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th>ID</th>
                <th>Model</th>
                <th>Dataset</th>
                <th>Date</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {ctx.history.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>{a.modelName}</td>
                  <td>{a.datasetId}</td>
                  <td>{fmtDate(a.date)}</td>
                  <td>
                    {a.mode === "simulated" ? (
                      <Badge tone="sim">Simulated</Badge>
                    ) : (
                      <Badge tone="real">Descriptive</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-[13px] text-muted">Not analyzed.</p>
        )}
      </Card>
    </div>
  );
}

const src = (ctx: ReturnType<typeof useDomain>, sim: boolean) =>
  ctx.real
    ? `Uploaded file ${ctx.ds?.uploaded?.fileName ?? ""}`
    : sim
      ? "Simulated demonstration, not from the named dataset"
      : "";
const lineFor = (a: Analysis | undefined, col: string) =>
  a?.series?.find((s) => s.col === col)?.points;

function Quality({ ctx, sim }: { ctx: ReturnType<typeof useDomain>; sim: boolean }) {
  const a = ctx.real;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="serif text-[22px] text-[#FFFFFF]">Data quality and analysis summary</h3>
        <Badge tone={a ? "real" : "neutral"}>{a ? "MEASURED" : "NO DATA"}</Badge>
      </div>
      {a ? (
        <div className="mt-3 overflow-x-auto">
          <table className="tbl mt-0 tabular-nums">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Unit</th>
                <th>N</th>
                <th>Missing</th>
                <th>Min</th>
                <th>Mean</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {a.stats.map((s) => (
                <tr key={s.col}>
                  <td className="text-[#FFFFFF]">{s.col}</td>
                  <td>{s.unit}</td>
                  <td>{s.n}</td>
                  <td className={s.missing ? "text-[#F5A623]" : ""}>{s.missing}</td>
                  <td>{s.min?.toFixed(3)}</td>
                  <td>{s.mean?.toFixed(3)}</td>
                  <td>{s.max?.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-[#8E8E93]">
          {sim
            ? "Simulated view: no data quality statistics exist because no real data are loaded."
            : "Data unavailable. Run an analysis to see quality statistics."}
        </p>
      )}
      <p className="font-mono mt-3 text-[10.5px] leading-[1.5] text-[#6E6E73]">
        Model: {MODELS.find((m) => m.domain === ctx.ds?.domain)?.name ?? "—"} · Version: not
        connected · Anomaly indicators require a connected model.
      </p>
    </Card>
  );
}

const INTERACTION_TEXT: Record<string, string> = {
  SYNERGISTIC: "Synergistic strain detected",
  ANTAGONISTIC: "Antagonistic interaction",
  ADDITIVE: "Additive interaction",
};

const DOMAIN_ICON: Record<Domain, IconName> = {
  radiation: "radiation",
  musculoskeletal: "dna",
  vestibular: "ear",
  cardiovascular: "heart",
};

/**
 * The 3–4 readings a domain's detailed view always shows. When the live .joblib
 * result carries `sub_metrics` those values win; otherwise the labels still
 * render with a dash so the view is never generic or cross-domain.
 */
const DOMAIN_METRIC_SPEC: Record<Domain, { label: string; unit: string }[]> = {
  radiation: [
    { label: "Absorbed Dose Rate", unit: "mSv/day" },
    { label: "Cumulative Mission Dose", unit: "mSv" },
    { label: "GCR : SPE Flux Ratio", unit: "chronic:acute" },
    { label: "ISS Module Shielding", unit: "factor" },
  ],
  musculoskeletal: [
    { label: "Transcriptional Stress / Atrophy Risk", unit: "%" },
    { label: "Peak Isometric Force Retention", unit: "%" },
    { label: "Bone Mineral Density Drift", unit: "% / month" },
    { label: "EMG Fatigue Index", unit: "index" },
  ],
  vestibular: [
    { label: "VOR Gain", unit: "0.95 nominal" },
    { label: "Otolith Tilt Asymmetry", unit: "deg" },
    { label: "Eye-Head Gaze Latency", unit: "ms" },
    { label: "Spatial Disorientation Score", unit: "0–10" },
  ],
  cardiovascular: [
    { label: "Heart Rate", unit: "bpm" },
    { label: "Blood Oxygen Saturation", unit: "SpO₂ %" },
    { label: "Heart Rate Variability", unit: "RMSSD ms" },
    { label: "Orthostatic / Fluid-Shift Index", unit: "index" },
  ],
};

/** Educational fallback shown before any live result exists. Domain-specific only. */
const DOMAIN_DETAIL_FALLBACK: Record<Domain, { explanation: string; countermeasures: string[] }> = {
  radiation: {
    explanation:
      "Ionizing radiation deposits energy along charged-particle tracks, producing clustered DNA double-strand breaks and reactive oxygen species that outpace cellular repair. Because repair capacity is already committed to microgravity and confinement stress, radiation injury compounds that cross-stressor oxidative fatigue.",
    countermeasures: [
      "Relocate to high-density polyethylene/water-shielded Service Module quarters during SAA passes and SPE alerts.",
      "Sync the personal dosimeter badge and log cumulative mission dose after every relocation.",
      "Time-shift EVA and high-exposure tasks away from SAA transits and SPE windows.",
    ],
  },
  musculoskeletal: {
    explanation:
      "Microgravity removes the mechanical load that slow-twitch postural fibres and the lumbar paraspinal extensor chain normally carry, so muscle protein synthesis falls and the transcriptional atrophy program turns up while bone resorption outpaces formation.",
    countermeasures: [
      "Adjust ARED resistive squat/deadlift loads and add lumbar paraspinal and calf loading sets.",
      "Run the protein, vitamin D and calcium protocol to support bone formation.",
      "Increase lower-body negative-pressure or bungee loading time to restore axial load.",
    ],
  },
  vestibular: {
    explanation:
      "In weightlessness the otolith organs no longer report a stable gravitational vector, so canal and otolith inputs conflict and gaze stabilisation degrades. When VOR gain falls below its ~0.95 nominal, retinal slip and gaze latency rise and spatial disorientation follows.",
    countermeasures: [
      "Run VOR x1/x2 gaze-stabilisation drills against a fixed target.",
      "Anchor to a stable visual horizon and a handrail before releasing or exiting the airlock.",
      "Avoid rapid pitch/roll head turns and keep head movements slow during translation.",
    ],
  },
  cardiovascular: {
    explanation:
      "Cephalad fluid shift moves blood and interstitial fluid toward the head, and the body compensates by reducing plasma volume, so preload and stroke volume fall. Combined with aerobic deconditioning, orthostatic tolerance drops while heart rate climbs and HRV (RMSSD) falls.",
    countermeasures: [
      "Schedule CEVIS cycle ergometer and T2 treadmill protocols to protect aerobic capacity.",
      "Use fluid-loading with electrolytes before re-entry and stand tests to counter plasma volume loss.",
      "Monitor pulse-ox and heart rate continuously during exercise and post-EVA recovery.",
    ],
  },
};

/** Single-domain live status card. Never renders another domain's data. */
function DomainStatusCard({ domain }: { domain: Domain }) {
  const { latest } = useApp();
  const result = latest?.result;
  const prediction = getDomainPrediction(result, domain);
  const score = prediction?.risk_score ?? null;
  const status = prediction?.status ?? null;
  const anomaly = status === "ANOMALY_DETECTED";
  const stateColor = anomaly
    ? "#F06464"
    : status === "ELEVATED"
      ? "#F5A623"
      : status === "NOMINAL"
        ? "#35D6C0"
        : "#6E6E73";
  const sourceLabel = sourceTypeLabel(latest);
  const modelCount = result ? Object.keys(result.module_details ?? {}).length : 0;
  const meta = DOMAINS[domain];
  const pct = score !== null ? riskPercent(score) : null;
  const critical = result && score !== null && isCriticalAnalysis(result) && score >= 0.66;

  return (
    <div
      className="hud-panel hud-panel-hover relative flex flex-col overflow-hidden rounded-[2px] border border-white/[0.08] bg-[#121214] p-5"
      style={{
        borderColor: anomaly ? "rgba(240,100,100,0.55)" : result ? `${stateColor}55` : undefined,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[2px] border"
            style={{
              borderColor: `${meta.color}55`,
              background: `${meta.color}1A`,
              color: meta.color,
            }}
          >
            <Icon name={DOMAIN_ICON[domain]} size={18} />
          </span>
          <div>
            <p className="font-mono text-[9.5px] tracking-[0.18em]" style={{ color: meta.color }}>
              {meta.short.toUpperCase()} // LIVE STATUS
            </p>
            <h3 className="serif text-[21px] leading-tight text-[#FFFFFF]">{meta.label}</h3>
          </div>
        </div>
        <Badge
          tone={status ? domainStatusTone(status) : "neutral"}
          className={anomaly ? "animate-pulse" : ""}
        >
          {status ? domainStatusLabel(status) : "Awaiting analysis"}
        </Badge>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#8E8E93]">RISK SCORE</p>
          <p
            className="font-mono text-[24px] leading-none tabular-nums"
            style={{
              color: stateColor,
              textShadow: anomaly ? `0 0 14px ${stateColor}66` : undefined,
            }}
          >
            {pct === null ? "--" : pct}
            <span className="ml-0.5 text-[12px] text-[#8E8E93]">%</span>
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
        <div className="font-mono mt-2 flex justify-between text-[9px] tracking-[0.14em] text-[#6E6E73]">
          <span>NOMINAL</span>
          <span>ELEVATED 60</span>
          <span>ANOMALY 66</span>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-px border border-white/[0.08] bg-white/[0.08] text-[13px] sm:grid-cols-2">
        <div className="bg-[#121214] p-4">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8E8E93]">
            Availability
          </dt>
          <dd className="mt-1.5">
            {latest && prediction ? (
              <>
                <b className="flex items-center gap-1.5 text-[#FFFFFF]">
                  <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[#35D6C0]" />
                  Live dataset analyzed
                </b>
                <span className="block text-[11.5px] text-[#8E8E93]">
                  Live • {prediction.key_metric}
                </span>
              </>
            ) : (
              <span className="text-[#8E8E93]">Data unavailable</span>
            )}
          </dd>
        </div>
        <div className="bg-[#121214] p-4">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8E8E93]">
            Last updated
          </dt>
          <dd className="mt-1.5">
            {latest ? (
              <>
                <b className="font-mono tabular-nums text-[#FFFFFF]">
                  {relativeTime(latest.at)} • {shortDate(latest.at)}
                </b>
                <span className="block font-mono text-[11.5px] tabular-nums text-[#8E8E93]">
                  at {clockTime(latest.at)}
                </span>
              </>
            ) : (
              <span className="text-[#8E8E93]">Not analyzed</span>
            )}
          </dd>
        </div>
        <div className="bg-[#121214] p-4 sm:col-span-2">
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8E8E93]">
            Data type
          </dt>
          <dd className="mt-1.5">
            {latest && prediction ? (
              <>
                <b className="break-all text-[#FFFFFF]">{latest.sourceName}</b>
                <span className="block text-[11.5px] leading-[1.45] text-[#8E8E93]">
                  {sourceLabel} ·{" "}
                  {INTERACTION_TEXT[result?.interaction_type ?? ""] ??
                    result?.interaction_type ??
                    "—"}{" "}
                  · {modelCount ? `${modelCount} domain ` : ""}.joblib model
                  {modelCount === 1 ? "" : "s"} + fusion
                </span>
              </>
            ) : (
              <span className="text-[#8E8E93]">—</span>
            )}
          </dd>
        </div>
      </dl>

      <div
        className="mt-4 rounded-[2px] border p-3.5"
        style={{
          borderColor: `${meta.color}33`,
          background: "#0E0E10",
        }}
      >
        <p className="font-mono text-[10px] tracking-[0.12em]" style={{ color: meta.color }}>
          WHAT THIS MEANS
        </p>
        <p
          className={`mt-1 text-[12.5px] leading-[1.55] ${
            prediction ? "text-[#EDEDEF]" : "text-[#8E8E93]"
          }`}
        >
          {prediction?.summary ??
            "No model has scored this domain yet. Upload a CSV or choose a prepared dataset in Start new analysis."}
        </p>
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11.5px] leading-[1.45] text-[#6E6E73]">
          {LIMITS[domain]}
        </p>
        {critical && (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-bold text-[#F06464]">
            <Icon name="alert" size={12} />
            Critical result: the rescue protocol opened automatically for review.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Deeply domain-specific "Detailed Analysis" breakdown built from
 * `analysisResult.domains[domain]`. Shows only this physiological system's
 * sub-metrics, clinical explanation and countermeasures.
 */
function DomainDetail({ domain }: { domain: Domain }) {
  const { latest } = useApp();
  const prediction = getDomainPrediction(latest?.result, domain);
  const meta = DOMAINS[domain];
  const status = prediction?.status ?? null;

  const liveMetrics = prediction?.sub_metrics ?? [];
  const metrics = DOMAIN_METRIC_SPEC[domain].map(
    (spec) => liveMetrics.find((m) => m.label === spec.label) ?? { ...spec, value: "—" as string },
  );

  const fallback = DOMAIN_DETAIL_FALLBACK[domain];
  const explanation = prediction?.clinical_explanation ?? fallback.explanation;
  const countermeasures = prediction?.countermeasures?.length
    ? prediction.countermeasures
    : fallback.countermeasures;
  const riskPct = prediction ? riskPercent(prediction.risk_score) : null;
  const riskTone = !prediction
    ? "#6E6E73"
    : prediction.status === "ANOMALY_DETECTED"
      ? "#F06464"
      : prediction.status === "ELEVATED"
        ? "#F5A623"
        : "#35D6C0";

  return (
    <Card className="overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[2px] border"
            style={{
              borderColor: `${meta.color}55`,
              background: `${meta.color}14`,
              color: meta.color,
              boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.08)`,
            }}
          >
            <Icon name={DOMAIN_ICON[domain]} size={20} />
          </span>
          <div>
            <p className="kicker" style={{ color: meta.color }}>
              {meta.label.toUpperCase()} · DETAILED ANALYSIS
            </p>
            <h3 className="serif text-[24px] leading-none text-[#FFFFFF]">
              {meta.label} breakdown
            </h3>
          </div>
        </div>
        <Badge tone={status ? domainStatusTone(status) : "neutral"}>
          {status ? domainStatusLabel(status) : "Awaiting analysis"}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#8E8E93]">
            RISK SCORE · .JOBLIB OUTPUT
          </p>
          <p
            className="font-mono text-[18px] leading-none tabular-nums"
            style={{ color: riskTone }}
          >
            {riskPct === null ? "--" : riskPct}
            <span className="ml-0.5 text-[11px] text-[#8E8E93]">%</span>
          </p>
        </div>
        <div className="gauge-track mt-2 h-[6px] w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${riskPct ?? 0}%`,
              background: riskTone,
            }}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-px border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <div key={m.label} className="relative overflow-hidden bg-[#121214] p-4">
            <span
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  m.value === "—"
                    ? "rgba(255,255,255,0.1)"
                    : i === 0
                      ? "#FFCC00"
                      : "rgba(255,204,0,0.35)",
              }}
            />
            <div className="flex items-start justify-between gap-2 pt-1">
              <p className="font-mono text-[9.5px] uppercase leading-[1.4] tracking-[0.14em] text-[#8E8E93]">
                {m.label}
              </p>
              <span className="font-mono text-[9px] tabular-nums text-[#6E6E73]">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p
              className="font-mono mt-3 text-[24px] leading-none tabular-nums"
              style={{ color: m.value === "—" ? "#6E6E73" : "#FFFFFF" }}
            >
              {m.value}
              {m.unit && <span className="ml-1.5 text-[11px] text-[#8E8E93]">{m.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="hud-panel rounded-[2px] border border-white/[0.08] bg-[#121214] p-4">
          <p className="font-mono flex items-center gap-1.5 text-[10px] tracking-[0.12em] text-[#8E8E93]">
            <Icon name="info" size={12} className="text-[#4DA3FF]" />
            CLINICAL INSIGHT
          </p>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[#D6D6D9]">{explanation}</p>
        </div>
        <div className="hud-panel rounded-[2px] border border-white/[0.08] bg-[#121214] p-4">
          <p className="font-mono text-[10px] tracking-[0.12em]" style={{ color: meta.color }}>
            {meta.short.toUpperCase()} COUNTERMEASURES
          </p>
          <ul className="mt-2.5 space-y-2">
            {countermeasures.map((c) => (
              <li key={c} className="flex gap-2 text-[13px] leading-[1.5] text-[#D6D6D9]">
                <Icon name="check" size={14} className="mt-0.5 shrink-0 text-[#FFCC00]" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="font-mono mt-3 break-words text-[10.5px] leading-[1.5] tabular-nums text-[#6E6E73]">
        {prediction
          ? `Live .joblib output for ${meta.short} · ${prediction.model_used ?? "model pending"} · risk score ${prediction.risk_score.toFixed(3)}`
          : `No live ${meta.short} result yet · upload or select a prepared dataset in Start new analysis.`}
      </p>
    </Card>
  );
}

function Simple({ domain, ctx }: { domain: Domain; ctx: ReturnType<typeof useDomain> }) {
  return (
    <div className="rise">
      <PageTitle
        kicker={`YOUR DATA // ${DOMAINS[domain].short.toUpperCase()}`}
        title={SECTION_TITLE[domain]}
        desc={`Live status and detailed analysis for ${DOMAINS[domain].label} after your latest analysis.`}
      />
      <div className="space-y-4">
        <DomainStatusCard domain={domain} />
        <DomainDetail domain={domain} />
      </div>
      {ctx.real?.series?.[0] && (
        <div className="mt-4">
          <ChartCard
            title={`${ctx.real.series[0].col} over time`}
            source={src(ctx, false)}
            yLabel={ctx.real.series[0].col}
            xLabel="Index or time"
          >
            <LineChart
              series={[
                {
                  name: ctx.real.series[0].col,
                  color: DOMAINS[domain].color,
                  points: ctx.real.series[0].points,
                },
              ]}
              xLabel="Index or time"
              yLabel={ctx.real.series[0].col}
            />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ranges(pts: [number, number][], r: string) {
  return r === "all" ? pts : pts.slice(Math.floor(pts.length * (r === "half" ? 0.5 : 0.75)));
}

export function Radiation() {
  const { role } = useApp();
  const ctx = useDomain("radiation");
  const [sim, setSim] = useState(false);
  const [range, setRange] = useState("all");
  if (role === "Astronaut") return <Simple domain="radiation" ctx={ctx} />;
  const c = DOMAINS.radiation.color;
  const pts = ctx.real
    ? lineFor(ctx.real, "radiation_measurement")
    : sim
      ? simSeries(11, 96, 0.5, 0.08, 0.06, 0.001)
      : undefined;
  const shown = pts ? ranges(pts, range) : undefined;
  const trend =
    shown && shown.length > 4
      ? shown.map((p, i) => {
          const w = shown.slice(Math.max(0, i - 5), i + 1);
          return [p[0], w.reduce((s, q) => s + q[1], 0) / w.length] as [number, number];
        })
      : undefined;
  return (
    <Frame domain="radiation" ctx={ctx} showSim={sim} setShowSim={setSim}>
      <Callout tone="error" title="Environmental telemetry is not personal dose">
        Nothing on this page estimates an individual astronaut's absorbed dose.
      </Callout>
      {shown ? (
        <>
          {!ctx.real && <SimBanner />}
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10.5px] text-muted">TIME RANGE</span>
            <Tabs
              value={range}
              onChange={setRange}
              items={[
                { id: "all", label: "All" },
                { id: "half", label: "Last 50%" },
                { id: "quarter", label: "Last 25%" },
              ]}
            />
          </div>
          <ChartCard
            title="Radiation measurement over time"
            source={src(ctx, sim)}
            sim={!ctx.real}
            xLabel="Time index"
            yLabel="Environmental measurement"
            unit={ctx.real ? "source unit" : "arbitrary units"}
            legend={[
              { name: "Measurement", color: c },
              { name: "Moving average (6)", color: "#FFCC00" },
            ]}
          >
            <LineChart
              series={[
                { name: "Measurement", color: c, points: shown },
                ...(trend ? [{ name: "Moving average", color: "#FFCC00", points: trend }] : []),
              ]}
              xLabel="Time index"
              yLabel="Measurement"
              unit={ctx.real ? "" : "a.u."}
            />
          </ChartCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Distribution"
              source={src(ctx, sim)}
              sim={!ctx.real}
              xLabel="Measurement"
              yLabel="Count"
            >
              <Histogram values={shown.map((p) => p[1])} color={c} xLabel="Measurement" />
            </ChartCard>
            <Quality ctx={ctx} sim={sim} />
          </div>
        </>
      ) : (
        <Empty
          title="Not analyzed"
          action={
            <Btn onClick={() => setSim(true)} variant="soft">
              Show simulated demonstration
            </Btn>
          }
        >
          Upload radiation data or select a prepared dataset, then run the analysis. Dataset values
          are not bundled with this prototype.
        </Empty>
      )}
    </Frame>
  );
}

export function Musculoskeletal() {
  const { role, datasets } = useApp();
  const ctx = useDomain("musculoskeletal");
  const [sim, setSim] = useState(false);
  const c = DOMAINS.musculoskeletal.color;
  const gm = useMemo(() => {
    const d = datasets.find((x) => x.id === ctx.real?.datasetId);
    if (!d?.uploaded) return null;
    const g: Record<string, number[]> = {};
    d.uploaded.rows.forEach((r) => {
      const v = Number(r.expression ?? r[Object.keys(r)[2]]);
      if (!isNaN(v) && r.group) (g[r.group] ??= []).push(v);
    });
    return Object.entries(g).map(([k, v]) => ({
      label: k,
      value: v.reduce((a, b) => a + b, 0) / v.length,
      color: c,
    }));
  }, [datasets, ctx.real, c]);
  const r = rng(5);
  const volcano = useMemo(
    () =>
      Array.from({ length: 70 }, () => {
        const x = (r() - 0.5) * 6;
        return [x, Math.abs(x) * (1.2 + r() * 1.8) + r() * 0.6] as [number, number];
      }),
    [],
  ); // eslint-disable-line
  const heat = useMemo(
    () => Array.from({ length: 8 }, () => Array.from({ length: 6 }, () => (r() - 0.5) * 4)),
    [],
  ); // eslint-disable-line
  if (role === "Astronaut") return <Simple domain="musculoskeletal" ctx={ctx} />;
  const showReal = !!ctx.real;
  return (
    <Frame
      domain="musculoskeletal"
      ctx={ctx}
      showSim={sim}
      setShowSim={setSim}
      extra={
        ctx.ds && (
          <div className="mt-3">
            <Badge tone={ctx.ds.populationKind === "Animal" ? "warning" : "real"}>
              {ctx.ds.populationKind === "Animal"
                ? "Mouse muscle proteomics"
                : ctx.ds.populationKind === "Human (in vitro)"
                  ? "Human tissue chip gene expression"
                  : ctx.ds.populationKind}
            </Badge>
          </div>
        )
      }
    >
      <Callout tone="info" title="Three different evidence types">
        Mouse muscle proteomics (OSD-139), human-derived tissue-chip gene expression (OSD-684) and
        direct human strength or functional measurements (none available yet) are never combined
        here.
      </Callout>
      {showReal || sim ? (
        <>
          {sim && !showReal && (
            <SimBanner text="Genes (G1…), pathways (Pathway A…) and all values are placeholders generated by the interface. They are not from OSD-139 or OSD-684." />
          )}
          {showReal && gm && (
            <ChartCard
              title="Group comparison: mean expression"
              source={src(ctx, false)}
              xLabel="Group"
              yLabel="Mean expression"
              unit="source unit"
              legend={[{ name: "Group mean", color: c }]}
            >
              <BarChart bars={gm} xLabel="Group" yLabel="Mean expression" />
            </ChartCard>
          )}
          {showReal && !gm && (
            <p className="text-[13px] text-muted">
              Group means need a "group" and "expression" column.
            </p>
          )}
          {sim && !showReal && (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Differential expression (volcano)"
                source={src(ctx, true)}
                sim
                xLabel="log2 fold change"
                yLabel="-log10 p-value"
              >
                <Scatter
                  points={volcano}
                  color={c}
                  xLabel="log2 fold change"
                  yLabel="-log10 p-value"
                />
              </ChartCard>
              <ChartCard
                title="Group comparison"
                source={src(ctx, true)}
                sim
                xLabel="Group"
                yLabel="Mean expression"
                unit="a.u."
              >
                <BarChart
                  bars={[
                    { label: "Control", value: 5.1, color: c },
                    { label: "Treatment", value: 6.3, color: "#FFCC00" },
                  ]}
                  xLabel="Group"
                  yLabel="Mean expression"
                  unit="a.u."
                />
              </ChartCard>
              <ChartCard
                title="Expression heatmap"
                source={src(ctx, true)}
                sim
                xLabel="Samples"
                yLabel="Features"
              >
                <Heatmap
                  rows={heat.map((_, i) => `G${i + 1}`)}
                  cols={["C1", "C2", "C3", "T1", "T2", "T3"]}
                  values={heat}
                  color={c}
                />
              </ChartCard>
              <ChartCard
                title="Pathway enrichment"
                source={src(ctx, true)}
                sim
                xLabel="Pathway"
                yLabel="-log10 adj. p"
              >
                <BarChart
                  bars={["A", "B", "C", "D", "E"].map((k, i) => ({
                    label: `Path ${k}`,
                    value: 4 - i * 0.6,
                    color: c,
                  }))}
                  xLabel="Pathway"
                  yLabel="-log10 adj. p"
                />
              </ChartCard>
            </div>
          )}
          <Quality ctx={ctx} sim={sim} />
          <Card className="p-5">
            <h3 className="serif text-[22px]">Scientific interpretation</h3>
            <p className="mt-2 text-[14px] text-muted">
              No interpretation is generated until a model is connected and run on real data.
              Expression differences, when available, are hypotheses about biology, not muscle
              strength.
            </p>
          </Card>
        </>
      ) : (
        <Empty
          title="Not analyzed"
          action={
            <Btn onClick={() => setSim(true)} variant="soft">
              Show simulated demonstration
            </Btn>
          }
        >
          Choose OSD-139 or OSD-684 above, or upload a CSV with feature_id, group and expression
          columns.
        </Empty>
      )}
    </Frame>
  );
}

export function Vestibular() {
  const { role } = useApp();
  const ctx = useDomain("vestibular");
  const [sim, setSim] = useState(false);
  const c = DOMAINS.vestibular.color;
  if (role === "Astronaut") return <Simple domain="vestibular" ctx={ctx} />;
  const isSym = ctx.ds?.id === "AP006";
  const eye = ctx.real
    ? lineFor(ctx.real, "eye_position_deg")
    : sim
      ? simSeries(21, 120, 0, 8, 1.5)
      : undefined;
  const head = ctx.real
    ? lineFor(ctx.real, "head_velocity_dps")
    : sim
      ? simSeries(22, 120, 0, 20, 4)
      : undefined;
  const sym = ctx.real
    ? lineFor(ctx.real, "symptom_score")
    : sim
      ? simSeries(23, 10, 2, 1, 1).map((p) => [p[0] + 1, Math.max(0, p[1])] as [number, number])
      : undefined;
  const has = (isSym ? sym : eye) !== undefined;
  return (
    <Frame domain="vestibular" ctx={ctx} showSim={sim} setShowSim={setSim}>
      <Callout
        tone="info"
        title={isSym ? "Apollo flight crew symptom record" : "Ground-based research data"}
      >
        {isSym
          ? "Symptom reports describe motion sickness only. They are not a comprehensive vestibular assessment."
          : "ICPSR 235362 contains ground-based participants. These are not spaceflight measurements."}
      </Callout>
      {has ? (
        <>
          {!ctx.real && <SimBanner />}
          {!isSym && eye && head && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                  title="Eye movement"
                  source={src(ctx, sim)}
                  sim={!ctx.real}
                  xLabel="Time"
                  yLabel="Eye position"
                  unit="deg"
                  legend={[{ name: "Eye position", color: c }]}
                >
                  <LineChart
                    series={[{ name: "Eye position", color: c, points: eye }]}
                    xLabel="Time (s or index)"
                    yLabel="Eye position"
                    unit="deg"
                  />
                </ChartCard>
                <ChartCard
                  title="Head kinematics: angular velocity"
                  source={src(ctx, sim)}
                  sim={!ctx.real}
                  xLabel="Time"
                  yLabel="Head angular velocity"
                  unit="deg/s"
                  legend={[{ name: "Head velocity", color: "#FFCC00" }]}
                >
                  <LineChart
                    series={[{ name: "Head velocity", color: "#FFCC00", points: head }]}
                    xLabel="Time (s or index)"
                    yLabel="Angular velocity"
                    unit="deg/s"
                  />
                </ChartCard>
              </div>
              <ChartCard
                title="Eye vs head relationship"
                source={src(ctx, sim)}
                sim={!ctx.real}
                xLabel="Head velocity (deg/s)"
                yLabel="Eye position (deg)"
              >
                <Scatter
                  points={head.map((p, i) => [p[1], eye[i]?.[1] ?? 0] as [number, number])}
                  color={c}
                  xLabel="Head velocity (deg/s)"
                  yLabel="Eye position (deg)"
                />
              </ChartCard>
              <Callout tone="info" title="aVOR-related measures">
                aVOR gain is shown only when the dataset provides it and a model computes it. No
                value is displayed here.
              </Callout>
            </>
          )}
          {isSym && sym && (
            <ChartCard
              title="Motion sickness symptom trend"
              source={src(ctx, sim)}
              sim={!ctx.real}
              xLabel="Mission day"
              yLabel="Symptom score"
              unit="source scale"
            >
              <LineChart
                series={[{ name: "Symptom score", color: c, points: sym }]}
                xLabel="Mission day"
                yLabel="Symptom score"
              />
            </ChartCard>
          )}
          <Quality ctx={ctx} sim={sim} />
        </>
      ) : (
        <Empty
          title="Not analyzed"
          action={
            <Btn onClick={() => setSim(true)} variant="soft">
              Show simulated demonstration
            </Btn>
          }
        >
          Select ICPSR 235362 or AP006 above and run an analysis, or upload a compatible CSV.
        </Empty>
      )}
    </Frame>
  );
}

export function Cardiovascular() {
  const { role, go } = useApp();
  const ctx = useDomain("cardiovascular");
  const [sim, setSim] = useState(false);
  const c = DOMAINS.cardiovascular.color;
  if (role === "Astronaut") return <Simple domain="cardiovascular" ctx={ctx} />;
  const cols = ctx.real ? (ctx.real.series?.map((s) => s.col) ?? []) : [];
  const simMeas: [string, [number, number][]][] = [
    ["heart_rate_bpm", simSeries(31, 48, 68, 6, 5)],
    ["spo2_pct", simSeries(32, 48, 97.5, 0.6, 0.6)],
    ["resp_rate_bpm", simSeries(33, 48, 15, 1.5, 1.5)],
    ["body_temp_c", simSeries(34, 48, 36.7, 0.2, 0.15)],
  ];
  const items: [string, [number, number][]][] = ctx.real
    ? cols.map((k) => [k, lineFor(ctx.real, k)!])
    : sim
      ? simMeas
      : [];
  return (
    <Frame domain="cardiovascular" ctx={ctx} showSim={sim} setShowSim={setSim}>
      {items.length ? (
        <>
          {!ctx.real && (
            <SimBanner text="Simulated heart and respiratory signals for layout only. They are not astronaut measurements." />
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map(([k, p]) => (
              <ChartCard
                key={k}
                title={k.replace(/_/g, " ")}
                source={src(ctx, sim)}
                sim={!ctx.real}
                xLabel="Time index"
                yLabel={k}
                unit={UNITS[k]}
                legend={[{ name: k, color: c }]}
              >
                <LineChart
                  series={[{ name: k, color: c, points: p }]}
                  xLabel="Time index"
                  yLabel={k}
                  unit={UNITS[k]}
                />
              </ChartCard>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title={`${items[0][0].replace(/_/g, " ")} distribution`}
              source={src(ctx, sim)}
              sim={!ctx.real}
              xLabel={items[0][0]}
              yLabel="Count"
            >
              <Histogram
                values={items[0][1].map((p) => p[1])}
                color={c}
                xLabel={items[0][0]}
                unit={UNITS[items[0][0]]}
              />
            </ChartCard>
            <Quality ctx={ctx} sim={sim} />
          </div>
          <Callout tone="info" title="HRV not shown">
            Heart rate variability requires beat-to-beat or ECG-derived data, which is not present.
          </Callout>
        </>
      ) : (
        <Empty
          title="No compatible data available"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Btn icon="upload" onClick={() => go("analysis")}>
                Upload compatible CSV
              </Btn>
              <Btn variant="soft" onClick={() => setSim(true)}>
                Show simulated demonstration
              </Btn>
            </div>
          }
        >
          No prepared cardiovascular or respiratory dataset exists, and no real astronaut
          measurements are stored. Upload a CSV with a timestamp and at least one of:
          heart_rate_bpm, hrv_ms, spo2_pct, resp_rate_bpm, systolic_mmhg, body_temp_c.
        </Empty>
      )}
    </Frame>
  );
}
export type { Dataset };
