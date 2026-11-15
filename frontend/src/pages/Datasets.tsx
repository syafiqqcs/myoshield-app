import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { DOMAINS, MODELS, type Dataset, type Domain } from "../lib/data";
import { Badge, Btn, Callout, Card, Empty, Icon, PageTitle } from "../components/ui";

export function DatasetBrowser({
  onOpen,
  onPick,
  compact,
  domainLock,
}: {
  onOpen?: (d: Dataset) => void;
  onPick?: (d: Dataset) => void;
  compact?: boolean;
  domainLock?: Domain;
}) {
  const { datasets } = useApp();
  const [q, setQ] = useState("");
  const [dom, setDom] = useState<string>(domainLock ?? "All");
  const [src, setSrc] = useState("All");
  const [pop, setPop] = useState("All");
  const [fmt, setFmt] = useState("All");
  const [sort, setSort] = useState("name");
  const opts = (k: (d: Dataset) => string) => ["All", ...Array.from(new Set(datasets.map(k)))];
  const list = useMemo(
    () =>
      datasets
        .filter(
          (d) =>
            (dom === "All" || d.domain === dom) &&
            (src === "All" || d.origin === src) &&
            (pop === "All" || d.populationKind === pop) &&
            (fmt === "All" || d.format === fmt) &&
            [d.id, d.name, d.source, d.population, d.variables.join(" ")]
              .join(" ")
              .toLowerCase()
              .includes(q.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "domain"
            ? a.domain.localeCompare(b.domain)
            : sort === "id"
              ? a.id.localeCompare(b.id)
              : a.name.localeCompare(b.name),
        ),
    [datasets, q, dom, src, pop, fmt, sort],
  );
  const Sel = ({
    v,
    set,
    items,
    label,
  }: {
    v: string;
    set: (s: string) => void;
    items: string[];
    label: string;
  }) => (
    <select
      aria-label={label}
      className="input !h-10 !w-auto !min-w-[150px] !text-[13px]"
      value={v}
      onChange={(e) => set(e.target.value)}
    >
      {items.map((i) => (
        <option key={i} value={i}>
          {i === "All"
            ? `${label}: all`
            : ((DOMAINS as Record<string, { short: string }>)[i]?.short ?? i)}
        </option>
      ))}
    </select>
  );
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" size={16} className="absolute left-4 top-3 text-muted" />
          <input
            className="input !h-10 !pl-11"
            placeholder="Search datasets, variables, sources"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search datasets"
          />
        </div>
        <Sel
          v={dom}
          set={setDom}
          items={["All", "radiation", "musculoskeletal", "vestibular", "cardiovascular"]}
          label="Domain"
        />
        <Sel v={src} set={setSrc} items={opts((d) => d.origin)} label="Data source" />
        <Sel v={pop} set={setPop} items={opts((d) => d.populationKind)} label="Population" />
        <Sel v={fmt} set={setFmt} items={opts((d) => d.format)} label="File type" />
        <select
          aria-label="Sort"
          className="input !h-10 !w-auto !text-[13px]"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Sort: name</option>
          <option value="id">Sort: identifier</option>
          <option value="domain">Sort: domain</option>
        </select>
      </div>
      <p className="font-mono mb-3 text-[10.5px] text-muted">
        {list.length} of {datasets.length} datasets
      </p>
      {list.length ? (
        <div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "lg:grid-cols-2"}`}>
          {list.map((d) => (
            <Card key={d.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono inline-flex items-center gap-1.5 text-[10.5px]">
                    <i
                      className="h-2 w-2 rounded-full"
                      style={{ background: DOMAINS[d.domain].color }}
                    />
                    {DOMAINS[d.domain].short.toUpperCase()}
                  </span>
                  <h3 className="serif mt-2 text-[26px] leading-none">{d.id}</h3>
                  <p className="mt-1 text-[13px] text-muted">{d.name}</p>
                </div>
                <Badge tone={d.origin === "User upload" ? "upload" : "real"}>{d.origin}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
                {[
                  ["Research source", d.source],
                  ["Population", d.population],
                  ["File format", d.format],
                  ["Records", d.records],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[10px] text-muted">{k.toUpperCase()}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
                <div className="col-span-2">
                  <dt className="font-mono text-[10px] text-muted">VARIABLES</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {d.variables.map((v) => (
                      <Badge key={v}>{v}</Badge>
                    ))}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-mono text-[10px] text-muted">COMPATIBLE METHODS</dt>
                  <dd>{d.methods.join(", ")}</dd>
                </div>
              </dl>
              <p className="mt-3 rounded-[2px] border border-[#F5A623]/30 bg-[#F5A623]/10 p-3 text-[12.5px] leading-[1.5] text-[#F2C46B]">
                <b className="text-[#F5A623]">Limitation:</b> {d.limitation}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {onOpen && (
                  <Btn small variant="outline" onClick={() => onOpen(d)}>
                    Details
                  </Btn>
                )}
                {onPick && (
                  <Btn small onClick={() => onPick(d)} icon="check">
                    Use this dataset
                  </Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty title="No datasets match">
          Adjust the filters or upload a CSV from Start New Analysis. The catalog expands as
          datasets are added.
        </Empty>
      )}
    </div>
  );
}

export function DatasetDetail({ d, onBack }: { d: Dataset; onBack: () => void }) {
  const { go } = useApp();
  const models = MODELS.filter((m) => d.modelIds.includes(m.id));
  return (
    <div className="rise">
      <button
        onClick={onBack}
        className="font-mono mb-4 inline-flex items-center gap-1 text-[11px] tracking-[0.06em] text-[#FFCC00] hover:text-[#FFD633]"
      >
        ← Back to Dataset Explorer
      </button>
      <PageTitle
        kicker={`${DOMAINS[d.domain].label.toUpperCase()} · ${d.source}`}
        title={d.id}
        desc={d.name}
        actions={
          <Btn icon="play" onClick={() => go("analysis", { datasetId: d.id })}>
            Use This Dataset
          </Btn>
        }
      />
      <Callout tone="warn" title="Data limitation">
        {d.limitation}
      </Callout>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="serif text-[24px]">Study description</h3>
          <p className="mt-2 text-[14px] leading-[1.5] text-muted">{d.description}</p>
          <h3 className="serif mt-6 text-[24px]">Population and experimental design</h3>
          <p className="mt-2 text-[14px] text-muted">
            {d.population}. <b className="text-[#FFFFFF]">Suitable use:</b> {d.suitable}.
          </p>
          <h3 className="serif mt-6 text-[24px]">Variables and units</h3>
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Units</th>
              </tr>
            </thead>
            <tbody>
              {d.variables.map((v) => (
                <tr key={v}>
                  <td>{v}</td>
                  <td className="text-muted">
                    {d.uploaded
                      ? "As provided in file"
                      : "See repository record. Not listed in this catalog."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="serif mt-6 text-[24px]">Sample preview</h3>
          {d.uploaded ? (
            <div className="mt-2 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    {d.uploaded.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.uploaded.rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      {d.uploaded!.columns.map((c) => (
                        <td key={c}>{r[c] || <span className="text-coral">missing</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 rounded-[2px] border border-dashed border-[#FFCC00]/30 p-4 text-[13px] text-muted">
              Preview unavailable. Dataset values are not bundled with this prototype and none are
              invented here. A preview will load once the repository connection is configured.
            </p>
          )}
        </Card>
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="serif text-[22px]">Source and citation</h3>
            <p className="mt-2 text-[13px] text-muted">{d.citation}</p>
            <p className="mt-3 text-[13px]">
              <b>Format:</b> {d.format}
            </p>
            <p className="text-[13px]">
              <b>Records:</b> {d.records}
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="serif text-[22px]">Data quality</h3>
            <p className="mt-2 text-[13px] text-muted">{d.quality}</p>
          </Card>
          <Card className="p-6">
            <h3 className="serif text-[22px]">Model compatibility</h3>
            <ul className="mt-2 space-y-2 text-[13px]">
              {models.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>{m.name}</span>
                  <Badge>{m.version}</Badge>
                </li>
              ))}
              {!models.length && <li className="text-muted">No compatible model catalogued.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Datasets() {
  const { focusDataset, datasets, go } = useApp();
  const [open, setOpen] = useState<string | null>(focusDataset);
  const d = datasets.find((x) => x.id === open);
  if (d) return <DatasetDetail d={d} onBack={() => setOpen(null)} />;
  return (
    <div className="rise">
      <PageTitle
        kicker="SCIENTIFIC CATALOG"
        title="Dataset Explorer"
        desc="Browse prepared research datasets with their origin, population and limitations. Nothing here is mixed across populations."
        actions={
          <Btn icon="upload" variant="soft" onClick={() => go("analysis")}>
            Upload CSV
          </Btn>
        }
      />
      <DatasetBrowser
        onOpen={(x) => setOpen(x.id)}
        onPick={(x) => go("analysis", { datasetId: x.id })}
      />
    </div>
  );
}
