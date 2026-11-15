# MYOSHIELD
**Predictive Multi-Domain Biotelemetry & Countermeasure System for Deep-Space Crews**

MYOSHIELD is an autonomous crew health surveillance and countermeasure platform built for the **NASA Space Apps Challenge**. Powered by five machine learning models trained in Google Colab on spaceflight physiological datasets, MYOSHIELD monitors **Radiation**, **Musculoskeletal**, and **Vestibular** telemetry in real time—detecting both isolated anomalies and compounded additive-synergistic risks before clinical symptoms emerge.

---

## Core Features
* **Multi-Domain Physiological Surveillance:** Tracks cabin radiation dose (`mSv/day`, 7-day cumulative exposure, SAA passes), musculoskeletal conditioning (`% strength retained`, bone density trends, ARED sessions), and vestibular stability (`cm postural sway`, gaze stability, motion sickness).
* **Additive-Synergistic Risk Detection:** Identifies compounded physiological stress across domains rather than relying solely on isolated single-metric thresholds.
* **Audio-Assisted Crew Triage:** Triggers a looping Web Audio telemetry chime paired with hands-free Web Speech voice protocols reading step-by-step emergency actions (e.g., limb immobilization, ARED load reduction) for microgravity response.
* **Interactive Countermeasure Companion ("Myo"):** Features a Space Bear Astronaut mascot with a first-time visitor guided tour whose alertness dynamically syncs with daily exercise countermeasure progress.

---

## Tech Stack
* **Frontend:** React / Next.js, TypeScript, Tailwind CSS, Web Audio API, Web Speech API (deployed on Vercel)
* **Backend:** Python 3.11, FastAPI, Uvicorn, scikit-learn, Pandas, NumPy (deployed on Render)
* **ML Training:** Google Colab (`scikit-learn` pipelines serialized via `joblib`)

---

## Spaceflight Data & Research References
* **Radiation:** NASA OSDR RadLab (`https://visualization.osdr.nasa.gov/radlab`)
* **Musculoskeletal:** NASA OSDR Study OSD-684 (`https://osdr.nasa.gov/bio/repo/data/studies/OSD-684`) & *Journal of Proteome Research* Vol. 16/7 (`https://pubs.acs.org/jprobs/article-abstract/16/7/2623/735335/Proteome-wide-Adaptations-of-Mouse-Skeletal`)
* **Vestibular:** NASA NTRS Citation 20260002549 (`https://ntrs.nasa.gov/citations/20260002549`), NASA NLSP Apollo Flight Crew Vestibular Assessments (`https://nlsp.nasa.gov/search/data/details/ea3075b3-6289-54c8-bbae-b6af0c515a5b?dataType=EXPERIMENTS`), & ICPSR Study 235362 (`https://www.icpsr.umich.edu/sites/icpsr/view/studies/235362/versions/V2`)
* **Systemic Biotelemetry:** PhysioNet BIDMC PPG and Respiration Dataset (`https://physionet.org/content/bidmc/1.0.0/`)

---

## Super Intelligence (SI) / AI Acknowledgment
In accordance with NASA Space Apps Challenge guidelines, Large Language Models (LLMs) were utilized during development to assist with frontend and backend code generation, UI refinement, debugging, and structuring synthetic validation telemetry (`nominal`, `additive`, and `anomaly` CSV test suites). All machine learning models were trained directly by our team in Google Colab using peer-reviewed open-science datasets, and no NASA logos or protected branding elements were generated or modified.
