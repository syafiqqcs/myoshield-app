import { useApp } from "../lib/store";
import { DOMAINS, MODELS, fmtDate, type Domain } from "../lib/data";
import { Badge, Btn, Callout, Card, Icon, PageTitle } from "../components/ui";

const LIM: Record<Domain, string> = {
  radiation: "Environmental measurements, not personal dose.",
  musculoskeletal:
    "Expression is not muscle strength. Animal and in-vitro data differ from astronauts.",
  vestibular:
    "Symptoms are not a vestibular diagnosis. Ground-based data are not spaceflight data.",
  cardiovascular:
    "Only measurements present in the data are analysed. No real astronaut data are loaded.",
};
const POS: Record<Domain, [number, number]> = {
  radiation: [90, 80],
  musculoskeletal: [330, 80],
  vestibular: [90, 230],
  cardiovascular: [330, 230],
};

export default function Intelligence() {
  const { analyses, datasets, go } = useApp();
  const doms = Object.keys(DOMAINS) as Domain[];
  const kind = (d: Domain) => {
    const a = analyses.find((x) => x.domain === d);
    return a ? (a.mode === "simulated" ? "sim" : "real") : "none";
  };
  return (
    <div className="rise">
      <PageTitle
        kicker="INTEGRATED VIEW"
        title="AI Intelligence"
        desc="Outputs from the four domain pipelines side by side. Populations are never merged, and no combined health score is produced."
        actions={
          <Btn icon="play" onClick={() => go("analysis")}>
            Start New Analysis
          </Btn>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="real">MEASURED FINDING</Badge>
        <Badge tone="upload">MODEL PREDICTION</Badge>
        <Badge tone="warning">RESEARCH HYPOTHESIS</Badge>
        <Badge tone="sim">SIMULATED</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {doms.map((d) => {
          const a = analyses.find((x) => x.domain === d);
          const n = datasets.filter((x) => x.domain === d).length;
          const m = MODELS.find((x) => x.domain === d)!;
          return (
            <Card key={d} className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="serif text-[24px] leading-none">
                  <i
                    className="mr-2 inline-block h-3 w-3 rounded-full"
                    style={{ background: DOMAINS[d].color }}
                  />
                  {DOMAINS[d].short}
                </h3>
                <Badge tone={n ? "success" : "warning"}>
                  {n ? `${n} dataset(s)` : "Data unavailable"}
                </Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
                <div>
                  <dt className="font-mono text-[10px] text-muted">SOURCE</dt>
                  <dd>{a ? a.datasetId : "Not analyzed"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] text-muted">MODEL / ANALYSIS</dt>
                  <dd>{a?.modelName ?? m.name}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] text-muted">TIMESTAMP</dt>
                  <dd>{a ? fmtDate(a.date) : "Not analyzed"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] text-muted">MODEL OUTPUT / CONFIDENCE</dt>
                  <dd className="text-muted">Unavailable. Model not connected.</dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-mono text-[10px] text-muted">MAIN FINDINGS</dt>
                  <dd>
                    {a ? (
                      a.mode === "simulated" ? (
                        <Badge tone="sim">SIMULATED. No findings from real data.</Badge>
                      ) : (
                        <span>
                          {a.stats.length} variable(s) summarised descriptively.{" "}
                          <Badge tone="real">MEASURED</Badge>
                        </span>
                      )
                    ) : (
                      "Not analyzed"
                    )}
                  </dd>
                </div>
                <div className="col-span-2 rounded-[2px] border border-[#F5A623]/30 bg-[#F5A623]/10 p-3 text-[#F2C46B]">
                  <b className="text-[#F5A623]">Limitations:</b> {LIM[d]}
                </div>
              </dl>
              <button
                onClick={() => go(DOMAINS[d].route as never)}
                className="font-bold-sans mt-3 inline-flex items-center gap-1 text-[13px] text-navy hover:underline"
              >
                Open dashboard <Icon name="arrow" size={13} />
              </button>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-6">
        <h2 className="serif text-[30px] leading-none">Integrated analysis</h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-[420px_1fr]">
          <svg
            viewBox="0 0 420 310"
            className="w-full"
            role="img"
            aria-label="Domain relationship map"
          >
            <line
              x1="90"
              y1="80"
              x2="330"
              y2="80"
              stroke="#F2B84B"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            <text
              x="210"
              y="68"
              textAnchor="middle"
              fontSize="10"
              fill="#F5A623"
              className="font-mono"
            >
              HYPOTHESIS TO INVESTIGATE
            </text>
            {doms.map((d) => (
              <g key={d}>
                <circle
                  cx={POS[d][0]}
                  cy={POS[d][1]}
                  r="42"
                  fill={DOMAINS[d].color}
                  fillOpacity={kind(d) === "none" ? 0.18 : 0.45}
                  stroke={DOMAINS[d].color}
                  strokeWidth="2"
                  strokeDasharray={kind(d) === "none" ? "4 4" : "0"}
                />
                <text
                  x={POS[d][0]}
                  y={POS[d][1] - 2}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#FFFFFF"
                >
                  {DOMAINS[d].short}
                </text>
                <text
                  x={POS[d][0]}
                  y={POS[d][1] + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#D6D6D9"
                  className="font-mono"
                >
                  {kind(d) === "none"
                    ? "Not analyzed"
                    : kind(d) === "sim"
                      ? "Simulated"
                      : "Analyzed"}
                </text>
              </g>
            ))}
            <text
              x="210"
              y="300"
              textAnchor="middle"
              fontSize="9.5"
              fill="#6E6E73"
              className="font-mono"
            >
              No links between other domains are asserted.
            </text>
          </svg>
          <div>
            <h4 className="serif text-[20px]">Cross-domain comparison</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Population in data</th>
                    <th>Evidence type</th>
                  </tr>
                </thead>
                <tbody>
                  {doms.map((d) => (
                    <tr key={d}>
                      <td>{DOMAINS[d].short}</td>
                      <td>
                        {datasets
                          .filter((x) => x.domain === d)
                          .map((x) => `${x.id}: ${x.populationKind}`)
                          .join("; ") || "None"}
                      </td>
                      <td>
                        {kind(d) === "none" ? (
                          <Badge>Not analyzed</Badge>
                        ) : kind(d) === "sim" ? (
                          <Badge tone="sim">Simulated</Badge>
                        ) : (
                          <Badge tone="real">Measured (descriptive)</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              Different populations are listed, not combined. They cannot be treated as one
              astronaut.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[2px] border border-[#F5A623]/35 bg-[#F5A623]/8 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">RESEARCH HYPOTHESIS</Badge>
            <h4 className="serif text-[22px] text-[#FFFFFF]">
              Radiation exposure and musculoskeletal change
            </h4>
          </div>
          <p className="mt-2 text-[14px] leading-[1.5] text-[#D6D6D9]">
            This is a central research interest of the project. It is a question to explore, not a
            finding.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13.5px] text-[#8E8E93]">
            <li>Available radiation data are environmental, not personal dose.</li>
            <li>
              Available muscle data are mouse proteomics and human-derived tissue chips, not
              astronauts.
            </li>
            <li>Correlation between separate datasets would not demonstrate causation.</li>
            <li>
              A valid test needs paired radiation dose estimates and musculoskeletal measures from
              the same subjects or a comparable experimental design.
            </li>
          </ul>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <h4 className="serif text-[20px]">Data availability</h4>
            <ul className="mt-2 space-y-1 text-[13px]">
              {doms.map((d) => (
                <li key={d} className="flex justify-between">
                  <span>{DOMAINS[d].short}</span>
                  <span className="text-muted">
                    {datasets.filter((x) => x.domain === d).length || "Unavailable"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="serif text-[20px]">Missing information</h4>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-muted">
              <li>Personal dose estimates</li>
              <li>Direct strength or function measures</li>
              <li>Spaceflight vestibular recordings</li>
              <li>Cardiorespiratory datasets</li>
            </ul>
          </div>
          <div>
            <h4 className="serif text-[20px]">Model uncertainty</h4>
            <p className="mt-2 text-[13px] text-muted">
              Not available. No model is connected, so no confidence or accuracy values are shown.
            </p>
          </div>
          <div>
            <h4 className="serif text-[20px]">Follow-up suggestions</h4>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-muted">
              <li>Connect domain model endpoints</li>
              <li>Source paired dose and musculoskeletal data</li>
              <li>Add a cardiorespiratory dataset</li>
            </ul>
          </div>
        </div>

        <h4 className="serif mt-8 text-[20px]">Historical analyses</h4>
        <ol className="mt-2 border-l border-line pl-4">
          {analyses.slice(0, 8).map((a) => (
            <li key={a.id} className="relative py-2 text-[13px]">
              <i
                className="absolute -left-[21px] top-3.5 h-2.5 w-2.5 rounded-full"
                style={{ background: DOMAINS[a.domain].color }}
              />
              {fmtDate(a.date)} · {a.modelName} on {a.datasetId}{" "}
              {a.mode === "simulated" && <Badge tone="sim">SIM</Badge>}
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <Callout tone="info" title="No combined score">
            A single health score is not offered because none has been scientifically validated.
          </Callout>
        </div>
      </Card>
    </div>
  );
}
