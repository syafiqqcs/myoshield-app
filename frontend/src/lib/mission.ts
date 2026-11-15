import type { Domain } from "./data";

/**
 * Cinematic landing-page data for the five crew profiles.
 *
 * Values are demonstration baseline readings shaped to match the CREW records in
 * `crew.ts`. They never come from a real person, and no sensor is connected.
 */
export type MissionProfile = {
  heroImage: string;
  /** Painted behind the image so a failed download still leaves an orbital scene. */
  fallback: string;
  missionDays: number;
  cumulativeDose: number;
  summary: string;
  baseline: {
    heartRate: number;
    spo2: number;
    respiration: number;
    coreTemp: number;
  };
  /** Normalised 0–1 cross-stressor alert level per physiological domain. */
  thresholds: Record<Domain, number>;
  /** Combined-index level at which the synergy rule fires. */
  synergyThreshold: number;
};

export const CREW_MISSION: Record<string, MissionProfile> = {
  "AST-01": {
    heroImage:
      "https://images.unsplash.com/photo-1541873676-a18131494184?auto=format&fit=crop&w=1600&q=85",
    fallback:
      "radial-gradient(110% 80% at 72% 18%, #263a4c 0%, #111820 46%, #050607 100%), linear-gradient(180deg, #0a0c10 0%, #050506 100%)",
    missionDays: 142,
    cumulativeDose: 18.4,
    summary:
      "Commander and cardiovascular lead. Six months of microgravity exposure with stable cardiac output, an intact baroreflex response and no vestibular symptoms reported.",
    baseline: { heartRate: 62, spo2: 98, respiration: 15, coreTemp: 36.8 },
    thresholds: {
      radiation: 0.62,
      musculoskeletal: 0.58,
      vestibular: 0.54,
      cardiovascular: 0.66,
    },
    synergyThreshold: 0.72,
  },
  "AST-02": {
    heroImage:
      "https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=1600&q=85",
    fallback:
      "radial-gradient(120% 90% at 62% 22%, #16344f 0%, #0a1420 48%, #040507 100%), linear-gradient(180deg, #071018 0%, #040507 100%)",
    missionDays: 96,
    cumulativeDose: 24.1,
    summary:
      "Flight engineer running the Node 3 rack rebuild. Musculoskeletal load is elevated after consecutive EVA training blocks, and recovery markers are trending down.",
    baseline: { heartRate: 84, spo2: 96, respiration: 18, coreTemp: 37.1 },
    thresholds: {
      radiation: 0.6,
      musculoskeletal: 0.52,
      vestibular: 0.56,
      cardiovascular: 0.64,
    },
    synergyThreshold: 0.68,
  },
  "AST-03": {
    heroImage:
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1600&q=85",
    fallback:
      "radial-gradient(120% 100% at 50% 12%, #18384b 0%, #0a1a26 42%, #040608 100%), linear-gradient(180deg, #08141c 0%, #040608 100%)",
    missionDays: 188,
    cumulativeDose: 31.7,
    summary:
      "EVA specialist carrying the highest cumulative radiation load on the crew. Dose rate remains inside the 30-day threshold, with south Atlantic anomaly passes flagged for review.",
    baseline: { heartRate: 58, spo2: 99, respiration: 14, coreTemp: 36.7 },
    thresholds: {
      radiation: 0.7,
      musculoskeletal: 0.56,
      vestibular: 0.52,
      cardiovascular: 0.62,
    },
    synergyThreshold: 0.74,
  },
  "AST-04": {
    heroImage:
      "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1600&q=85",
    fallback:
      "radial-gradient(120% 90% at 68% 20%, #4a2b1c 0%, #1c1114 46%, #060405 100%), linear-gradient(180deg, #150c0b 0%, #060405 100%)",
    missionDays: 64,
    cumulativeDose: 9.8,
    summary:
      "Biomedical officer overseeing the crew countermeasure protocol. Vestibular adaptation is nominal, and postural sway has settled across the last seven days.",
    baseline: { heartRate: 66, spo2: 98, respiration: 16, coreTemp: 36.9 },
    thresholds: {
      radiation: 0.58,
      musculoskeletal: 0.6,
      vestibular: 0.48,
      cardiovascular: 0.68,
    },
    synergyThreshold: 0.7,
  },
  "AST-05": {
    heroImage:
      "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=1600&q=85",
    fallback:
      "radial-gradient(110% 85% at 58% 18%, #2d3038 0%, #14161b 48%, #060607 100%), linear-gradient(180deg, #101114 0%, #060607 100%)",
    missionDays: 121,
    cumulativeDose: 15.2,
    summary:
      "Payload specialist supporting the materials science payload. Strength retention is stable, and sleep debt is the only open item on the countermeasure list.",
    baseline: { heartRate: 64, spo2: 98, respiration: 15, coreTemp: 36.8 },
    thresholds: {
      radiation: 0.6,
      musculoskeletal: 0.56,
      vestibular: 0.54,
      cardiovascular: 0.64,
    },
    synergyThreshold: 0.71,
  },
};

/** The five registered .joblib artefacts and their fusion-layer weights. */
export const JOBLIB_MODELS: {
  key: string;
  name: string;
  file: string;
  weight: number;
}[] = [
  {
    key: "radiation",
    name: "Radiation anomaly",
    file: "radiation_model_v1.joblib",
    weight: 0.2,
  },
  {
    key: "musculoskeletal",
    name: "Musculoskeletal expression",
    file: "muscle_model_v1.joblib",
    weight: 0.2,
  },
  {
    key: "vestibular",
    name: "Vestibular classifier",
    file: "vestibular_model_v1.joblib",
    weight: 0.15,
  },
  {
    key: "cardiovascular",
    name: "Cardiovascular anomaly",
    file: "cardiovascular_model_v1.joblib",
    weight: 0.25,
  },
  {
    key: "integrated",
    name: "Cross-system fusion",
    file: "integrated_health_model_v1.joblib",
    weight: 0.2,
  },
];
