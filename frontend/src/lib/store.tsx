import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DATASETS,
  SEED_ANALYSES,
  SEED_REPORTS,
  SUBJECTS,
  type Analysis,
  type Dataset,
  type Report,
  type Role,
  type Subject,
} from "./data";
import type { UploadAnalysis } from "./api";

export type Route =
  | "landing"
  | "login"
  | "overview"
  | "profiles"
  | "datasets"
  | "analysis"
  | "radiation"
  | "musculoskeletal"
  | "vestibular"
  | "cardiovascular"
  | "intelligence"
  | "reports"
  | "settings";

type Settings = {
  allowAstronautUploads: boolean;
  retentionDays: number;
  emailAlerts: boolean;
  shareByDefault: boolean;
  displayName: string;
};
type Audit = { at: string; who: string; what: string };

/** The newest real .joblib inference result, shared by every view. */
export type AnalysisSnapshot = {
  result: UploadAnalysis;
  /** ISO timestamp of when the browser received the result. */
  at: string;
  /** Uploaded filename or selected library dataset name. */
  sourceName: string;
  sourceKind: "upload" | "library";
};

/** A request to open the mission report preview for one astronaut. */
export type ReportRequest = {
  subjectId: string;
  /** Live result captured at click time; null means the baseline report. */
  snapshot: AnalysisSnapshot | null;
};

export const isCriticalAnalysis = (result: UploadAnalysis) =>
  result.status === "HIGH_STRAIN_ALERT" || result.interaction_type === "SYNERGISTIC";

type Ctx = {
  route: Route;
  go: (r: Route, opts?: { datasetId?: string; subjectId?: string; reportId?: string }) => void;
  role: Role | null;
  demo: boolean;
  signIn: (role: Role, demo: boolean, subjectId?: string) => void;
  signOut: () => void;
  datasets: Dataset[];
  addDataset: (d: Dataset) => void;
  removeDataset: (id: string) => void;
  subjects: Subject[];
  addSubject: (s: Subject) => void;
  analyses: Analysis[];
  addAnalysis: (a: Analysis) => void;
  reports: Report[];
  addReport: (r: Report) => void;
  shareReport: (id: string) => void;
  subjectId: string;
  setSubjectId: (id: string) => void;
  focusDataset: string | null;
  focusReport: string | null;
  focusSubject: string | null;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  audit: Audit[];
  log: (what: string) => void;
  toast: string;
  notify: (m: string) => void;
  analysisSeed: { datasetId?: string } | null;
  /** Increments on every go() call so single-page layouts can re-scroll to the same section. */
  navTick: number;
  /** Latest real model output for the selected astronaut; null until their first run finishes. */
  latest: AnalysisSnapshot | null;
  /** Every astronaut's latest real model output, keyed by subject ID. */
  latestBySubject: Record<string, AnalysisSnapshot>;
  publishAnalysis: (
    result: UploadAnalysis,
    meta: { sourceName: string; sourceKind: "upload" | "library"; subjectId?: string },
  ) => void;
  /** Mission report preview request; null while the modal is closed. */
  reportRequest: ReportRequest | null;
  openReport: (opts?: { subjectId?: string; snapshot?: AnalysisSnapshot | null }) => void;
  closeReport: () => void;
  /** Full-screen critical anomaly overlay, shared by the upload bar and the wizard. */
  anomalyOpen: boolean;
  setAnomalyOpen: (open: boolean) => void;
};

