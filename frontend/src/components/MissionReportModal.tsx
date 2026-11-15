import { useCallback, useEffect, useMemo, useRef } from "react";
import { useApp } from "../lib/store";
import { cancelAlertAudio, triggerAnalysisAlert } from "../lib/audioAlerts";
import {
  buildMissionReport,
  classificationToneFor,
  type MissionReport,
  type ReportDomain,
  type ReportTone,
} from "../lib/report";
import { Badge, Btn, Icon } from "./ui";

const TONE_STYLE: Record<ReportTone, { color: string; border: string; background: string }> = {
  neutral: { color: "#8E8E93", border: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" },
  success: { color: "#35D6C0", border: "rgba(53,214,192,0.4)", background: "rgba(53,214,192,0.1)" },
  warning: { color: "#F5A623", border: "rgba(245,166,35,0.45)", background: "rgba(245,166,35,0.1)" },
  critical: { color: "#F06464", border: "rgba(240,100,100,0.5)", background: "rgba(240,100,100,0.12)" },
};

function tone(classification: string): ReportTone {
  return classificationToneFor(classification);
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#6E6E73]">{label}</p>
      <p className="mt-1 break-words text-[13px] leading-[1.35] text-[#FFFFFF]">{value}</p>
    </div>
  );
}

function DomainPanel({ domain }: { domain: ReportDomain }) {
  const style = TONE_STYLE[domain.statusTone];
  return (
    <section className="report-domain hud-panel overflow-hidden rounded-[2px] border border-white/[0.08] bg-[#121214]">
      <div className="report-domain-bar h-[3px]" style={{ background: domain.color }} />
      <div className="p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p
              className="font-mono text-[9.5px] uppercase tracking-[0.16em]"
              style={{ color: domain.color }}
            >
              {domain.short.toUpperCase()} // .JOBLIB OUTPUT
            </p>
            <h3 className="serif mt-1 text-[22px] leading-none text-[#FFFFFF]">{domain.label}</h3>
          </div>
          <span
            className="font-mono inline-flex items-center rounded-[2px] border px-2 py-1 text-[9px] uppercase tracking-[0.1em]"
            style={{ color: style.color, borderColor: style.border, background: style.background }}
          >
            {domain.status}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
          <div className="rounded-[2px] border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] tracking-[0.14em] text-[#8E8E93]">RISK SCORE</p>
            <p
              className="font-mono mt-1 text-[28px] leading-none tabular-nums"
              style={{ color: domain.riskScore === null ? "#6E6E73" : style.color }}
            >
              {domain.riskLabel}
            </p>
            <div className="gauge-track mt-2 h-[5px] overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(3, Math.min(100, (domain.riskScore ?? 0) * 100))}%`,
                  background: domain.statusTone === "neutral" ? "#6E6E73" : style.color,
                }}
              />
            </div>
          </div>
          <div className="rounded-[2px] border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] tracking-[0.14em] text-[#8E8E93]">
              MODEL CONFIDENCE
            </p>
            <p className="font-mono mt-1 text-[28px] leading-none tabular-nums text-[#FFCC00]">
              {domain.confidence !== null ? `${domain.confidence.toFixed(1)}%` : "—"}
            </p>
            <p className="font-mono mt-2 text-[9px] text-[#6E6E73]">
              {domain.confidence !== null ? "decision-margin estimate" : "no model run"}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-[2px] border border-[#FFCC00]/20 bg-[#FFCC00]/[0.04] p-3">
          <p className="font-mono text-[9px] tracking-[0.14em] text-[#8E8E93]">KEY METRIC</p>
          <p className="mt-1 text-[13.5px] font-medium text-[#FFFFFF]">{domain.keyMetric}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px border border-white/[0.08] bg-white/[0.08]">
          {domain.subMetrics.map((metric) => (
            <div key={`${domain.key}-${metric.label}`} className="bg-[#121214] p-3">
              <p className="font-mono text-[8.5px] uppercase leading-[1.4] tracking-[0.1em] text-[#8E8E93]">
                {metric.label}
              </p>
              <p className="font-mono mt-1.5 text-[15px] leading-none tabular-nums text-[#FFFFFF]">
                {String(metric.value)}
                {metric.unit && (
                  <span className="ml-1.5 text-[9.5px] text-[#8E8E93]">{metric.unit}</span>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <p className="font-mono text-[9px] tracking-[0.14em]" style={{ color: domain.color }}>
            RECOMMENDED ISS COUNTERMEASURES
          </p>
          <ul className="mt-2 space-y-1.5">
            {domain.countermeasures.map((measure) => (
              <li
                key={measure}
                className="flex gap-2 text-[12px] leading-[1.45] text-[#D6D6D9]"
              >
                <Icon name="check" size={12} className="mt-0.5 shrink-0 text-[#FFCC00]" />
                <span>{measure}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-3 line-clamp-3 text-[11.5px] leading-[1.5] text-[#8E8E93]">
          {domain.summary}
        </p>
        <p className="font-mono mt-2 break-words text-[9.5px] text-[#6E6E73]">
          {domain.modelUsed}
        </p>
      </div>
    </section>
  );
}

export default function MissionReportModal() {
  const { reportRequest, closeReport, subjects, latestBySubject, notify } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastAlert = useRef<string | null>(null);

  const handleClose = useCallback(() => {
    cancelAlertAudio();
    closeReport();
  }, [closeReport]);

  const snapshot = reportRequest
    ? (reportRequest.snapshot ?? latestBySubject[reportRequest.subjectId] ?? null)
    : null;

  const report: MissionReport | null = useMemo(() => {
    if (!reportRequest) return null;
    return buildMissionReport({
      snapshot,
      subjectId: reportRequest.subjectId,
      subjects,
    });
  }, [reportRequest, snapshot, subjects]);

  // A live report carrying a warning/critical classification gets the same
  // spacecraft chime + spoken alert as the rescue overlay. Baseline reports
  // and nominal results stay silent.
  useEffect(() => {
    if (!reportRequest || !snapshot) {
      lastAlert.current = null;
      return;
    }
    const result = snapshot.result;
    const key = `${snapshot.at}|${result.analysis_id}|${result.status}|${result.interaction_type}`;
    if (lastAlert.current === key) return;
    lastAlert.current = key;
    triggerAnalysisAlert(result);
  }, [reportRequest, snapshot]);

  useEffect(() => {
    if (!reportRequest) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
      cancelAlertAudio();
    };
  }, [reportRequest, handleClose]);

  if (!reportRequest || !report) return null;

  const classStyle = TONE_STYLE[tone(report.classification)];
  const cleanDownload = (filename: string, content: string, mime: string) => {
    downloadFile(filename, content, mime);
    notify(`Downloaded ${filename}`);
  };

  return (
    <div className="report-overlay fixed inset-0 z-[70] flex items-center justify-center p-2 md:p-5">
      <button
        type="button"
        aria-label="Dismiss mission report preview"
        onClick={handleClose}
        className="no-print absolute inset-0 bg-[#000000]/88 backdrop-blur-md"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-report-title"
        tabIndex={-1}
        className="report-modal relative flex max-h-[96vh] w-full max-w-[1140px] flex-col overflow-hidden rounded-[2px] border border-[#FFCC00]/45 bg-[#121214] text-[#FFFFFF] outline-none"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 z-20 h-[3px] bg-[#FFCC00]" />

        <header className="no-print shrink-0 border-b border-white/[0.08] bg-[#121214] px-4 pb-4 pt-5 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono flex flex-wrap items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-[#FFCC00]">
                <span>Mission report // preview</span>
                <span className="text-[#6E6E73]">·</span>
                <span className="text-[#8E8E93]">{report.generatedUtc}</span>
              </p>
              <h2
                id="mission-report-title"
                className="serif mt-2 text-[25px] leading-[1.02] text-[#FFFFFF] md:text-[32px]"
              >
                Biomedical Telemetry &amp; Countermeasure Report
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="real">{report.subjectId}</Badge>
                <Badge>{report.astronautName}</Badge>
                <Badge>{report.issModule}</Badge>
                <span
                  className="font-mono inline-flex items-center rounded-[2px] border px-2 py-1 text-[9px] uppercase tracking-[0.1em]"
                  style={{
                    color: classStyle.color,
                    borderColor: classStyle.border,
                    background: classStyle.background,
                  }}
                >
                  {report.classification}
                </span>
                {report.baseline && <Badge tone="warning">BASELINE TELEMETRY SNAPSHOT</Badge>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Btn
                icon="download"
                onClick={() =>
                  cleanDownload(report.filename, report.markdown, "text/markdown;charset=utf-8")
                }
              >
                Download Report (.md)
              </Btn>
              <Btn
                variant="outline"
                icon="download"
                onClick={() =>
                  cleanDownload(report.textFilename, report.plainText, "text/plain;charset=utf-8")
                }
              >
                .txt
              </Btn>
              <Btn variant="outline" icon="file" onClick={() => window.print()}>
                Print / Save as PDF
              </Btn>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close mission report"
                className="grid h-10 w-10 place-items-center rounded-[2px] border border-white/[0.08] bg-[#121214] text-[#8E8E93] transition hover:border-[#FFCC00]/60 hover:text-[#FFCC00]"
              >
                <Icon name="x" size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="report-modal-scroll min-h-0 flex-1 overflow-y-auto">
          <article className="report-print-area bg-[#121214] px-4 py-5 md:px-8 md:py-7">
            <div className="border-b border-white/[0.08] pb-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#FFCC00]">
                    MYOSHIELD // Crew Biomedical Division
                  </p>
                  <h1 className="serif mt-2 max-w-[720px] text-[30px] leading-[0.98] text-[#FFFFFF] md:text-[42px]">
                    MYOSHIELD Biomedical Telemetry &amp; Countermeasure Report
                  </h1>
                  <p className="font-mono mt-3 text-[10px] uppercase tracking-[0.12em] text-[#8E8E93]">
                    {report.reportId} · {report.generatedUtc}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <span
                    className="font-mono inline-flex items-center rounded-[2px] border px-3 py-1.5 text-[10px] uppercase tracking-[0.12em]"
                    style={{
                      color: classStyle.color,
                      borderColor: classStyle.border,
                      background: classStyle.background,
                    }}
                  >
                    {report.classification}
                  </span>
                  {report.baseline ? (
                    <span className="font-mono inline-flex items-center rounded-[2px] border border-[#F5A623]/50 bg-[#F5A623]/10 px-2.5 py-1 text-[8.5px] uppercase tracking-[0.12em] text-[#F2C46B]">
                      BASELINE TELEMETRY SNAPSHOT
                    </span>
                  ) : (
                    <span className="font-mono inline-flex items-center rounded-[2px] border border-[#FFCC00]/35 bg-[#FFCC00]/10 px-2.5 py-1 text-[8.5px] uppercase tracking-[0.12em] text-[#FFCC00]">
                      LIVE .JOBLIB TELEMETRY
                    </span>
                  )}
                </div>
              </div>

              {report.baseline && (
                <p className="mt-4 border-l-2 border-[#F5A623] bg-[#F5A623]/[0.06] px-3 py-2 text-[12px] leading-[1.5] text-[#F2C46B]">
                  No dataset has been analysed for this astronaut yet. This baseline crew readiness
                  report uses the astronaut&apos;s current baseline vitals and model-ready defaults,
                  not .joblib inference output.
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-4 border-b border-white/[0.08] pb-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Astronaut" value={`${report.astronautName} (${report.subjectId})`} />
              <Field
                label="Assigned ISS module"
                value={`${report.issModule} · ${report.astronautRole}`}
              />
              <Field
                label="Mission duration"
                value={
                  report.missionDays !== null
                    ? `${report.missionDays} days · ${report.missionLabel}`
                    : report.missionLabel
                }
              />
              <Field label="Dataset / file" value={report.datasetName} />
              <Field label="Dataset type" value={report.datasetKind} />
              <Field label="Analysis ID" value={report.analysisId} />
              <Field
                label="Mission readiness"
                value={`${report.readiness.toFixed(1)}% · ${report.readinessLabel}`}
              />
              <Field
                label="Integrated strain"
                value={report.strain !== null ? report.strain.toFixed(3) : "— (baseline)"}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Heart rate" value={`${report.vitals.heartRate.toFixed(0)} bpm`} />
              <Field label="Blood oxygen" value={`${report.vitals.spo2.toFixed(1)}% SpO₂`} />
              <Field
                label="Respiration"
                value={`${report.vitals.respiration.toFixed(0)} breaths/min`}
              />
              <Field label="Core temperature" value={`${report.vitals.coreTemp.toFixed(1)} °C`} />
            </div>

            <div className="mt-4 rounded-[2px] border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#FFCC00]">
                CLASSIFICATION REASON
              </p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-[#D6D6D9]">
                {report.classificationReason}
              </p>
            </div>

            <div className="mt-6 flex items-end justify-between gap-3 border-b border-white/[0.08] pb-2">
              <h2 className="serif text-[24px] leading-none text-[#FFFFFF]">
                Four-domain health panel
              </h2>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6E6E73]">
                {report.domains.length} domains · {report.models.length} .joblib artefacts
              </p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {report.domains.map((domain) => (
                <DomainPanel key={domain.key} domain={domain} />
              ))}
            </div>

            <div className="mt-6 border-b border-white/[0.08] pb-2">
              <h2 className="serif text-[24px] leading-none text-[#FFFFFF]">
                .joblib model confidence
              </h2>
            </div>
            <div className="mt-3 overflow-x-auto rounded-[2px] border border-white/[0.08]">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Artefact</th>
                    <th>Fusion weight</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.models.map((model) => (
                    <tr key={model.key}>
                      <td>{model.name}</td>
                      <td className="font-mono text-[10.5px] text-[#8E8E93]">{model.file}</td>
                      <td className="font-mono tabular-nums">{model.weight.toFixed(2)}</td>
                      <td className="font-mono tabular-nums text-[#FFCC00]">
                        {model.confidence !== null ? `${model.confidence.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-mono mt-2 text-[9.5px] leading-[1.5] text-[#6E6E73]">
              Confidence is derived from each model&apos;s separation from its 0.50 decision boundary
              unless the artefact returns an explicit class probability. It is not a clinically
              calibrated probability.
            </p>

            {report.insights.length > 0 && (
              <>
                <div className="mt-6 border-b border-white/[0.08] pb-2">
                  <h2 className="serif text-[24px] leading-none text-[#FFFFFF]">
                    Cross-system insights
                  </h2>
                </div>
                <div className="mt-3 space-y-2">
                  {report.insights.map((insight) => (
                    <div
                      key={insight.title}
                      className="rounded-[2px] border border-white/[0.08] bg-white/[0.02] p-3"
                    >
                      <p className="text-[13px] font-semibold text-[#FFFFFF]">{insight.title}</p>
                      <p className="mt-1 text-[12px] leading-[1.5] text-[#8E8E93]">
                        {insight.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {report.protocol.length > 0 && (
              <>
                <div className="mt-6 border-b border-white/[0.08] pb-2">
                  <h2 className="serif text-[24px] leading-none text-[#FFFFFF]">
                    Integrated countermeasure protocol
                  </h2>
                </div>
                <ol className="mt-3 space-y-2">
                  {report.protocol.map((step, index) => (
                    <li key={`${step.title}-${index}`} className="flex gap-3 text-[12.5px]">
                      <span className="font-mono shrink-0 tabular-nums text-[#FFCC00]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <b className="text-[#FFFFFF]">{step.title}</b>{" "}
                        <span className="text-[#8E8E93]">{step.detail}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            <div className="mt-6 rounded-[2px] border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#FFCC00]">
                Limitations and disclaimer
              </p>
              <p className="mt-1.5 text-[11.5px] leading-[1.55] text-[#8E8E93]">
                {report.disclaimer} This report is decision support for researchers and flight
                surgeons, not a diagnosis. Environmental radiation is not personal absorbed dose,
                gene expression is not muscle strength, and motion-sickness symptoms alone do not
                establish vestibular dysfunction. Verify provenance, units and model version before
                citing or acting on this report.
              </p>
            </div>

            <p className="font-mono mt-5 text-center text-[8.5px] uppercase tracking-[0.16em] text-[#6E6E73]">
              MYOSHIELD // Crew Biomedical Division · Generated offline from live in-browser
              telemetry state
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
