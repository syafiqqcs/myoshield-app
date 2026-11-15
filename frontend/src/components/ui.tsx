import { useState, type ReactNode } from "react";

export type IconName =
  | "home"
  | "users"
  | "database"
  | "play"
  | "radiation"
  | "dna"
  | "ear"
  | "heart"
  | "brain"
  | "file"
  | "settings"
  | "search"
  | "bell"
  | "upload"
  | "check"
  | "x"
  | "alert"
  | "menu"
  | "logout"
  | "chevron"
  | "arrow"
  | "download"
  | "plus"
  | "shield"
  | "info"
  | "share"
  | "trash"
  | "filter"
  | "lock"
  | "cpu";
const P: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  play: <path d="m7 4 13 8-13 8Z" />,
  radiation: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10V3a9 9 0 0 1 7.8 4.5L13.7 11M10.3 13 4.2 16.5A9 9 0 0 1 4.2 7.5L10.3 11M13.7 13l6.1 3.5A9 9 0 0 1 12 21v-7" />
    </>
  ),
  dna: (
    <>
      <path d="M6 3c0 6 12 6 12 12v6M18 3c0 6-12 6-12 12v6M8 7h8M8 17h8" />
    </>
  ),
  ear: (
    <>
      <path d="M6 8.5a6 6 0 0 1 12 0c0 3-2 4-3 6s-1 5-4 5a3 3 0 0 1-3-3" />
      <path d="M9 9a3 3 0 0 1 6 0c0 1.5-1.5 2-1.5 3.5" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
  ),
  brain: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="m7 7 3 3M17 7l-3 3M7 17l3-3M17 17l-3-3" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3 2 20h20Z" />
      <path d="M12 10v5M12 18v.01" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  arrow: <path d="M7 17 17 7M8 7h9v9" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  shield: (
    <>
      <path d="M12 22s8-3.8 8-11V5l-8-3-8 3v6c0 7.2 8 11 8 11Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8Z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
};
export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}

