import type { Domain } from "./data";

export type CrewStatus = "NOMINAL" | "ELEVATED";

export type CrewMember = {
  id: string;
  name: string;
  initials: string;
  role: string;
  module: string;
  expedition: string;
  evaHours: string;
  specialty: string;
  domain: Domain;
  readiness: number;
  hr: number;
  spo2: number;
  status: CrewStatus;
};

/**
 * Demonstration crew. Vitals and readiness are simulated, shape-matched to the
 * AST-01…AST-05 subject records in `data.ts`. They never come from a real person.
 */
export const CREW: CrewMember[] = [
  {
    id: "AST-01",
    name: "Cmdr. Elena Vance",
    initials: "EV",
    role: "Commander",
    module: "US Lab",
    expedition: "Expedition 74",
    evaHours: "42.5 h",
    specialty: "Cardiovascular",
    domain: "cardiovascular",
    readiness: 96,
    hr: 62,
    spo2: 98,
    status: "NOMINAL",
  },
  {
    id: "AST-02",
    name: "Dr. Kenji Sato",
    initials: "KS",
    role: "Flight Engineer",
    module: "Node 3",
    expedition: "Expedition 74",
    evaHours: "18.0 h",
    specialty: "Musculoskeletal",
    domain: "musculoskeletal",
    readiness: 82,
    hr: 84,
    spo2: 96,
    status: "ELEVATED",
  },
  {
    id: "AST-03",
    name: "Maj. Marcus Cole",
    initials: "MC",
    role: "EVA Specialist",
    module: "Quest Airlock",
    expedition: "Expedition 74",
    evaHours: "61.2 h",
    specialty: "Radiation",
    domain: "radiation",
    readiness: 91,
    hr: 58,
    spo2: 99,
    status: "NOMINAL",
  },
  {
    id: "AST-04",
    name: "Dr. Nadia Rahman",
    initials: "NR",
    role: "Biomedical Officer",
    module: "Columbus Lab",
    expedition: "Expedition 74",
    evaHours: "9.4 h",
    specialty: "Vestibular",
    domain: "vestibular",
    readiness: 88,
    hr: 66,
    spo2: 98,
    status: "NOMINAL",
  },
  {
    id: "AST-05",
    name: "Lt. Sofia Lindqvist",
    initials: "SL",
    role: "Payload Specialist",
    module: "Service Module",
    expedition: "Expedition 74",
    evaHours: "24.8 h",
    specialty: "Musculoskeletal",
    domain: "musculoskeletal",
    readiness: 94,
    hr: 64,
    spo2: 98,
    status: "NOMINAL",
  },
];

/** NASA-style portrait photography used by the crew grids. */
export const CREW_PHOTOS: Record<string, string> = {
  "AST-01": "https://images.unsplash.com/photo-1581822261290-991b38693d1b?auto=format&fit=crop&w=900&q=80",
  "AST-02": "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?auto=format&fit=crop&w=900&q=80",
  "AST-03": "https://images.unsplash.com/photo-1614313913007-2b4ae8ce32d6?auto=format&fit=crop&w=900&q=80",
  "AST-04": "https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=900&q=80",
  "AST-05": "https://images.unsplash.com/photo-1610296669228-602fa827fc1f?auto=format&fit=crop&w=900&q=80",
};

export const CREW_STATUS_STYLE: Record<
  CrewStatus,
  { dot: string; bg: string; text: string; label: string }
> = {
  NOMINAL: {
    dot: "#35D6C0",
    bg: "rgba(53, 214, 192, 0.1)",
    text: "#35D6C0",
    label: "NOMINAL",
  },
  ELEVATED: {
    dot: "#F5A623",
    bg: "rgba(245, 166, 35, 0.12)",
    text: "#F5A623",
    label: "ELEVATED",
  },
};
