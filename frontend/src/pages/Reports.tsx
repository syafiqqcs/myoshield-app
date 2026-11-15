import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { DOMAINS, MODELS, fmtDate, simSeries, type Report } from "../lib/data";
import { Badge, Btn, Callout, Card, Empty, Icon, LineChart, PageTitle } from "../components/ui";

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Preview({ r }: { r: Report }) {
  const { analyses, datasets, subjects, role, shareReport, notify, log } = useApp();
  const a = analyses.find((x) => x.id === r.analysisId);
  const ds = datasets.find((d) => d.id === a?.datasetId);
  const model = MODELS.find((m) => m.id === a?.modelId);
  const subj = subjects.find((s) => s.id === r.subjectId);
  const color = DOMAINS[r.domain].color;
  const series = a?.series?.[0]?.points ?? simSeries(3, 40, 50, 6, 4);
  const sim = !a || a.mode === "simulated";
  const csv = a?.stats.length
    ? [
        "variable,unit,n,missing,min,mean,max",
        ...a.stats.map((s) => [s.col, s.unit, s.n, s.missing, s.min, s.mean, s.max].join(",")),
      ].join("\n")
    : "";
  const exportChart = () => {
    const svg = document.querySelector('.print-area svg[role="img"]');
    if (!svg) return notify("No chart to export");
    download(`${r.id}-chart.svg`, new XMLSerializer().serializeToString(svg), "image/svg+xml");
    log(`Chart exported: ${r.id}`);
  };
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Btn
          icon="download"
          onClick={() => {
            log(`PDF export requested: ${r.id}`);
            window.print();
          }}
        >
          Export PDF
        </Btn>
        <Btn variant="outline" icon="download" onClick={exportChart}>
          Export chart (SVG)
        </Btn>
        <Btn
          variant="outline"
          icon="download"
          disabled={!csv}
          onClick={() => download(`${r.id}-table.csv`, csv, "text/csv")}
        >
          Export table (CSV)
        </Btn>
        {role === "Mission Health Specialist" && (
          <Btn
            variant={r.sharedWithAstronaut ? "soft" : "outline"}
            icon="share"
            onClick={() => {
              shareReport(r.id);
              notify(r.sharedWithAstronaut ? "Sharing removed" : "Shared with astronaut");
            }}
          >
            {r.sharedWithAstronaut ? "Shared with astronaut" : "Share with astronaut"}
          </Btn>
        )}
      </div>
      <article className="print-area hud-panel rounded-[2px] border border-white/[0.08] bg-[#121214] p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(255,255,255,0.08)] pb-5">
          <div>
            <p className="kicker">MYOSHIELD REPORT · {r.id}</p>
            <h2 className="serif mt-2 text-[34px] leading-none text-[#FFFFFF]">{r.title}</h2>
          </div>
          {sim ? (
            <Badge tone="sim">SIMULATED DEMONSTRATION</Badge>
          ) : (
            <Badge tone="real">DESCRIPTIVE STATISTICS</Badge>
          )}
        </div>
        {sim && (
          <div className="mt-4">
            <Callout tone="warn" title="No real model or data">
              This report contains simulated demonstration content. It must not be cited as a
              result.
            </Callout>
          </div>
        )}
        <dl className="mt-6 grid gap-4 text-[13px] md:grid-cols-3">
          {[
            ["Subject or study", `${r.subjectId} (${subj?.type ?? ""})`],
            [
              "Dataset source and reference",
              ds ? `${ds.id} · ${ds.source}` : (a?.datasetId ?? "—"),
            ],
            ["Population and study context", ds?.population ?? "—"],
            ["Analysis date", a ? fmtDate(a.date) : fmtDate(r.date)],
            [
              "Model name and version",
              `${model?.name ?? a?.modelName ?? "—"} · ${model?.version ?? "Not connected"}`,
            ],
            ["Variables analysed", a?.variables.join(", ") || "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[10px] text-muted">{k.toUpperCase()}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <h3 className="serif mt-8 text-[24px]">Results</h3>
        {a?.stats.length ? (
          <table className="tbl mt-2">
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
                  <td>{s.col}</td>
                  <td>{s.unit}</td>
                  <td>{s.n}</td>
                  <td>{s.missing}</td>
                  <td>{s.min?.toFixed(3)}</td>
                  <td>{s.mean?.toFixed(3)}</td>
                  <td>{s.max?.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-[13px] text-muted">
            No numeric results. This is a simulated demonstration without real output.
          </p>
        )}
        <h3 className="serif mt-8 text-[24px]">Visualization</h3>
        <div className="mt-2">
          <LineChart
            series={[
              {
                name: a?.series?.[0]?.col ?? "Simulated signal",
                color,
                points: series.slice(0, 400),
              },
            ]}
            xLabel="Index or time"
            yLabel={a?.series?.[0]?.col ?? "Simulated value"}
          />
        </div>
        <p className="font-mono text-[10px] text-muted">
          Source: {sim ? "Simulated demonstration" : ds?.uploaded?.fileName}
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="serif text-[22px]">Uncertainty or confidence</h3>
            <p className="mt-1 text-[13px] text-muted">
              Not available. No model output or confidence is produced until a model is connected.
            </p>
          </div>
          <div>
            <h3 className="serif text-[22px]">Data limitations</h3>
            <p className="mt-1 text-[13px] text-muted">{ds?.limitation ?? "See dataset record."}</p>
          </div>
          <div>
            <h3 className="serif text-[22px]">Interpretation</h3>
            <p className="mt-1 text-[13px] text-muted">
              {a?.note} Findings are decision support for researchers and are not a diagnosis.
            </p>
          </div>
          <div>
            <h3 className="serif text-[22px]">Further review recommendations</h3>
            <ul className="mt-1 list-disc pl-5 text-[13px] text-muted">
              <li>Connect and run the validated domain model.</li>
              <li>Confirm data provenance and units.</li>
              <li>Have a qualified specialist review before any use.</li>
            </ul>
          </div>
        </div>
      </article>
    </div>
  );
}

export default function Reports() {
  const { reports, subjects, role, focusReport } = useApp();
  const [q, setQ] = useState("");
  const [dom, setDom] = useState("All");
  const [sub, setSub] = useState("All");
  const [from, setFrom] = useState("");
  const [sel, setSel] = useState<string | null>(focusReport);
  const base = role === "Astronaut" ? reports.filter((r) => r.sharedWithAstronaut) : reports;
  const list = useMemo(
    () =>
      base.filter(
        (r) =>
          (dom === "All" || r.domain === dom) &&
          (sub === "All" || r.subjectId === sub) &&
          (!from || new Date(r.date) >= new Date(from)) &&
          (r.title + r.id).toLowerCase().includes(q.toLowerCase()),
      ),
    [base, q, dom, sub, from],
  );
  const cur = reports.find((r) => r.id === sel) ?? list[0];
  return (
    <div className="rise">
      <PageTitle
        kicker="DOCUMENTATION"
        title="Reports and analytics"
        desc={
          role === "Astronaut"
            ? "Reports your health specialist has shared with you."
            : "Every report records its source, model, variables, limitations and interpretation."
        }
      />
      <div className="no-print mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" size={16} className="absolute left-4 top-3 text-muted" />
          <input
            className="input !h-10 !pl-11"
            placeholder="Search reports"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search reports"
          />
        </div>
        <select
          className="input !h-10 !w-auto !text-[13px]"
          value={dom}
          onChange={(e) => setDom(e.target.value)}
          aria-label="Domain"
        >
          <option value="All">Domain: all</option>
          {Object.entries(DOMAINS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.short}
            </option>
          ))}
        </select>
        {role !== "Astronaut" && (
          <select
            className="input !h-10 !w-auto !text-[13px]"
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            aria-label="Subject"
          >
            <option value="All">Subject: all</option>
            {subjects.map((s) => (
              <option key={s.id}>{s.id}</option>
            ))}
          </select>
        )}
        <input
          type="date"
          className="input !h-10 !w-auto !text-[13px]"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="From date"
        />
      </div>
      {list.length ? (
        <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <div className="no-print space-y-2">
            {list.map((r) => (
              <button
                key={r.id}
                onClick={() => setSel(r.id)}
                className={`w-full rounded-[2px] border p-4 text-left transition ${
                  cur?.id === r.id
                    ? "border-[#FFCC00]/60 bg-[#FFCC00]/8"
                    : "border-white/[0.08] bg-[#121214] hover:border-[#FFCC00]/40 hover:bg-[#17171A]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tabular-nums text-[#8E8E93]">{r.id}</span>
                  {r.simulated && <Badge tone="sim">SIM</Badge>}
                </div>
                <p
                  className={`font-bold-sans mt-1 text-[13.5px] ${
                    cur?.id === r.id ? "text-[#FFFFFF]" : "text-[#D6D6D9]"
                  }`}
                >
                  {r.title}
                </p>
                <p className="mt-1 flex items-center gap-1.5 font-mono text-[11.5px] tabular-nums text-[#8E8E93]">
                  <i
                    className="h-2 w-2 rounded-full"
                    style={{ background: DOMAINS[r.domain].color }}
                  />
                  {DOMAINS[r.domain].short} · {fmtDate(r.date)}
                </p>
              </button>
            ))}
          </div>
          {cur && <Preview r={cur} />}
        </div>
      ) : (
        <Empty title={role === "Astronaut" ? "No shared reports yet" : "No reports match"}>
          {role === "Astronaut"
            ? "When a Mission Health Specialist shares a report, it will appear here."
            : "Run an analysis, then choose Generate Report to open the mission report preview."}
        </Empty>
      )}
    </div>
  );
}