const C = createContext<Ctx>(null as never);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>("landing");
  const [role, setRole] = useState<Role | null>(null);
  const [demo, setDemo] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>(DATASETS);
  const [subjects, setSubjects] = useState<Subject[]>(SUBJECTS);
  const [analyses, setAnalyses] = useState<Analysis[]>(SEED_ANALYSES);
  const [reports, setReports] = useState<Report[]>(SEED_REPORTS);
  const [subjectId, setSubjectId] = useState("AST-01");
  const [focusDataset, setFD] = useState<string | null>(null);
  const [focusReport, setFR] = useState<string | null>(null);
  const [focusSubject, setFS] = useState<string | null>(null);
  const [settings, set] = useState<Settings>({
    allowAstronautUploads: true,
    retentionDays: 365,
    emailAlerts: true,
    shareByDefault: false,
    displayName: "",
  });
  const [audit, setAudit] = useState<Audit[]>([]);
  const [toast, setToast] = useState("");
  const [navTick, setNavTick] = useState(0);
  const [latestBySubject, setLatestBySubject] = useState<Record<string, AnalysisSnapshot>>({});
  const [anomalyOpen, setAnomalyOpen] = useState(false);
  const [reportRequest, setReportRequest] = useState<ReportRequest | null>(null);

  // The dashboard reads the snapshot for whichever astronaut profile is selected.
  const latest = latestBySubject[subjectId] ?? null;

  const notify = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2400);
  }, []);
  const log = useCallback(
    (what: string) =>
      setAudit((a) => [{ at: new Date().toISOString(), who: role ?? "Visitor", what }, ...a]),
    [role],
  );

  // Report actions are stable so the modal's Escape/scroll-lock effect only
  // re-runs when the request itself changes.
  const closeReport = useCallback(() => setReportRequest(null), []);
  const openReport = useCallback<Ctx["openReport"]>(
    (opts) => {
      const target = opts?.subjectId ?? subjectId;
      setReportRequest({
        subjectId: target,
        snapshot: opts?.snapshot ?? latestBySubject[target] ?? null,
      });
      log(`Mission report opened: ${target}${opts?.snapshot ? " (live)" : " (baseline)"}`);
    },
    [subjectId, latestBySubject, log],
  );

  const go: Ctx["go"] = (r, o) => {
    setFD(o?.datasetId ?? null);
    setFR(o?.reportId ?? null);
    setFS(o?.subjectId ?? null);
    setRoute(r);
    setNavTick((n) => n + 1);
    window.scrollTo({ top: 0 });
  };

  const value: Ctx = useMemo(
    () => ({
      route,
      go,
      role,
      demo,
      signIn: (r, d, nextSubjectId) => {
        setRole(r);
        setDemo(d);
        setSubjectId(nextSubjectId ?? "AST-01");
        setAudit((a) => [
          {
            at: new Date().toISOString(),
            who: r,
            what: d ? "Signed in (demonstration mode)" : "Signed in",
          },
          ...a,
        ]);
        setRoute("overview");
        window.scrollTo({ top: 0 });
      },
      signOut: () => {
        setRole(null);
        setDemo(false);
        setRoute("landing");
      },
      datasets,
      addDataset: (d) => {
        setDatasets((x) => [d, ...x]);
        log(`Dataset added: ${d.id}`);
      },
      removeDataset: (id) => {
        setDatasets((x) => x.filter((d) => d.id !== id));
        log(`Dataset removed: ${id}`);
      },
      subjects,
      addSubject: (s) => {
        setSubjects((x) => [s, ...x]);
        log(`Profile created: ${s.id}`);
      },
      analyses,
      addAnalysis: (a) => {
        setAnalyses((x) => [a, ...x]);
        log(
          `Analysis ${a.id} completed (${
            a.mode === "simulated" ? "simulated demonstration" : "real .joblib inference"
          })`,
        );
      },
      reports,
      addReport: (r) => {
        setReports((x) => [r, ...x]);
        log(`Report generated: ${r.id}`);
      },
      shareReport: (id) => {
        setReports((x) =>
          x.map((r) => (r.id === id ? { ...r, sharedWithAstronaut: !r.sharedWithAstronaut } : r)),
        );
        log(`Report sharing toggled: ${id}`);
      },
      subjectId,
      setSubjectId,
      focusDataset,
      focusReport,
      focusSubject,
      settings,
      setSettings: (s) => set((x) => ({ ...x, ...s })),
      audit,
      log,
      toast,
      notify,
      analysisSeed: null,
      navTick,
      latest,
      latestBySubject,
      publishAnalysis: (result, meta) => {
        const targetSubject = meta.subjectId ?? subjectId;
        const snapshot = {
          result,
          at: new Date().toISOString(),
          sourceName: meta.sourceName,
          sourceKind: meta.sourceKind,
        };
        setLatestBySubject((current) => ({ ...current, [targetSubject]: snapshot }));
        if (targetSubject !== subjectId) setSubjectId(targetSubject);
        setAudit((a) => [
          {
            at: new Date().toISOString(),
            who: role ?? "Visitor",
            what: `ML inference complete: ${result.analysis_id} · ${result.status} · ${result.interaction_type}`,
          },
          ...a,
        ]);
        if (isCriticalAnalysis(result)) setAnomalyOpen(true);
      },
      anomalyOpen,
      setAnomalyOpen,
      reportRequest,
      openReport,
      closeReport,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    [
      route,
      role,
      demo,
      datasets,
      subjects,
      analyses,
      reports,
      subjectId,
      focusDataset,
      focusReport,
      focusSubject,
      settings,
      audit,
      toast,
      navTick,
      latest,
      latestBySubject,
      anomalyOpen,
      reportRequest,
      openReport,
      closeReport,
    ],
  ); // go/log/notify are stable enough

  return <C.Provider value={value}>{children}</C.Provider>;
}
