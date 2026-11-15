import { useState } from "react";
import { useApp } from "../lib/store";
import { MODELS, DOMAINS, fmtDate } from "../lib/data";
import { Badge, Btn, Card, Field, PageTitle, Tabs } from "../components/ui";

const PERMS: [string, boolean[]][] = [
  ["View own overview and shared reports", [true, true, true]],
  ["Upload personal measurements", [true, true, true]],
  ["Browse Dataset Explorer", [false, true, true]],
  ["Create research studies and profiles", [false, true, true]],
  ["Run analyses on library datasets", [false, true, true]],
  ["Access authorized astronaut records", [false, false, true]],
  ["Share reports with astronauts", [false, false, true]],
  ["Manage research datasets", [false, true, false]],
];

function Toggle({ on, set, label }: { on: boolean; set: (b: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => set(!on)}
      className={`relative h-6 w-11 rounded-full border transition ${
        on
          ? "border-[#FFCC00]/60 bg-[#FFCC00]"
          : "border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${
          on ? "left-[22px] bg-[#0B0B0C]" : "left-0.5 bg-[#8E8E93]"
        }`}
      />
    </button>
  );
}

export default function Settings() {
  const { role, settings, setSettings, datasets, removeDataset, audit, notify, log } = useApp();
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState(settings.displayName);
  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "roles", label: "Role permissions" },
    ...(role !== "Astronaut"
      ? [
          { id: "data", label: "Dataset management" },
          { id: "models", label: "Models" },
        ]
      : []),
    { id: "access", label: "Data access" },
    ...(role !== "Astronaut" ? [{ id: "audit", label: "Audit history" }] : []),
    { id: "retention", label: "Retention" },
  ];
  const up = datasets.filter((d) => d.origin === "User upload");
  const ri = ["Astronaut", "Researcher", "Mission Health Specialist"].indexOf(role!);
  return (
    <div className="rise">
      <PageTitle
        kicker="ACCOUNT AND DATA"
        title="Settings and data management"
        desc="Sensitive astronaut health information is protected by role-based access."
      />
      <div className="mb-6">
        <Tabs value={tab} onChange={setTab} items={tabs} />
      </div>
      {tab === "profile" && (
        <Card className="max-w-[560px] p-6">
          <div className="space-y-4">
            <Field label="Display name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Role">
              <input className="input" value={role ?? ""} readOnly />
            </Field>
            <Btn
              onClick={() => {
                setSettings({ displayName: name.trim() });
                log("Profile updated");
                notify("Profile saved");
              }}
            >
              Save profile
            </Btn>
          </div>
        </Card>
      )}
      {tab === "roles" && (
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Astronaut</th>
                  <th>Researcher</th>
                  <th>Health Specialist</th>
                </tr>
              </thead>
              <tbody>
                {PERMS.map(([p, v]) => (
                  <tr key={p}>
                    <td>{p}</td>
                    {v.map((x, i) => (
                      <td key={i} className={i === ri ? "bg-[#FFCC00]/8" : ""}>
                        {x ? (
                          <Badge tone="success">Allowed</Badge>
                        ) : (
                          <span className="text-muted">No</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === "data" && (
        <Card className="p-6">
          <h3 className="serif text-[24px]">Datasets</h3>
          <div className="overflow-x-auto">
            <table className="tbl mt-2">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Domain</th>
                  <th>Origin</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.id}>
                    <td>{d.id}</td>
                    <td>{DOMAINS[d.domain].short}</td>
                    <td>{d.origin}</td>
                    <td>
                      {d.origin === "User upload" ? (
                        <Btn
                          small
                          variant="outline"
                          icon="trash"
                          onClick={() => {
                            removeDataset(d.id);
                            notify("Dataset removed");
                          }}
                        >
                          Remove
                        </Btn>
                      ) : (
                        <span className="text-[12px] text-muted">Catalog (read only)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === "models" && (
        <Card className="p-6">
          <h3 className="serif text-[24px]">Model information</h3>
          <div className="overflow-x-auto">
            <table className="tbl mt-2">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Domain</th>
                  <th>Version</th>
                  <th>Endpoint</th>
                  <th>Required inputs</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{DOMAINS[m.domain].short}</td>
                    <td>
                      <Badge tone="warning">{m.version}</Badge>
                    </td>
                    <td className="font-mono text-[11px]">{m.endpoint}</td>
                    <td className="font-mono text-[11px]">
                      {m.required.map((r) => r.col).join(", ")}
                      {m.anyOf ? ` + one of ${m.anyOf.cols.length} measures` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="serif mt-6 text-[22px]">Version history</h3>
          <p className="mt-1 text-[13px] text-muted">
            No versions are registered. History appears here once the development team connects the
            trained models.
          </p>
        </Card>
      )}
      {tab === "access" && (
        <Card className="max-w-[640px] p-6">
          <div className="space-y-5">
            {(
              [
                ["allowAstronautUploads", "Allow astronauts to upload personal measurements"],
                ["shareByDefault", "Share new reports with astronauts by default"],
                ["emailAlerts", "Email notifications for completed analyses"],
              ] as const
            ).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between gap-6 text-[14px]">
                <span>{l}</span>
                <Toggle
                  label={l}
                  on={settings[k]}
                  set={(b) => {
                    setSettings({ [k]: b });
                    log(`${l}: ${b ? "on" : "off"}`);
                    notify("Setting saved");
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "audit" && (
        <Card className="p-6">
          <h3 className="serif text-[24px]">Audit history</h3>
          {audit.length ? (
            <table className="tbl mt-2">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a, i) => (
                  <tr key={i}>
                    <td>{fmtDate(a.at)}</td>
                    <td>{a.who}</td>
                    <td>{a.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-[13px] text-muted">No events yet.</p>
          )}
        </Card>
      )}
      {tab === "retention" && (
        <Card className="max-w-[560px] p-6">
          <div className="space-y-4">
            <Field label="Keep uploaded data for">
              <select
                className="input"
                value={settings.retentionDays}
                onChange={(e) => {
                  setSettings({ retentionDays: Number(e.target.value) });
                  log("Retention changed");
                  notify("Retention saved");
                }}
              >
                {[30, 90, 365, 1095].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-[13px] text-muted">
              {up.length} uploaded dataset(s) in this session. Data lives in your browser and is
              cleared on refresh.
            </p>
            <Btn
              variant="coral"
              icon="trash"
              disabled={!up.length}
              onClick={() => {
                up.forEach((d) => removeDataset(d.id));
                notify("Uploaded data deleted");
              }}
            >
              Delete all uploaded data
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