export function Logo({ size = 26 }: { dark?: boolean; size?: number }) {
  return (
    <span
      className="font-bold-sans inline-flex items-center gap-2.5 tracking-[-0.04em] text-[#FFFFFF]"
      style={{ fontSize: size }}
    >
      <span
        className="relative inline-grid shrink-0 place-items-center border-2 border-[#FFCC00]"
        style={{ width: Math.round(size * 1.34), height: Math.round(size * 0.86) }}
        aria-hidden
      >
        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M4 19V6l4.6 7L12 5l3.4 8L20 6v13"
            stroke="#FFCC00"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      MYOSHIELD
    </span>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  icon,
  disabled,
  className = "",
  type = "button",
  small,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "soft" | "ghost" | "coral" | "outline";
  icon?: IconName;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  small?: boolean;
}) {
  const v = {
    primary:
      "border border-[#FFCC00] bg-[#FFCC00] text-[#0B0B0C] hover:bg-[#FFD633] hover:border-[#FFD633]",
    soft: "bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/45 hover:bg-[#FFCC00]/18",
    ghost: "text-[#8E8E93] hover:text-[#FFFFFF] hover:bg-white/[0.06]",
    coral: "border border-[#F06464] bg-[#F06464] text-[#190707] hover:bg-[#F58080]",
    outline:
      "border border-white/[0.12] bg-transparent text-[#D6D6D9] hover:border-[#FFCC00] hover:text-[#FFFFFF]",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`font-bold-sans inline-flex items-center justify-center gap-2 rounded-[2px] ${small ? "px-4 py-2 text-[13px]" : "px-[22px] py-[13px] text-[14px]"} tracking-[-0.2px] transition disabled:opacity-40 disabled:cursor-not-allowed ${v} ${className}`}
    >
      {children}
      {icon && <Icon name={icon} size={small ? 14 : 15} />}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "critical" | "sim" | "real" | "upload";
  className?: string;
}) {
  const t = {
    neutral: "bg-white/[0.04] text-[#D6D6D9] border border-white/[0.12]",
    success: "bg-[#35D6C0]/10 text-[#35D6C0] border border-[#35D6C0]/35",
    warning: "bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/40",
    critical: "bg-[#F06464]/12 text-[#F06464] border border-[#F06464]/45",
    sim: "bg-[#F5A623]/10 text-[#F2C46B] border border-[#F5A623]/50",
    real: "bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/35",
    upload: "bg-[#FFCC00]/10 text-[#FFCC00] border border-[#FFCC00]/35",
  }[tone];
  return (
    <span
      className={`font-mono inline-flex items-center gap-1 whitespace-nowrap rounded-[2px] px-2 py-1 text-[9.5px] uppercase tracking-[0.1em] ${t} ${className}`}
    >
      {children}
    </span>
  );
}

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section
    className={`hud-panel hud-panel-hover rounded-[2px] border border-white/[0.08] bg-[#121214] ${className}`}
  >
    {children}
  </section>
);

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "error" | "ok";
  title?: string;
  children: ReactNode;
}) {
  const t = {
    info: "bg-[#121214] border-white/[0.08] border-l-[#FFCC00] text-[#D6D6D9]",
    warn: "bg-[#121214] border-white/[0.08] border-l-[#F5A623] text-[#F2C46B]",
    error: "bg-[#121214] border-white/[0.08] border-l-[#F06464] text-[#F6A0A0]",
    ok: "bg-[#121214] border-white/[0.08] border-l-[#35D6C0] text-[#35D6C0]",
  }[tone];
  const ic: IconName =
    tone === "error" ? "alert" : tone === "warn" ? "alert" : tone === "ok" ? "check" : "info";
  return (
    <div
      className={`flex gap-3 rounded-[2px] border border-l-2 p-4 text-[13.5px] leading-[1.5] ${t}`}
    >
      <Icon name={ic} className="mt-0.5 shrink-0" />
      <div>
        {title && <p className="font-bold-sans mb-0.5 text-[#FFFFFF]">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export const SimBanner = ({ text }: { text?: string }) => (
  <Callout tone="warn" title="Simulated demonstration data">
    {text ??
      "These values are generated by the interface to show layout only. They are not real measurements, not from the named dataset, and no model has been run."}
  </Callout>
);

export function PageTitle({
  kicker,
  title,
  desc,
  actions,
}: {
  kicker?: string;
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[760px]">
        {kicker && (
          <p className="font-mono mb-3 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.2em] text-[#FFCC00]">
            <span aria-hidden className="inline-block h-px w-6 bg-[#FFCC00]/70" />
            {kicker}
          </p>
        )}
        <h1 className="font-bold-sans text-[40px] leading-[0.95] tracking-[-0.04em] text-[#FFFFFF] md:text-[54px]">
          {title}
        </h1>
        {desc && <p className="mt-3 text-[15px] leading-[1.5] text-[#8E8E93]">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const Field = ({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) => (
  <label className="block">
    <span className="font-mono mb-1.5 block text-[10.5px] tracking-[0.08em] text-[#FFCC00]">
      {label}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[12px] text-[#8E8E93]">{hint}</span>}
  </label>
);

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-[2px] border border-white/[0.08] bg-[#121214] p-1">
      {items.map((i) => (
        <button
          key={i.id}
          onClick={() => onChange(i.id)}
          className={`font-mono rounded-[2px] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition ${value === i.id ? "bg-[#FFCC00] text-[#0B0B0C]" : "text-[#8E8E93] hover:bg-white/[0.06] hover:text-[#FFFFFF]"}`}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export const Empty = ({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center rounded-[2px] border border-dashed border-[#FFCC00]/30 bg-[#121214] px-6 py-12 text-center">
    <Icon name="database" size={28} className="text-[#FFCC00]/70" />
    <p className="serif mt-3 text-[24px] text-[#FFFFFF]">{title}</p>
    {children && (
      <p className="mt-2 max-w-[460px] text-[14px] leading-[1.4] text-[#8E8E93]">{children}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

// ---------- Charts ----------
type Pt = [number, number];
export type Series = { name: string; color: string; points: Pt[] };
const W = 640,
  H = 260,
  M = { l: 52, r: 16, t: 12, b: 40 };
const nice = (v: number) =>
  Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);

export function ChartCard({
  title,
  source,
  sim,
  children,
  legend,
  xLabel,
  yLabel,
  unit,
  right,
}: {
  title: string;
  source: string;
  sim?: boolean;
  children: ReactNode;
  legend?: { name: string; color: string }[];
  xLabel?: string;
  yLabel?: string;
  unit?: string;
  right?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="serif text-[22px] leading-none text-[#FFFFFF]">{title}</h3>
          <p className="font-mono mt-2 text-[10.5px] text-[#8E8E93]">
            {yLabel && `Y: ${yLabel}${unit ? ` (${unit})` : ""}`}
            {xLabel && ` · X: ${xLabel}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sim && <Badge tone="sim">SIMULATED</Badge>}
          {right}
        </div>
      </div>
      {children}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.08)] pt-3">
        <div className="flex flex-wrap gap-3">
          {legend?.map((l) => (
            <span
              key={l.name}
              className="font-mono flex items-center gap-1.5 text-[10.5px] text-[#D6D6D9]"
            >
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
        <p className="font-mono text-[10px] text-[#6E6E73]">Source: {source}</p>
      </div>
    </Card>
  );
}

function axes(xmin: number, xmax: number, ymin: number, ymax: number) {
  const sx = (x: number) => M.l + ((x - xmin) / (xmax - xmin || 1)) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - ((y - ymin) / (ymax - ymin || 1)) * (H - M.t - M.b);
  const ticks = [0, 1, 2, 3, 4].map((i) => ymin + ((ymax - ymin) * i) / 4);
  const xt = [0, 1, 2, 3, 4].map((i) => xmin + ((xmax - xmin) * i) / 4);
  return { sx, sy, ticks, xt };
}
function Grid({
  a,
  ymin,
  ymax,
  xLabel,
  yLabel,
}: {
  a: ReturnType<typeof axes>;
  ymin: number;
  ymax: number;
  xLabel?: string;
  yLabel?: string;
}) {
  void ymin;
  void ymax;
  return (
    <g className="font-mono" fontSize="10" fill="#8E8E93">
      {a.ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={M.l}
            x2={W - M.r}
            y1={a.sy(t)}
            y2={a.sy(t)}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="3 4"
          />
          <text x={M.l - 8} y={a.sy(t) + 3} textAnchor="end">
            {nice(t)}
          </text>
        </g>
      ))}
      {a.xt.map((t, i) => (
        <text key={i} x={a.sx(t)} y={H - M.b + 16} textAnchor="middle">
          {nice(t)}
        </text>
      ))}
      {xLabel && (
        <text x={(W + M.l) / 2} y={H - 6} textAnchor="middle" fill="#FFCC00">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text transform={`translate(12 ${H / 2}) rotate(-90)`} textAnchor="middle" fill="#FFCC00">
          {yLabel}
        </text>
      )}
    </g>
  );
}

export function LineChart({
  series,
  xLabel,
  yLabel,
  unit,
}: {
  series: Series[];
  xLabel: string;
  yLabel: string;
  unit?: string;
}) {
  const [hover, setHover] = useState<{ i: number } | null>(null);
  const all = series.flatMap((s) => s.points);
  if (!all.length)
    return <p className="py-10 text-center text-sm text-muted">No numeric points to plot.</p>;
  const xmin = Math.min(...all.map((p) => p[0])),
    xmax = Math.max(...all.map((p) => p[0]));
  let ymin = Math.min(...all.map((p) => p[1])),
    ymax = Math.max(...all.map((p) => p[1]));
  const pad = (ymax - ymin || 1) * 0.1;
  ymin -= pad;
  ymax += pad;
  const a = axes(xmin, xmax, ymin, ymax);
  const base = series[0].points;
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const v = xmin + ((x - M.l) / (W - M.l - M.r)) * (xmax - xmin);
    let best = 0;
    base.forEach((p, i) => {
      if (Math.abs(p[0] - v) < Math.abs(base[best][0] - v)) best = i;
    });
    setHover({ i: best });
  };
  const hp = hover ? base[hover.i] : null;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${yLabel} over ${xLabel}`}
      >
        <Grid a={a} ymin={ymin} ymax={ymax} xLabel={xLabel} yLabel={yLabel} />
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.points.map((p) => `${a.sx(p[0])},${a.sy(p[1])}`).join(" ")}
          />
        ))}
        {hp && (
          <line
            x1={a.sx(hp[0])}
            x2={a.sx(hp[0])}
            y1={M.t}
            y2={H - M.b}
            stroke="#FFCC00"
            strokeOpacity=".45"
          />
        )}
        {hp &&
          series.map((s) => {
            const p = s.points.find((q) => q[0] === hp[0]);
            return p ? (
              <circle
                key={s.name}
                cx={a.sx(p[0])}
                cy={a.sy(p[1])}
                r="4"
                fill="#0B0B0C"
                stroke={s.color}
                strokeWidth="2"
              />
            ) : null;
          })}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-2 rounded-[2px] border border-[#FFCC00]/45 bg-[#121214] px-3 py-2 text-[11px] text-[#FFFFFF]"
          style={{ left: `${Math.min(75, (a.sx(hp[0]) / W) * 100)}%` }}
        >
          <p className="font-mono opacity-70">
            {xLabel}: {nice(hp[0])}
          </p>
          {series.map((s) => {
            const p = s.points.find((q) => q[0] === hp[0]);
            return p ? (
              <p key={s.name}>
                <i
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.name}: {nice(p[1])}
                {unit ? ` ${unit}` : ""}
              </p>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

export function BarChart({
  bars,
  yLabel,
  xLabel,
  unit,
}: {
  bars: { label: string; value: number; color: string }[];
  yLabel: string;
  xLabel: string;
  unit?: string;
}) {
  const [h, setH] = useState<number | null>(null);
  const ymax = Math.max(...bars.map((b) => b.value), 0) * 1.15 || 1,
    ymin = Math.min(0, ...bars.map((b) => b.value));
  const a = axes(0, bars.length, ymin, ymax);
  const bw = (W - M.l - M.r) / bars.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`${yLabel} by ${xLabel}`}
    >
      <Grid a={{ ...a, xt: [] }} ymin={ymin} ymax={ymax} xLabel={xLabel} yLabel={yLabel} />
      {bars.map((b, i) => (
        <g key={b.label} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)}>
          <rect
            x={M.l + i * bw + bw * 0.2}
            width={bw * 0.6}
            y={Math.min(a.sy(b.value), a.sy(0))}
            height={Math.abs(a.sy(b.value) - a.sy(0))}
            rx="6"
            fill={b.color}
            opacity={h === null || h === i ? 1 : 0.45}
          />
          <text
            className="font-mono"
            fontSize="10"
            fill="#8E8E93"
            x={M.l + i * bw + bw / 2}
            y={H - M.b + 16}
            textAnchor="middle"
          >
            {b.label}
          </text>
          {h === i && (
            <text
              className="font-mono"
              fontSize="11"
              fill="#FFFFFF"
              x={M.l + i * bw + bw / 2}
              y={a.sy(b.value) - 6}
              textAnchor="middle"
            >
              {nice(b.value)}
              {unit ? ` ${unit}` : ""}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function Scatter({
  points,
  color,
  xLabel,
  yLabel,
}: {
  points: Pt[];
  color: string;
  xLabel: string;
  yLabel: string;
}) {
  const [h, setH] = useState<number | null>(null);
  if (!points.length)
    return <p className="py-10 text-center text-sm text-muted">No points to plot.</p>;
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const a = axes(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`${yLabel} vs ${xLabel}`}
    >
      <Grid a={a} ymin={0} ymax={0} xLabel={xLabel} yLabel={yLabel} />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={a.sx(p[0])}
          cy={a.sy(p[1])}
          r={h === i ? 6 : 4}
          fill={color}
          fillOpacity=".75"
          stroke="#0B0B0C"
          onMouseEnter={() => setH(i)}
          onMouseLeave={() => setH(null)}
        />
      ))}
      {h !== null && (
        <text
          className="font-mono"
          fontSize="11"
          fill="#FFFFFF"
          x={a.sx(points[h][0])}
          y={a.sy(points[h][1]) - 10}
          textAnchor="middle"
        >
          ({nice(points[h][0])}, {nice(points[h][1])})
        </text>
      )}
    </svg>
  );
}

export function Histogram({
  values,
  color,
  xLabel,
  unit,
}: {
  values: number[];
  color: string;
  xLabel: string;
  unit?: string;
}) {
  if (!values.length)
    return <p className="py-10 text-center text-sm text-muted">No numeric values.</p>;
  const min = Math.min(...values),
    max = Math.max(...values),
    n = 10,
    step = (max - min || 1) / n;
  const bins = Array.from(
    { length: n },
    (_, i) =>
      values.filter(
        (v) => v >= min + i * step && (i === n - 1 ? v <= max : v < min + (i + 1) * step),
      ).length,
  );
  return (
    <BarChart
      bars={bins.map((c, i) => ({ label: nice(min + i * step), value: c, color }))}
      yLabel="Count"
      xLabel={`${xLabel}${unit ? ` (${unit})` : ""}`}
    />
  );
}

export function Heatmap({
  rows,
  cols,
  values,
  color,
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  color: string;
}) {
  const [h, setH] = useState<string | null>(null);
  const flat = values.flat(),
    min = Math.min(...flat),
    max = Math.max(...flat);
  return (
    <div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `90px repeat(${cols.length}, 1fr)` }}
      >
        <span />
        {cols.map((c) => (
          <span key={c} className="font-mono truncate text-center text-[10px] text-muted">
            {c}
          </span>
        ))}
        {rows.map((r, i) => (
          <div key={r} className="contents">
            <span className="font-mono truncate pr-2 text-right text-[10px] leading-7 text-muted">
              {r}
            </span>
            {cols.map((c, j) => {
              const t = (values[i][j] - min) / (max - min || 1);
              return (
                <button
                  key={c}
                  onMouseEnter={() => setH(`${r} / ${c}: ${values[i][j].toFixed(2)}`)}
                  onMouseLeave={() => setH(null)}
                  className="h-7 rounded-[2px]"
                  style={{ background: color, opacity: 0.12 + t * 0.88 }}
                  aria-label={`${r} ${c} ${values[i][j].toFixed(2)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="font-mono mt-3 h-4 text-[10.5px] text-navy">
        {h ?? "Hover a cell for its value (z-scored expression, arbitrary units)"}
      </p>
    </div>
  );
}
