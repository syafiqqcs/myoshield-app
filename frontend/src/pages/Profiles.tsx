import { useState } from "react";
import { useApp } from "../lib/store";
import { DOMAINS, fmtDate, type Domain, type Subject, type SubjectType } from "../lib/data";
import { Badge, Btn, Card, Empty, Field, Icon, PageTitle } from "../components/ui";

const TYPES: SubjectType[] = [
  "Astronaut",
  "Human research participant",
  "Animal research model",
  "Demonstration subject",
  "Research study (no individual)",
];

export default function Profiles() {
  const {
    subjects,
    addSubject,
    analyses,
    reports,
    datasets,
    go,
    focusSubject,
    setSubjectId,
    role,
    notify,
  } = useApp();
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string | null>(focusSubject);
  const [f, setF] = useState({
    id: "",
    type: "Demonstration subject" as SubjectType,
    study: "",
    domain: "cardiovascular" as Domain,
  });
  const list = subjects.filter(
    (s) =>
      (type === "All" || s.type === type) &&
      (s.id + s.study + s.name).toLowerCase().includes(q.toLowerCase()),
  );
  const s = subjects.find((x) => x.id === sel);

  if (s) {
    const an = analyses.filter((a) => a.subjectId === s.id),
      rp = reports.filter((r) => r.subjectId === s.id);
    return (
      <div className="rise">
        <button
          onClick={() => setSel(null)}
          className="font-mono mb-4 inline-flex items-center gap-1 text-[11px] tracking-[0.06em] text-[#FFCC00] hover:text-[#FFD633]"
        >
          ← Back to profiles
        </button>
        <PageTitle
          kicker={s.type.toUpperCase()}
          title={s.id}
          desc={s.note}
          actions={
            <Btn
              icon="check"
              onClick={() => {
                setSubjectId(s.id);
                notify(`${s.id} selected`);
              }}
            >
              Select this profile
            </Btn>
          }
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6">
            <h3 className="serif text-[22px]">Profile information</h3>
            <dl className="mt-3 space-y-3 text-[13px]">
              {[
                ["Name", s.name],
                ["Subject type", s.type],
                ["Study / mission", s.study],
                ["Domains", s.domains.map((d) => DOMAINS[d].short).join(", ")],
                ["Analyses", String(an.length)],
                ["Last analysis", an[0] ? fmtDate(an[0].date) : "Not analyzed"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] text-muted">{k.toUpperCase()}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-6">
            <h3 className="serif text-[22px]">Available datasets</h3>
            <ul className="mt-3 space-y-2 text-[13px]">
              {s.datasetIds.map((id) => (
                <li key={id}>
                  <button
                    className="font-bold-sans underline"
                    onClick={() => go("datasets", { datasetId: id })}
                  >
                    {id}
                  </button>{" "}
                  <span className="text-muted">{datasets.find((d) => d.id === id)?.name}</span>
                </li>
              ))}
              {!s.datasetIds.length && (
                <li className="text-muted">No datasets linked. Data unavailable.</li>
              )}
            </ul>
          </Card>
          <Card className="p-6">
            <h3 className="serif text-[22px]">Health-domain summaries</h3>
            <ul className="mt-3 space-y-2 text-[13px]">
              {s.domains.map((d) => {
                const a = an.find((x) => x.domain === d);
                return (
                  <li key={d} className="flex items-center justify-between">
                    <span>
                      <i
                        className="mr-2 inline-block h-2 w-2 rounded-full"
                        style={{ background: DOMAINS[d].color }}
                      />
                      {DOMAINS[d].short}
                    </span>
                    {a ? (
                      <Badge tone={a.mode === "simulated" ? "sim" : "real"}>
                        {a.mode === "simulated" ? "Simulated" : "Analyzed"}
                      </Badge>
                    ) : (
                      <Badge>Not analyzed</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
        <Card className="mt-4 p-6">
          <h3 className="serif text-[22px]">Analysis history</h3>
          {an.length ? (
            <table className="tbl mt-3">
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
                {an.map((a) => (
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
            <p className="mt-3 text-[13px] text-muted">Not analyzed.</p>
          )}
          <h3 className="serif mt-6 text-[22px]">Reports</h3>
          <ul className="mt-2 text-[13px]">
            {rp.map((r) => (
              <li key={r.id} className="py-1">
                <button className="underline" onClick={() => go("reports", { reportId: r.id })}>
                  {r.title}
                </button>
              </li>
            ))}
            {!rp.length && <li className="text-muted">No reports.</li>}
          </ul>
        </Card>
        <p className="font-mono mt-4 text-[10.5px] text-muted">
          Subjects are kept separate. Data from different studies is never merged into one profile.
        </p>
      </div>
    );
  }

  return (
    <div className="rise">
      <PageTitle
        kicker="SUBJECTS AND STUDIES"
        title="Astronaut and research subject profiles"
        desc="Every dataset stays attached to its own subject or study. Mouse muscle data is never linked to a human astronaut."
        actions={
          role !== "Astronaut" ? (
            <Btn icon="plus" onClick={() => setAdding(!adding)}>
              Add profile
            </Btn>
          ) : undefined
        }
      />
      {adding && (
        <Card className="mb-6 p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Subject ID">
              <input
                className="input"
                value={f.id}
                onChange={(e) => setF({ ...f, id: e.target.value })}
                placeholder="e.g. DEMO-AST-02"
              />
            </Field>
            <Field label="Subject type">
              <select
                className="input"
                value={f.type}
                onChange={(e) => setF({ ...f, type: e.target.value as SubjectType })}
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Mission or study">
              <input
                className="input"
                value={f.study}
                onChange={(e) => setF({ ...f, study: e.target.value })}
              />
            </Field>
            <Field label="Primary domain">
              <select
                className="input"
                value={f.domain}
                onChange={(e) => setF({ ...f, domain: e.target.value as Domain })}
              >
                {(Object.keys(DOMAINS) as Domain[]).map((d) => (
                  <option key={d} value={d}>
                    {DOMAINS[d].short}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Btn
              disabled={!f.id.trim() || subjects.some((x) => x.id === f.id.trim())}
              onClick={() => {
                const n: Subject = {
                  id: f.id.trim(),
                  name: f.id.trim(),
                  type: f.type,
                  study: f.study || "Unassigned",
                  domains: [f.domain],
                  datasetIds: [],
                  note: "User-created profile.",
                };
                addSubject(n);
                setAdding(false);
                setF({ ...f, id: "", study: "" });
                notify("Profile created");
              }}
            >
              Create profile
            </Btn>
            <Btn variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Btn>
          </div>
        </Card>
      )}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Icon name="search" size={16} className="absolute left-4 top-3.5 text-muted" />
          <input
            className="input !pl-11"
            placeholder="Search profiles"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search profiles"
          />
        </div>
        <select
          className="input !w-[260px]"
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter by subject type"
        >
          <option>All</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const an = analyses.filter((a) => a.subjectId === p.id);
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[22px] leading-none tabular-nums text-[#FFFFFF]">
                      {p.id}
                    </p>
                    <p className="mt-1 text-[12.5px] text-[#8E8E93]">{p.name}</p>
                  </div>
                  <Badge>{p.type}</Badge>
                </div>
                <dl className="mt-4 space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-muted">Study</dt>
                    <dd>{p.study}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Domains</dt>
                    <dd className="flex gap-1">
                      {p.domains.map((d) => (
                        <i
                          key={d}
                          title={DOMAINS[d].short}
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: DOMAINS[d].color }}
                        />
                      ))}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Analyses</dt>
                    <dd className="font-mono tabular-nums">{an.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Last analysis</dt>
                    <dd className="font-mono text-[11.5px] tabular-nums">
                      {an[0] ? fmtDate(an[0].date) : "Not analyzed"}
                    </dd>
                  </div>
                </dl>
                <Btn
                  small
                  variant="soft"
                  className="mt-5 self-start"
                  onClick={() => setSel(p.id)}
                  icon="chevron"
                >
                  Open profile
                </Btn>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty title="No matching profiles">Try a different search or filter.</Empty>
      )}
    </div>
  );
}
