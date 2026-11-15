import { useRef, useState, type ReactNode } from "react";
import { useApp, type Route } from "../lib/store";
import { Badge, Icon, Logo, type IconName } from "./ui";

type Item = { r: Route; label: string; icon: IconName; roles?: string[] };
export const NAV: Item[] = [
  { r: "overview", label: "Overview", icon: "home" },
  {
    r: "profiles",
    label: "Astronaut Profiles",
    icon: "users",
    roles: ["Researcher", "Mission Health Specialist"],
  },
  {
    r: "datasets",
    label: "Dataset Explorer",
    icon: "database",
    roles: ["Researcher", "Mission Health Specialist"],
  },
  { r: "analysis", label: "Start New Analysis", icon: "play" },
  { r: "radiation", label: "Radiation Monitoring", icon: "radiation" },
  { r: "musculoskeletal", label: "Musculoskeletal Health", icon: "dna" },
  { r: "vestibular", label: "Vestibular Monitoring", icon: "ear" },
  { r: "cardiovascular", label: "Cardiovascular Monitoring", icon: "heart" },
  {
    r: "intelligence",
    label: "AI Intelligence",
    icon: "brain",
    roles: ["Researcher", "Mission Health Specialist"],
  },
  { r: "reports", label: "Reports and Analytics", icon: "file" },
  { r: "settings", label: "Settings", icon: "settings" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const {
    route,
    go,
    role,
    demo,
    signOut,
    subjects,
    subjectId,
    setSubjectId,
    settings,
    analyses,
    notify,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<"bell" | "user" | null>(null);

  const navWrap = useRef<HTMLElement>(null);
  const navItems = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ y: 0, h: 0, on: false });

  const nav = NAV.filter(
    (n) =>
      (!n.roles || n.roles.includes(role!)) &&
      !(n.r === "analysis" && role === "Astronaut" && !settings.allowAstronautUploads),
  );
  const cur = NAV.find((n) => n.r === route);
  const subj = subjects.find((s) => s.id === subjectId);
  const last = analyses[0];

  const showPill = (i: number) => {
    const w = navWrap.current;
    const b = navItems.current[i];
    if (!w || !b) return;
    const wr = w.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    setPill({ y: r.top - wr.top, h: r.height, on: true });
  };

  const NavList = () => (
    <nav
      ref={navWrap}
      onMouseLeave={() => setPill((p) => ({ ...p, on: false }))}
      className="relative flex-1 overflow-y-auto px-3 py-2"
    >
      {/* Magnetic Hover Pill for sidebar navigation */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-0 z-0 rounded-[2px]"
        style={{
          height: pill.h,
          transform: `translateY(${pill.y}px) scale(${pill.on ? 1 : 0.96})`,
          opacity: pill.on ? 1 : 0,
          background: "rgba(255,204,0,0.08)",
          border: "1px solid rgba(255,204,0,0.45)",
          transition:
            "transform .28s cubic-bezier(.22,1.2,.36,1), height .24s ease, opacity .18s ease",
        }}
      />
      {nav.map((n, i) => {
        const active = route === n.r;
        return (
          <button
            key={n.r}
            ref={(el) => {
              navItems.current[i] = el;
            }}
            onMouseEnter={() => showPill(i)}
            onClick={() => {
              go(n.r);
              setOpen(false);
            }}
            aria-current={active ? "page" : undefined}
            className={`relative z-10 mb-1 flex w-full items-center gap-3 rounded-[2px] px-3.5 py-2.5 text-left text-[13.5px] transition-colors ${
              active
                ? "border border-[#FFCC00]/40 bg-[#FFCC00]/12 font-bold-sans text-[#FFCC00]"
                : "text-[#8E8E93] hover:text-[#FFFFFF]"
            }`}
          >
            <Icon name={n.icon} size={17} />
            {n.label}
            {n.r === "analysis" && !active && (
              <span className="ml-auto live-dot h-1.5 w-1.5 rounded-full bg-coral" />
            )}
          </button>
        );
      })}
    </nav>
  );

  const Side = () => (
    <div className="liquid-glass flex h-full flex-col rounded-r-[2px] border-r border-[rgba(255,255,255,0.08)] text-[#FFFFFF]">
      <div className="px-5 pb-5 pt-6">
        <button onClick={() => go("landing")} aria-label="MYOSHIELD home">
          <Logo size={23} />
        </button>
      </div>
      <NavList />
      <div className="border-t border-[rgba(255,255,255,0.08)] p-4">
        <div className="flex items-center gap-3 rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-[#121214] p-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[#FFCC00]/40 bg-[#FFCC00]/15 text-[12px] font-bold text-[#FFCC00]">
            {(settings.displayName || role || "U").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[#FFFFFF]">
              {settings.displayName || "Demo user"}
            </p>
            <p className="font-mono truncate text-[10px] text-muted">{role}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              go("settings");
              setOpen(false);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#121214]/80 py-2 text-[12px] text-[#D6D6D9] transition hover:border-[#FFCC00]/45 hover:text-[#FFFFFF]"
          >
            <Icon name="settings" size={14} />
            Settings
          </button>
          <button
            onClick={signOut}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#121214]/80 py-2 text-[12px] text-[#D6D6D9] transition hover:border-[#FFCC00]/45 hover:text-[#FFFFFF]"
          >
            <Icon name="logout" size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-[#FFFFFF]">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[264px] p-3 lg:block">
        <div className="liquid-glass h-full overflow-hidden rounded-[2px]">
          <Side />
        </div>
      </aside>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-[#000000]/75 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[280px]">
            <Side />
          </div>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="no-print sticky top-0 z-20 px-3 pt-3 md:px-8 md:pt-4">
          <div className="liquid-glass mx-auto flex max-w-[1360px] flex-wrap items-center gap-3 rounded-[2px] px-4 py-3 md:px-6">
            <button
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" size={22} />
            </button>
            <div className="mr-auto min-w-0">
              <p className="font-mono truncate text-[10px] text-muted">MYOSHIELD / {cur?.label}</p>
              <p className="serif truncate text-[26px] leading-none text-[#FFFFFF]">{cur?.label}</p>
            </div>
            {demo && <Badge tone="sim">DEMONSTRATION MODE</Badge>}
            <div className="hidden items-center gap-2 md:flex">
              <Icon name="users" size={15} className="text-muted" />
              <select
                className="input !h-9 !w-[210px] !rounded-full !border-[rgba(255,255,255,0.08)] !bg-[#121214]/80 !text-[12.5px]"
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  notify(`Selected ${e.target.value}`);
                }}
                aria-label="Selected subject or study"
              >
                {(role === "Astronaut" ? subjects.filter((s) => s.owner) : subjects).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
            </div>
            <Badge tone="real" className="hidden xl:inline-flex">
              <Icon name="database" size={11} />
              Source: {subj?.type === "Demonstration subject" ? "Simulated demo" : subj?.study}
            </Badge>
            <div className="relative">
              <button
                className="relative grid h-9 w-9 place-items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#121214]/80 transition hover:border-[#FFCC00]/45"
                aria-label="Notifications"
                onClick={() => setMenu(menu === "bell" ? null : "bell")}
              >
                <Icon name="bell" size={17} />
                <span className="absolute right-2 top-2 live-dot h-1.5 w-1.5 rounded-full bg-coral" />
              </button>
              {menu === "bell" && (
                <div className="liquid-glass absolute right-0 top-11 w-[300px] rounded-[2px] p-4">
                  <p className="font-bold-sans text-[13px] text-[#FFFFFF]">Notifications</p>
                  <ul className="mt-3 space-y-3 text-[12.5px] text-muted">
                    <li>
                      Cardiovascular and respiratory:{" "}
                      <b className="text-[#FFFFFF]">no compatible dataset</b> loaded.
                    </li>
                    {last && (
                      <li>
                        Last analysis {last.id}{" "}
                        {last.mode === "simulated" ? "(simulated demonstration)" : "completed"}.
                      </li>
                    )}
                    <li>
                      Model endpoints are <b className="text-[#FFFFFF]">not connected</b>. Runs show
                      descriptive statistics or labelled simulations only.
                    </li>
                  </ul>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#121214]/80 py-1 pl-1 pr-3 transition hover:border-[#FFCC00]/45"
                onClick={() => setMenu(menu === "user" ? null : "user")}
                aria-label="Profile menu"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full border border-[#FFCC00]/40 bg-[#FFCC00]/15 text-[11px] font-bold text-[#FFCC00]">
                  {(settings.displayName || role || "U").slice(0, 2).toUpperCase()}
                </span>
                <Icon name="chevron" size={13} className="rotate-90" />
              </button>
              {menu === "user" && (
                <div className="liquid-glass absolute right-0 top-11 w-[220px] rounded-[2px] p-2">
                  <p className="px-3 py-2 text-[12px] text-muted">{role}</p>
                  <button
                    className="w-full rounded-[2px] px-3 py-2 text-left text-[13px] text-[#D6D6D9] hover:bg-white/[0.06] hover:text-[#FFFFFF]"
                    onClick={() => {
                      setMenu(null);
                      go("settings");
                    }}
                  >
                    Settings
                  </button>
                  <button
                    className="w-full rounded-[2px] px-3 py-2 text-left text-[13px] text-[#D6D6D9] hover:bg-white/[0.06] hover:text-[#FFFFFF]"
                    onClick={signOut}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          className="mx-auto max-w-[1360px] px-4 py-8 md:px-8"
          onClick={() => menu && setMenu(null)}
        >
          {children}
        </main>
        <footer className="no-print border-t border-[rgba(255,255,255,0.08)] px-8 py-5">
          <p className="font-mono text-[10.5px] text-muted">
            MYOSHIELD is a research and decision-support tool, not a clinically validated diagnostic
            system.
          </p>
        </footer>
      </div>
    </div>
  );
}
