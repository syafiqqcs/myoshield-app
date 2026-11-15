import copy
import glob
import io
import json
import logging
import os
import re
import threading
import warnings
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from library_datasets import build_library_specs

logger = logging.getLogger("myoshield.backend")

# The bundled scalers were fitted on plain NumPy arrays. Feeding them named
# DataFrames is intentional (the pipelines expect named columns), so silence the
# cosmetic sklearn warning without hiding any other estimator warnings.
warnings.filterwarnings(
    "ignore",
    message="X has feature names, but StandardScaler was fitted without feature names",
    category=UserWarning,
    module="sklearn.utils.validation",
)

# ------------------------------------------------------------------------------
# TRAINED ML ARTIFACT REGISTRY — every .joblib file is discovered and loaded once
# during FastAPI startup (see the lifespan handler below).
# ------------------------------------------------------------------------------
# Resolve every artifact relative to this file, never the process CWD, so the
# models load the same way under `uvicorn`, Render, Docker, or a bare script.
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = str(BASE_DIR / "models")

DOMAIN_MODEL_KEYS = ("radiation", "musculoskeletal", "vestibular", "cardiovascular")
EXPECTED_MODEL_KEYS = DOMAIN_MODEL_KEYS + ("integrated",)

MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {}
MODEL_STATUS: List[Dict[str, Any]] = []
MODEL_LOAD_LOCK = threading.Lock()

# Backwards-compatible handles populated by the startup loader for any external
# script that imports them. Internal inference uses _require_bundle() so a missing
# artifact returns a clear HTTP 503 instead of a NameError.
rad_bundle: Optional[Dict[str, Any]] = None
mus_bundle: Optional[Dict[str, Any]] = None
ves_bundle: Optional[Dict[str, Any]] = None
car_bundle: Optional[Dict[str, Any]] = None
int_bundle: Optional[Dict[str, Any]] = None


def _classify_model_bundle(bundle: Dict[str, Any], filename: str) -> Tuple[str, str]:
    """Identify a bundle from its contents rather than its filename."""
    keys = set(bundle.keys())
    if {"domain_weights", "synergy_rules"}.issubset(keys):
        return "integrated", "Cross-system fusion / interaction engine"
    if {"classifier_pipeline", "baseline_iso_pipeline"}.issubset(keys):
        return "vestibular", "RandomForest classifier + IsolationForest baseline"
    if {"gene_scaler", "selected_genes"}.issubset(keys):
        return "musculoskeletal", "Gene-expression scaler + PCA"
    if {"pipeline", "module_baselines"}.issubset(keys):
        return "radiation", "IsolationForest anomaly pipeline"
    if {"pipeline", "healthy_reference_medians"}.issubset(keys):
        return "cardiovascular", "IsolationForest anomaly pipeline"
    return os.path.splitext(filename)[0], "Unclassified joblib bundle"


def _required_features_for(key: str, bundle: Dict[str, Any]) -> List[str]:
    if key == "radiation":
        return list(bundle.get("numeric_features", [])) + list(bundle.get("categorical_features", []))
    if key in ("vestibular", "cardiovascular"):
        return list(bundle.get("feature_cols", []))
    if key == "musculoskeletal":
        return list(bundle.get("selected_genes", []))
    return []


def _load_joblib_models() -> None:
    """Load every *.joblib artifact exactly once and publish load status."""
    global rad_bundle, mus_bundle, ves_bundle, car_bundle, int_bundle

    # Compatibility shim: scikit-learn 1.7+ removed `_RemainderColsList`, which appears
    # in pickles produced by 1.6.x ColumnTransformer objects. Re-register the name so
    # older .joblib bundles unpickle cleanly.
    import sklearn.compose._column_transformer as _ct

    if not hasattr(_ct, "_RemainderColsList"):

        class _RemainderColsList(list):
            pass

        _ct._RemainderColsList = _RemainderColsList

    with MODEL_LOAD_LOCK:
        model_paths = sorted(glob.glob(os.path.join(MODELS_DIR, "*.joblib")))
        if not model_paths:
            raise RuntimeError(f"No .joblib model files found in {MODELS_DIR}")

        registry: Dict[str, Dict[str, Any]] = {}
        status_entries: List[Dict[str, Any]] = []

        for path in model_paths:
            filename = os.path.basename(path)
            try:
                bundle = joblib.load(path)
            except Exception as exc:  # pragma: no cover - startup failure path
                raise RuntimeError(f"Failed to load ML model {path}: {exc}") from exc

            bundle_dict = bundle if isinstance(bundle, dict) else {}
            logical_key, kind = _classify_model_bundle(bundle_dict, filename)
            unique_key = logical_key
            suffix = 2
            while unique_key in registry:
                unique_key = f"{logical_key}_{suffix}"
                suffix += 1
            registry[unique_key] = bundle

            features = _required_features_for(logical_key, bundle_dict)
            status_entries.append(
                {
                    "key": logical_key,
                    "name": bundle_dict.get("model_name", os.path.splitext(filename)[0])
                    if isinstance(bundle, dict)
                    else os.path.splitext(filename)[0],
                    "filename": filename,
                    "kind": kind,
                    "feature_count": len(features),
                    "features": features[:24],
                    "loaded": True,
                }
            )

        MODEL_REGISTRY.clear()
        MODEL_REGISTRY.update(registry)
        MODEL_STATUS.clear()
        MODEL_STATUS.extend(status_entries)

        rad_bundle = registry.get("radiation")
        mus_bundle = registry.get("musculoskeletal")
        ves_bundle = registry.get("vestibular")
        car_bundle = registry.get("cardiovascular")
        int_bundle = registry.get("integrated")

    names = ", ".join(entry["name"] for entry in MODEL_STATUS)
    logger.info("Loaded %d .joblib model(s) from %s: %s", len(MODEL_STATUS), MODELS_DIR, names)


def _require_bundle(key: str) -> Dict[str, Any]:
    """Return a loaded bundle, lazily triggering startup loading if needed."""
    bundle = MODEL_REGISTRY.get(key)
    if bundle is None and not MODEL_REGISTRY:
        _load_joblib_models()
        bundle = MODEL_REGISTRY.get(key)
    if not isinstance(bundle, dict):
        raise HTTPException(
            status_code=503,
            detail=f"ML model '{key}' is not loaded. Check GET /api/health/models-status.",
        )
    return bundle


@asynccontextmanager
async def lifespan(_: FastAPI):
    _load_joblib_models()
    yield


app = FastAPI(
    title="MYOSHIELD Astronaut Health Intelligence API",
    description="NASA Space Apps Challenge 2026 — Multimodal Physiological & Space Environment ML Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for the deployed Vercel frontend plus the local Vite preview.
# Set ALLOWED_ORIGINS to a comma-separated allowlist in production, e.g.
#   ALLOWED_ORIGINS=https://myoshield.vercel.app,https://myoshield-git-main.vercel.app
# Omit it (the default) to allow every origin so Vercel preview URLs keep working.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# PYDANTIC REQUEST SCHEMAS
# ------------------------------------------------------------------------------
class RadiationInput(BaseModel):
    absorbed_dose_rate: float = Field(..., example=15.4, description="Environmental absorbed dose rate")
    rolling_mean_7d: float = Field(..., example=13.2, description="7-day trailing average dose rate")
    dose_delta_1d: float = Field(0.0, example=2.1, description="24-hour dose rate delta")
    instrument: str = Field("RAD", example="RAD", description="RAD or IV-TEPC")
    module: str = Field("US Lab", example="Node 3", description="ISS module name")
    mode: str = Field("LIVE_MODEL", example="DEMO_SIMULATION")

class MuscleInput(BaseModel):
    condition: str = Field("Space_Flight", example="Space_Flight", description="Ground_Control or Space_Flight")
    age_group: str = Field("Young_21_40", example="Young_21_40", description="Young_21_40 or Older_65_80")
    gene_overrides: Optional[Dict[str, float]] = Field(
        default=None,
        description="Optional log2 expression overrides for specific biomarker genes (e.g., {'RPL28': 11.5, 'MRPS34': 9.2})"
    )
    mode: str = Field("LIVE_MODEL", example="DEMO_SIMULATION")

class VestibularInput(BaseModel):
    head_vel_hor_std: float = Field(..., example=52.0)
    head_vel_ver_std: float = Field(..., example=3.8)
    head_acc_hor_rms: float = Field(..., example=1.0)
    eye_vel_hor_std: float = Field(..., example=165.0)
    eye_vel_ver_std: float = Field(..., example=18.0)
    eye_peak_vel_p95: float = Field(..., example=280.0)
    vor_gain_proxy: float = Field(..., example=1.62)
    eye_head_corr: float = Field(..., example=-0.42)
    eye_to_head_rms_ratio: float = Field(..., example=1.55)
    mode: str = Field("LIVE_MODEL", example="DEMO_SIMULATION")

class CardiovascularInput(BaseModel):
    hr_mean: float = Field(..., example=92.0, description="Heart rate in BPM")
    hr_std: float = Field(1.5, example=2.1)
    hrv_rmssd_ms: float = Field(..., example=38.0, description="Beat-to-beat HRV RMSSD in ms")
    hrv_sdnn_ms: float = Field(..., example=34.0, description="Beat-to-beat HRV SDNN in ms")
    spo2_mean: float = Field(..., example=97.2, description="Oxygen saturation %")
    spo2_min: float = Field(96.0, example=96.0)
    resp_mean: float = Field(..., example=18.0, description="Respiratory rate breaths/min")
    resp_std: float = Field(0.7, example=0.8)
    mode: str = Field("LIVE_MODEL", example="DEMO_SIMULATION")

class IntegratedHealthInput(BaseModel):
    astronaut_id: str = Field("AST-01", example="AST-01")
    radiation: RadiationInput
    muscle: MuscleInput
    vestibular: VestibularInput
    cardiovascular: CardiovascularInput
    mode: str = Field("DEMO_SIMULATION", example="DEMO_SIMULATION")

# ------------------------------------------------------------------------------
# INTERNAL INFERENCE HELPERS
# ------------------------------------------------------------------------------
def run_radiation_inference(data: RadiationInput) -> dict:
    bundle = _require_bundle("radiation")
    mod_stats = bundle["module_baselines"].get(data.module, {"mean": 12.6, "std": 2.5})
    std_safe = max(float(mod_stats["std"]), 0.25)
    rolling_z = (data.absorbed_dose_rate - data.rolling_mean_7d) / std_safe

    row = pd.DataFrame([{
        "absorbed_dose_rate": data.absorbed_dose_rate,
        "rolling_mean_7d": data.rolling_mean_7d,
        "dose_delta_1d": data.dose_delta_1d,
        "rolling_zscore": rolling_z,
        "instrument": data.instrument,
        "module": data.module
    }])

    pipe = bundle["pipeline"]
    pred = int(pipe.predict(row)[0])  # -1 anomaly, 1 normal
    raw_score = float(-pipe.decision_function(row)[0])
    s_min, s_max = bundle["score_min"], bundle["score_max"]
    risk_score = float(np.clip((raw_score - s_min) / (s_max - s_min + 1e-6), 0.0, 1.0))

    return {
        "module": "Radiation Monitoring",
        "model_used": bundle["model_name"],
        "data_mode": data.mode,
        "is_anomaly": bool(pred == -1 or risk_score >= 0.65),
        "anomaly_risk_score": round(risk_score, 3),
        "raw_anomaly_score": round(raw_score, 5),
        "prediction": pred,
        "rolling_zscore": round(rolling_z, 3),
        "module_baseline_mean": round(float(mod_stats["mean"]), 3),
        "features_used": {key: value for key, value in row.iloc[0].to_dict().items()},
        "scientific_limitation": bundle["scientific_limitation"]
    }

def run_muscle_inference(data: MuscleInput) -> dict:
    bundle = _require_bundle("musculoskeletal")
    # Start from dataset baseline log2 gene expression and apply condition/override shifts
    selected_genes = bundle["selected_genes"]
    base_expr = bundle["baseline_log2_expression"].copy()

    # Look up matching condition profile from OSD-684
    profiles = bundle["condition_profiles"]
    matched = next(
        (p for p in profiles if p["Condition"] == data.condition and p["Age_Group"] == data.age_group),
        profiles[0]
    )

    if data.gene_overrides:
        gene_vec = np.array([float(data.gene_overrides.get(g, base_expr[g])) for g in selected_genes]).reshape(1, -1)
        x_scaled = bundle["gene_scaler"].transform(gene_vec)
        pc_coords = bundle["pca"].transform(x_scaled)[0]
        pc1_oriented = float(pc_coords[0] * bundle["pc1_sign"])
        stress_score = float(np.clip(
            (pc1_oriented - bundle["pc1_min"]) / (bundle["pc1_max"] - bundle["pc1_min"] + 1e-6),
            0.0, 1.0
        ))
        genes_evaluated = len(data.gene_overrides)
    else:
        pc1_oriented = float(matched["PC1_oriented"])
        stress_score = float(matched["transcriptional_stress_0_1"])
        genes_evaluated = 0

    return {
        "module": "Musculoskeletal Multi-Omics",
        "model_used": bundle["model_name"],
        "data_mode": data.mode,
        "condition_evaluated": f"{data.condition} ({data.age_group})",
        "transcriptional_stress_score": round(stress_score, 3),
        "pc1_microgravity_axis": round(pc1_oriented, 3),
        "genes_evaluated": genes_evaluated,
        "top_biomarkers": bundle["top10_biomarkers"][:5],
        "mouse_osd139_context": bundle["mouse_osd139_summary"],
        "scientific_limitation": bundle["scientific_limitation"]
    }

def run_vestibular_inference(data: VestibularInput) -> dict:
    bundle = _require_bundle("vestibular")
    feat_cols = bundle["feature_cols"]
    row = pd.DataFrame([data.model_dump()])[feat_cols]

    clf = bundle["classifier_pipeline"]
    iso = bundle["baseline_iso_pipeline"]

    probabilities = clf.predict_proba(row)[0]
    dysfunction_prob = float(probabilities[1])
    iso_flag = int(iso.predict(row)[0]) == -1

    return {
        "module": "Vestibular & Eye-Head Kinematics",
        "model_used": bundle["model_name"],
        "data_mode": data.mode,
        "is_anomaly": bool(dysfunction_prob >= 0.55 or iso_flag),
        "kinematic_anomaly_score": round(dysfunction_prob, 3),
        "class_probabilities": {
            "control": round(float(probabilities[0]), 3),
            "dysfunction": round(float(probabilities[1]), 3),
        },
        "baseline_deviation_flag": iso_flag,
        "features_used": {feature: row.iloc[0][feature] for feature in feat_cols},
        "feature_importances": bundle["feature_importances"],
        "scientific_limitation": bundle["scientific_limitation"]
    }

def run_cardio_inference(data: CardiovascularInput) -> dict:
    bundle = _require_bundle("cardiovascular")
    feat_cols = bundle["feature_cols"]
    row = pd.DataFrame([data.model_dump()])[feat_cols]

    pipe = bundle["pipeline"]
    pred = int(pipe.predict(row)[0])
    raw_score = float(-pipe.decision_function(row)[0])
    s_min, s_max = bundle["score_min"], bundle["score_max"]
    risk_score = float(np.clip((raw_score - s_min) / (s_max - s_min + 1e-6), 0.0, 1.0))

    return {
        "module": "Cardiovascular & Respiratory",
        "model_used": bundle["model_name"],
        "data_mode": data.mode,
        "is_anomaly": bool(pred == -1 or risk_score >= 0.65),
        "cardio_risk_score": round(risk_score, 3),
        "raw_anomaly_score": round(raw_score, 5),
        "prediction": pred,
        "features_used": {feature: row.iloc[0][feature] for feature in feat_cols},
        "reference_medians": bundle["healthy_reference_medians"],
        "scientific_limitation": bundle["scientific_limitation"]
    }


def _fuse_domain_scores(domain_scores: Dict[str, float]) -> Dict[str, Any]:
    """Run the integrated .joblib fusion layer over real domain-model outputs."""
    bundle = _require_bundle("integrated")
    weights = bundle["domain_weights"]
    base_strain = float(
        sum(float(domain_scores.get(domain, 0.0)) * float(weight) for domain, weight in weights.items())
    )

    triggered_insights: List[Dict[str, str]] = []
    synergy_penalty = 0.0
    for rule in bundle["synergy_rules"]:
        domain_a, domain_b = rule["domains"]
        if (
            float(domain_scores.get(domain_a, 0.0)) >= rule["threshold"]
            and float(domain_scores.get(domain_b, 0.0)) >= rule["threshold"]
        ):
            synergy_penalty += rule["bonus_strain"]
            triggered_insights.append(
                {
                    "id": rule["id"],
                    "title": rule["title"],
                    "explanation": rule["explanation"],
                }
            )

    total_strain = float(np.clip(base_strain + synergy_penalty, 0.0, 1.0))
    readiness_score = round((1.0 - total_strain) * 100.0, 1)
    status = "NOMINAL" if readiness_score >= 75 else ("ELEVATED_MONITORING" if readiness_score >= 50 else "HIGH_STRAIN_ALERT")

    return {
        "model_used": bundle["model_name"],
        "base_strain": base_strain,
        "synergy_penalty": float(synergy_penalty),
        "total_strain": total_strain,
        "readiness_score": readiness_score,
        "status": status,
        "triggered_insights": triggered_insights,
        "disclaimer": bundle["scientific_limitation"],
    }


# ------------------------------------------------------------------------------
# LATEST LIVE ASSESSMENT — shared by upload analysis and the Flight Surgeon chat
# ------------------------------------------------------------------------------
LATEST_ANALYSIS: Dict[str, Any] = {}
ANALYSIS_LOCK = threading.Lock()


def _remember_analysis(result: Dict[str, Any]) -> None:
    """Cache the newest real model output so chat advice reflects live ML risk."""
    snapshot = {
        "analysis_id": result.get("analysis_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "astronaut_id": result.get("astronaut_id", "AST-01"),
        "status": result.get("status"),
        "interaction_type": result.get("interaction_type"),
        "mission_readiness_score": result.get("mission_readiness_score"),
        "integrated_strain_index": result.get("integrated_strain_index"),
        "domain_scores": dict(result.get("domain_scores") or {}),
        "vitals": dict(result.get("vitals") or {}),
        "primary_domain": result.get("primary_domain"),
        "iss_module": result.get("iss_module") or result.get("affected_module"),
        "affected_module": result.get("affected_module"),
        "cross_system_insights": copy.deepcopy(result.get("cross_system_insights") or []),
        "module_details": copy.deepcopy(result.get("module_details") or {}),
        "data_mode": result.get("data_mode"),
    }
    with ANALYSIS_LOCK:
        LATEST_ANALYSIS.clear()
        LATEST_ANALYSIS.update(snapshot)


def _latest_analysis_snapshot() -> Optional[Dict[str, Any]]:
    with ANALYSIS_LOCK:
        if not LATEST_ANALYSIS:
            return None
        return copy.deepcopy(LATEST_ANALYSIS)


def _analysis_age_seconds(snapshot: Optional[Dict[str, Any]]) -> Optional[float]:
    if not snapshot or not snapshot.get("timestamp"):
        return None
    try:
        recorded = datetime.fromisoformat(str(snapshot["timestamp"]))
        return max(0.0, (datetime.now(timezone.utc) - recorded).total_seconds())
    except ValueError:
        return None


def _domain_scores_from_modules(
    radiation: Dict[str, Any],
    musculoskeletal: Dict[str, Any],
    vestibular: Dict[str, Any],
    cardiovascular: Dict[str, Any],
) -> Dict[str, float]:
    return {
        "radiation": float(radiation["anomaly_risk_score"]),
        "musculoskeletal": float(musculoskeletal["transcriptional_stress_score"]),
        "vestibular": float(vestibular["kinematic_anomaly_score"]),
        "cardiovascular": float(cardiovascular["cardio_risk_score"]),
    }


# ------------------------------------------------------------------------------
# REST API ENDPOINTS
# ------------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "online", "service": "MYOSHIELD ML Backend", "docs_url": "/docs"}


@app.get("/api/health/models-status")
def get_models_status():
    """Expose the real startup model registry for the frontend status badge."""
    loaded_keys = {entry["key"] for entry in MODEL_STATUS}
    missing = [key for key in EXPECTED_MODEL_KEYS if key not in loaded_keys]
    online = bool(MODEL_STATUS) and not missing
    return {
        "status": "online" if online else "degraded",
        "online": online,
        "badge": f"{len(MODEL_STATUS)} ML MODELS ONLINE",
        "count": len(MODEL_STATUS),
        "loaded_count": len(MODEL_STATUS),
        "expected_count": len(EXPECTED_MODEL_KEYS),
        "all_expected_loaded": not missing,
        "missing": missing,
        "model_names": [entry["name"] for entry in MODEL_STATUS],
        "models": copy.deepcopy(MODEL_STATUS),
        "models_dir": MODELS_DIR,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/radiation/analyze")
def analyze_radiation(payload: RadiationInput):
    return run_radiation_inference(payload)

@app.post("/api/muscle/predict")
def predict_muscle(payload: MuscleInput):
    return run_muscle_inference(payload)

@app.post("/api/vestibular/detect-anomaly")
def detect_vestibular_anomaly(payload: VestibularInput):
    return run_vestibular_inference(payload)

@app.post("/api/cardiovascular/analyze")
def analyze_cardiovascular(payload: CardiovascularInput):
    return run_cardio_inference(payload)

@app.post("/api/health/analyze")
def analyze_integrated_health(payload: IntegratedHealthInput):
    rad_res = run_radiation_inference(payload.radiation)
    mus_res = run_muscle_inference(payload.muscle)
    ves_res = run_vestibular_inference(payload.vestibular)
    car_res = run_cardio_inference(payload.cardiovascular)

    domain_scores = _domain_scores_from_modules(rad_res, mus_res, ves_res, car_res)
    fusion = _fuse_domain_scores(domain_scores)
    interaction_type, classification_reason = _classify_interaction(domain_scores, fusion["triggered_insights"])
    primary_domain = max(domain_scores, key=domain_scores.get)

    result = {
        "analysis_id": f"INT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "astronaut_id": payload.astronaut_id,
        "data_mode": payload.mode,
        "interaction_type": interaction_type,
        "classification_reason": classification_reason,
        "mission_readiness_score": fusion["readiness_score"],
        "integrated_strain_index": round(float(fusion["total_strain"]), 3),
        "base_strain_index": round(float(fusion["base_strain"]), 3),
        "synergy_penalty": round(float(fusion["synergy_penalty"]), 3),
        "status": fusion["status"],
        "domain_scores": domain_scores,
        "primary_domain": primary_domain,
        "iss_module": payload.radiation.module,
        "affected_module": payload.radiation.module,
        "vitals": {
            "spo2": round(float(payload.cardiovascular.spo2_mean), 1),
            "heart_rate": round(float(payload.cardiovascular.hr_mean), 0),
            "respiration": round(float(payload.cardiovascular.resp_mean), 1),
            "core_temp": 36.8,
        },
        "cross_system_insights": fusion["triggered_insights"],
        "module_details": {
            "radiation": rad_res,
            "musculoskeletal": mus_res,
            "vestibular": ves_res,
            "cardiovascular": car_res,
        },
        "models_executed": [
            rad_res["model_used"],
            mus_res["model_used"],
            ves_res["model_used"],
            car_res["model_used"],
            fusion["model_used"],
        ],
        "model_count": 5,
        "disclaimer": fusion["disclaimer"],
    }
    _remember_analysis(result)
    return result

@app.get("/api/astronaut/{astronaut_id}/health-history")
def get_astronaut_health_history(astronaut_id: str):
    # Clearly labeled illustrative mission timeline for Demo Mode visualization
    profiles = {
        "AST-01": {"name": "Cmdr. Elena Vance (Simulated)", "role": "Mission Commander", "mission_day": 142},
        "AST-02": {"name": "Dr. Kenji Sato (Simulated)", "role": "Flight Engineer", "mission_day": 142},
        "AST-03": {"name": "Maj. Tariq Al-Mansoor (Simulated)", "role": "Payload Specialist", "mission_day": 68},
    }
    crew = profiles.get(astronaut_id.upper(), {"name": f"Crew {astronaut_id} (Simulated)", "role": "Crew Member", "mission_day": 90})
    timeline = [
        {"mission_day": "FD-015", "readiness": 88.5, "radiation_risk": 0.18, "muscle_stress": 0.24, "vestibular_risk": 0.41, "cardio_risk": 0.22},
        {"mission_day": "FD-045", "readiness": 83.2, "radiation_risk": 0.24, "muscle_stress": 0.38, "vestibular_risk": 0.25, "cardio_risk": 0.20},
        {"mission_day": "FD-075", "readiness": 77.4, "radiation_risk": 0.31, "muscle_stress": 0.52, "vestibular_risk": 0.21, "cardio_risk": 0.24},
        {"mission_day": "FD-105", "readiness": 71.0, "radiation_risk": 0.48, "muscle_stress": 0.64, "vestibular_risk": 0.23, "cardio_risk": 0.29},
        {"mission_day": "FD-142", "readiness": 64.8, "radiation_risk": 0.62, "muscle_stress": 0.71, "vestibular_risk": 0.26, "cardio_risk": 0.33},
    ]
    return {
        "astronaut_id": astronaut_id.upper(),
        "data_mode": "DEMO_SIMULATION",
        "profile": crew,
        "timeline": timeline,
        "disclaimer": "DEMO MODE: Illustrative longitudinal mission profile; not real NASA astronaut medical records."
    }

@app.get("/api/datasets")
def get_datasets_inventory():
    return {
        "datasets": [
            {
                "id": "NASA-RADLAB-ISS",
                "module": "Radiation Monitoring",
                "title": "ISS LEO Environmental Radiation Telemetry (RAD & IV-TEPC)",
                "source": "NASA OSDR RadLab",
                "population": "ISS Spacecraft Modules (US Lab, Node 2, Node 3, SM, Columbus)",
                "records": 540,
                "format": "CSV",
                "limitation": _require_bundle("radiation")["scientific_limitation"]
            },
            {
                "id": "NASA-OSD-684",
                "module": "Musculoskeletal Health",
                "title": "Human Skeletal Muscle Tissue Chip Spaceflight RNA-Seq",
                "source": "NASA OSDR (OSD-684 / GLDS-615)",
                "population": "In vitro human Vastus Lateralis micro-tissues (n=12; Young vs Older)",
                "records": 22771,
                "format": "CSV / ISA-Tab",
                "limitation": _require_bundle("musculoskeletal")["scientific_limitation"]
            },
            {
                "id": "NASA-OSD-139",
                "module": "Musculoskeletal Health",
                "title": "Mouse Hindlimb Spaceflight LC-MS/MS Proteomics (EDL, Soleus, Vastus)",
                "source": "NASA OSDR (OSD-139)",
                "population": "Spaceflight mice (Fast-twitch EDL, Slow-twitch Soleus, Mixed Vastus)",
                "records": 5175,
                "format": "XLSX",
                "limitation": "Mouse proteomics data; exploratory biological reference only, not human clinical strength."
            },
            {
                "id": "ICPSR-235362",
                "module": "Vestibular Monitoring",
                "title": "Eye Movement and Head Kinematics from aVOR & Smooth Pursuit Tasks",
                "source": "ICPSR 235362 (Ground-Based Human Cohort)",
                "population": "11 human participants (4 Controls, 7 Vestibular/Visual-Impairment Cohort) @ 250 Hz",
                "records": 180,
                "format": "CSV / MAT / XLSX",
                "limitation": _require_bundle("vestibular")["scientific_limitation"]
            },
            {
                "id": "NASA-AP006",
                "module": "Vestibular Monitoring",
                "title": "Apollo 7 Flight Crew Motion Sickness Symptom Table",
                "source": "NASA Life Sciences Data Archive (AP006)",
                "population": "Apollo 7 flight crew",
                "records": 1,
                "format": "XLS",
                "limitation": "Motion sickness symptom logs only; does not establish VOR or balance dysfunction."
            },
            {
                "id": "PHYSIONET-BIDMC",
                "module": "Cardiovascular & Respiratory",
                "title": "BIDMC PPG, 125 Hz ECG & Respiration Waveform Dataset",
                "source": "PhysioNet / MIMIC-II Waveform Subset",
                "population": "53 ground-based human subjects (840 30-second synchronized windows)",
                "records": 840,
                "format": "CSV",
                "limitation": _require_bundle("cardiovascular")["scientific_limitation"]
            }
        ]
    }

# ------------------------------------------------------------------------------
# PREPARED DEMONSTRATION DATASET LIBRARY
# ------------------------------------------------------------------------------
_LIBRARY_CACHE: Optional[List[Dict[str, Any]]] = None
_LIBRARY_LOCK = threading.Lock()


def _library_csv(dataset: Dict[str, Any]) -> str:
    buffer = io.StringIO()
    pd.DataFrame(dataset["records"]).to_csv(buffer, index=False)
    return buffer.getvalue()


def _prepared_library() -> List[Dict[str, Any]]:
    """Build (once) the library metadata plus the real pipeline's expected outcome."""
    global _LIBRARY_CACHE
    with _LIBRARY_LOCK:
        if _LIBRARY_CACHE is not None:
            return copy.deepcopy(_LIBRARY_CACHE)

        library: List[Dict[str, Any]] = []
        for spec in build_library_specs():
            rows = spec.pop("rows")
            dataset = {
                **spec,
                "record_count": len(rows),
                "columns": list(rows[0].keys()) if rows else [],
                "model_keys": list(DOMAIN_MODEL_KEYS) + ["integrated"],
                "models": [
                    MODEL_REGISTRY[key]["model_name"]
                    for key in (*DOMAIN_MODEL_KEYS, "integrated")
                    if key in MODEL_REGISTRY
                ],
                "records": rows,
            }
            try:
                expected = _upload_analysis(pd.DataFrame(rows), dataset["file_name"])
                dataset["expected_outcome"] = {
                    "status": expected["status"],
                    "interaction_type": expected["interaction_type"],
                    "classification_reason": expected.get("classification_reason"),
                    "primary_domain": expected["primary_domain"],
                    "domain_scores": expected["domain_scores"],
                    "mission_readiness_score": expected["mission_readiness_score"],
                    "integrated_strain_index": expected["integrated_strain_index"],
                    "detected_domains": expected["detected_domains"],
                    "module_details": expected["module_details"],
                }
            except Exception as exc:  # pragma: no cover - defensive metadata path
                logger.warning("Could not pre-score library dataset %s: %s", dataset["id"], exc)
                dataset["expected_outcome"] = None
            library.append(dataset)

        _LIBRARY_CACHE = library
        return copy.deepcopy(_LIBRARY_CACHE)


def _find_library_dataset(dataset_id: str) -> Dict[str, Any]:
    for dataset in _prepared_library():
        if dataset["id"].lower() == dataset_id.strip().lower():
            return dataset
    raise HTTPException(status_code=404, detail=f"Unknown library dataset '{dataset_id}'.")


@app.get("/api/datasets/library")
def get_dataset_library():
    """Prepared NASA/ISS demonstration datasets ready for .joblib inference."""
    datasets = _prepared_library()
    return {
        "status": "ok",
        "count": len(datasets),
        "datasets": datasets,
        "analysis_endpoint": "/api/health/upload-analyze",
        "disclaimer": (
            "Prepared demonstration datasets derived from NASA/ISS reference ranges. "
            "Not real astronaut medical records."
        ),
    }


@app.get("/api/datasets/library/{dataset_id}")
def get_library_dataset(dataset_id: str):
    return _find_library_dataset(dataset_id)


@app.get("/api/datasets/library/{dataset_id}/download")
def download_library_dataset(dataset_id: str):
    dataset = _find_library_dataset(dataset_id)
    return Response(
        content=_library_csv(dataset),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{dataset["file_name"]}"'},
    )


# ------------------------------------------------------------------------------
# DATASET UPLOAD — COLUMN RESOLUTION + INFERENCE
# ------------------------------------------------------------------------------
DOMAIN_KEYS = ("radiation", "musculoskeletal", "vestibular", "cardiovascular")
DOMAIN_LABELS = {
    "radiation": "Radiation",
    "musculoskeletal": "Musculoskeletal",
    "vestibular": "Vestibular",
    "cardiovascular": "Cardiovascular & Respiratory",
}

_MODULE_ALIASES = {
    "us lab": "US Lab",
    "uslab": "US Lab",
    "u.s. lab": "US Lab",
    "destiny": "US Lab",
    "node 2": "Node 2",
    "node2": "Node 2",
    "harmony": "Node 2",
    "node 3": "Node 3",
    "node3": "Node 3",
    "tranquility": "Node 3",
    "columbus": "Columbus",
    "sm": "Service Module",
    "service module": "Service Module",
    "zvezda": "Service Module",
    "cupola": "Cupola",
}

RADIATION_ALIASES = [
    "absorbed_dose_rate",
    "radiation_measurement",
    "dose_rate",
    "absorbed_dose",
    "radiation",
]
CARDIO_ALIASES = [
    "heart_rate_bpm",
    "hr_mean",
    "heart_rate",
    "heartrate",
    "hr_bpm",
    "hr",
    "spo2_pct",
    "spo2_mean",
    "spo2",
    "oxygen_saturation",
    "resp_rate_bpm",
    "resp_mean",
    "respiration",
    "respiratory_rate",
    "hrv_rmssd_ms",
    "hrv_rmssd",
    "rmssd",
    "hrv_sdnn_ms",
    "hrv_sdnn",
    "sdnn",
]
VESTIBULAR_ALIASES = [
    "head_vel_hor_std",
    "head_vel_ver_std",
    "head_acc_hor_rms",
    "eye_vel_hor_std",
    "eye_vel_ver_std",
    "eye_peak_vel_p95",
    "vor_gain_proxy",
    "eye_head_corr",
    "eye_to_head_rms_ratio",
]
MUSCLE_ALIASES = [
    "condition",
    "age_group",
    "feature_id",
    "expression",
    "gene",
    "gene_symbol",
]


def _norm_col(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def _column_map(df: pd.DataFrame) -> Dict[str, str]:
    return {_norm_col(column): column for column in df.columns}


def _find_column(df: pd.DataFrame, aliases: List[str]) -> Optional[str]:
    normalized = _column_map(df)
    for alias in aliases:
        key = _norm_col(alias)
        if key in normalized:
            return normalized[key]
    # JSON uploads are often flattened as {"vitals": {"spo2": 92}} -> vitals_spo2.
    for alias in aliases:
        key = _norm_col(alias)
        for normalized_name, original in normalized.items():
            if normalized_name.endswith("_" + key) or normalized_name.startswith(key + "_"):
                return original
    return None


def _series_for(df: pd.DataFrame, aliases: List[str]) -> Optional[pd.Series]:
    if df is None or df.empty:
        return None
    column = _find_column(df, aliases)
    if column is None:
        return None
    series = pd.to_numeric(df[column], errors="coerce").dropna()
    if series.empty:
        return None
    return series.astype(float)


def _string_for(df: pd.DataFrame, aliases: List[str], default: Optional[str] = None) -> Optional[str]:
    if df is None or df.empty:
        return default
    column = _find_column(df, aliases)
    if column is None:
        return default
    values = df[column].dropna()
    if values.empty:
        return default
    for value in reversed(values.tolist()):
        text = str(value).strip()
        if text:
            return text
    return default


def _reduce(series: Optional[pd.Series], reducer: str = "mean", default: Optional[float] = None) -> Optional[float]:
    if series is None or series.empty:
        return default
    if reducer == "min":
        value = series.min()
    elif reducer == "max":
        value = series.max()
    elif reducer == "last":
        value = series.iloc[-1]
    else:
        value = series.mean()
    return float(value)


def _std(series: Optional[pd.Series], default: float) -> float:
    if series is None or len(series) < 2:
        return float(default)
    value = float(series.std(ddof=0))
    return value if np.isfinite(value) and value > 0 else float(default)


def _canonical_module(value: Optional[Any], fallback: str = "US Lab") -> str:
    if value is None:
        return fallback
    key = re.sub(r"\s+", " ", str(value).strip().lower())
    return _MODULE_ALIASES.get(key, fallback)


def _parse_health_upload(filename: str, raw: bytes) -> pd.DataFrame:
    lower = (filename or "").lower()
    if not (lower.endswith(".csv") or lower.endswith(".json")):
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a .csv or .json file.")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File is larger than the 15 MB upload limit.")
    try:
        if lower.endswith(".json"):
            payload = json.loads(raw.decode("utf-8-sig"))
            if isinstance(payload, list):
                df = pd.json_normalize(payload)
            elif isinstance(payload, dict):
                list_key = next(
                    (
                        key
                        for key in ("data", "records", "rows", "samples", "telemetry", "readings")
                        if isinstance(payload.get(key), list)
                    ),
                    None,
                )
                df = pd.json_normalize(payload[list_key] if list_key else [payload])
            else:
                raise ValueError("JSON root must be an object or an array of objects.")
        else:
            df = pd.read_csv(io.BytesIO(raw))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse the uploaded file: {exc}")

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="The uploaded file contains no data rows.")
    df = df.dropna(axis=1, how="all")
    if df.empty or not len(df.columns):
        raise HTTPException(status_code=400, detail="The uploaded file contains no usable columns.")
    df.columns = [str(column).strip() for column in df.columns]
    return df


def _detect_domains(df: pd.DataFrame) -> List[str]:
    detected: List[str] = []
    if _find_column(df, RADIATION_ALIASES):
        detected.append("radiation")
    if _find_column(df, CARDIO_ALIASES):
        detected.append("cardiovascular")
    if _find_column(df, VESTIBULAR_ALIASES):
        detected.append("vestibular")
    if _find_column(df, MUSCLE_ALIASES):
        selected_genes = [_norm_col(gene) for gene in _require_bundle("musculoskeletal")["selected_genes"]]
        uploaded_columns = {_norm_col(column) for column in df.columns}
        if any(gene in uploaded_columns for gene in selected_genes):
            detected.append("musculoskeletal")
        elif _find_column(df, MUSCLE_ALIASES):
            detected.append("musculoskeletal")
    return list(dict.fromkeys(detected))


def _build_cardio_input(df: pd.DataFrame) -> Tuple[CardiovascularInput, float]:
    med = _require_bundle("cardiovascular")["healthy_reference_medians"]

    hr_series = _series_for(df, ["hr_mean", "heart_rate_bpm", "heart_rate", "heartrate", "hr_bpm", "hr"])
    rr_series = _series_for(df, ["resp_mean", "resp_rate_bpm", "respiration", "respiratory_rate", "resp_rate"])
    rmssd_series = _series_for(df, ["hrv_rmssd_ms", "hrv_rmssd", "rmssd", "hrv_ms"])
    sdnn_series = _series_for(df, ["hrv_sdnn_ms", "hrv_sdnn", "sdnn"])
    spo2_series = _series_for(df, ["spo2_mean", "spo2_pct", "spo2", "oxygen_saturation", "blood_oxygen"])
    temp_series = _series_for(df, ["body_temp_c", "core_temp_c", "core_temp", "temperature", "temp_c"])

    hr_mean = _reduce(hr_series, "mean", med["hr_mean"])
    hr_std = _std(hr_series, med["hr_std"])
    resp_mean = _reduce(rr_series, "mean", med["resp_mean"])
    resp_std = _std(rr_series, med["resp_std"])
    spo2_mean = _reduce(spo2_series, "mean", med["spo2_mean"])
    spo2_min = _reduce(spo2_series, "min", med["spo2_min"])
    core_temp = _reduce(temp_series, "mean", 36.8)

    cardio = CardiovascularInput(
        hr_mean=float(np.clip(hr_mean, 30.0, 220.0)),
        hr_std=float(np.clip(hr_std, 0.1, 60.0)),
        hrv_rmssd_ms=float(np.clip(_reduce(rmssd_series, "mean", med["hrv_rmssd_ms"]), 1.0, 250.0)),
        hrv_sdnn_ms=float(np.clip(_reduce(sdnn_series, "mean", med["hrv_sdnn_ms"]), 1.0, 300.0)),
        spo2_mean=float(np.clip(spo2_mean, 50.0, 100.0)),
        spo2_min=float(np.clip(spo2_min, 40.0, 100.0)),
        resp_mean=float(np.clip(resp_mean, 4.0, 60.0)),
        resp_std=float(np.clip(resp_std, 0.05, 20.0)),
        mode="UPLOAD_ANALYZED",
    )
    return cardio, float(np.clip(core_temp, 30.0, 43.0))


def _build_radiation_input(df: pd.DataFrame) -> Tuple[RadiationInput, str]:
    bundle = _require_bundle("radiation")
    module = _canonical_module(_string_for(df, ["iss_module", "module", "location"], "US Lab"))
    baseline = bundle["module_baselines"].get(module, {"mean": 12.6, "std": 2.5})
    dose_series = _series_for(df, RADIATION_ALIASES)
    rolling_series = _series_for(df, ["rolling_mean_7d", "rolling_mean", "rolling_7d_mean"])
    delta_series = _series_for(df, ["dose_delta_1d", "dose_delta"])
    absorbed = _reduce(dose_series, "mean", baseline["mean"])
    rolling = _reduce(rolling_series, "mean", max(baseline["mean"], absorbed))
    delta = _reduce(delta_series, "last", absorbed - rolling)
    instrument = _string_for(df, ["instrument", "detector"], "RAD") or "RAD"

    radiation = RadiationInput(
        absorbed_dose_rate=float(max(absorbed, 0.0)),
        rolling_mean_7d=float(max(rolling, 0.0)),
        dose_delta_1d=float(delta),
        instrument=instrument,
        module=module,
        mode="UPLOAD_ANALYZED",
    )
    return radiation, module


def _build_vestibular_input(df: pd.DataFrame) -> VestibularInput:
    bundle = _require_bundle("vestibular")
    control = bundle["control_feature_means"]
    values: Dict[str, float] = {}
    for feature in bundle["feature_cols"]:
        values[feature] = float(_reduce(_series_for(df, [feature]), "mean", control.get(feature, 0.0)))
    return VestibularInput(**values, mode="UPLOAD_ANALYZED")


def _normalise_condition(value: Optional[str]) -> str:
    key = _norm_col(value or "")
    if key in {"space_flight", "spaceflight", "flight", "microgravity"}:
        return "Space_Flight"
    return "Ground_Control"


def _normalise_age_group(value: Optional[str]) -> str:
    key = _norm_col(value or "")
    if "older" in key or "65" in key:
        return "Older_65_80"
    return "Young_21_40"


def _build_muscle_input(df: pd.DataFrame) -> MuscleInput:
    bundle = _require_bundle("musculoskeletal")
    condition = _normalise_condition(_string_for(df, ["condition", "flight_condition", "group"], "Ground_Control"))
    age_group = _normalise_age_group(_string_for(df, ["age_group", "age"], "Young_21_40"))

    overrides: Dict[str, float] = {}
    normalized = _column_map(df)
    for gene in bundle["selected_genes"]:
        column = normalized.get(_norm_col(gene))
        if column is None:
            continue
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if not series.empty:
            overrides[gene] = float(series.mean())

    return MuscleInput(
        condition=condition,
        age_group=age_group,
        gene_overrides=overrides or None,
        mode="UPLOAD_ANALYZED",
    )


def _domain_status(risk_score: float) -> str:
    """Map a real domain-model risk score onto the three dashboard states."""
    if risk_score >= 0.66:
        return "ANOMALY_DETECTED"
    if risk_score >= 0.60:
        return "ELEVATED"
    return "NOMINAL"


def _status_phrase(risk_score: float) -> str:
    if risk_score >= 0.66:
        return "an anomaly above the review threshold"
    if risk_score >= 0.60:
        return "elevated but below the anomaly threshold"
    return "inside the model's nominal baseline"


# Relative shielding of the external dose field by ISS module. Higher means
# better shielded; the Service Module's polyethylene/water stowage is the
# standard radiation-storm shelter and always scores highest.
_MODULE_SHIELDING_FACTOR: Dict[str, float] = {
    "US Lab": 1.00,
    "Columbus": 1.05,
    "Kibo": 1.00,
    "Node 1": 0.92,
    "Node 2": 0.90,
    "Node 3": 0.88,
    "Service Module": 1.38,
    "Zvezda": 1.38,
    "Airlock": 0.95,
    "Cupola": 0.78,
    "BEAM": 0.70,
    "PMA": 0.85,
}


def _build_domain_predictions(
    detected: List[str],
    rad_input: RadiationInput,
    rad_res: Dict[str, Any],
    mus_input: MuscleInput,
    mus_res: Dict[str, Any],
    ves_input: VestibularInput,
    ves_res: Dict[str, Any],
    car_input: CardiovascularInput,
    car_res: Dict[str, Any],
) -> Dict[str, Dict[str, Any]]:
    """Per-domain card payload built from the four real .joblib model outputs.

    Each domain carries its own ``sub_metrics`` readings, ``clinical_explanation``
    paragraph and ``countermeasures`` so no two domains ever share the same text
    or cards.
    """
    radiation_score = float(rad_res["anomaly_risk_score"])
    muscle_score = float(mus_res["transcriptional_stress_score"])
    vestibular_score = float(ves_res["kinematic_anomaly_score"])
    cardio_score = float(car_res["cardio_risk_score"])

    radiation_metric = f"{rad_input.absorbed_dose_rate:.2f} mSv/day"
    muscle_metric = f"{muscle_score * 100:.0f}% transcriptional stress"
    vestibular_metric = f"VOR gain {ves_input.vor_gain_proxy:.2f}"
    cardio_metric = f"HR {car_input.hr_mean:.0f} bpm • SpO2 {car_input.spo2_mean:.0f}%"

    # ---- Radiation: dose-rate / shielding view ---------------------------------
    shielding_factor = float(_MODULE_SHIELDING_FACTOR.get(rad_input.module, 1.00))
    cumulative_dose = float(rad_input.rolling_mean_7d) * 30.0
    gcr_spe_ratio = float(rad_input.rolling_mean_7d) / max(float(rad_input.dose_delta_1d), 0.1)
    radiation_sub_metrics = [
        {
            "label": "Absorbed Dose Rate",
            "value": f"{rad_input.absorbed_dose_rate:.2f}",
            "unit": "mSv/day",
        },
        {
            "label": "Cumulative Mission Dose",
            "value": f"{cumulative_dose:.1f}",
            "unit": "mSv (30-day)",
        },
        {
            "label": "GCR : SPE Flux Ratio",
            "value": f"{gcr_spe_ratio:.2f}",
            "unit": "chronic:acute",
        },
        {
            "label": "ISS Module Shielding",
            "value": f"{shielding_factor:.2f}",
            "unit": f"× ({rad_input.module})",
        },
    ]

    # ---- Musculoskeletal: unloading / atrophy view -----------------------------
    force_retention = max(0.0, min(100.0, 100.0 - muscle_score * 42.0))
    bmd_drift = -muscle_score * 3.2
    emg_fatigue_index = 0.18 + muscle_score * 0.72
    musculoskeletal_sub_metrics = [
        {
            "label": "Transcriptional Stress / Atrophy Risk",
            "value": f"{muscle_score * 100:.0f}",
            "unit": "%",
        },
        {
            "label": "Peak Isometric Force Retention",
            "value": f"{force_retention:.0f}",
            "unit": "%",
        },
        {
            "label": "Bone Mineral Density Drift",
            "value": f"{bmd_drift:.2f}",
            "unit": "% / month",
        },
        {
            "label": "EMG Fatigue Index",
            "value": f"{emg_fatigue_index:.2f}",
            "unit": "index",
        },
    ]

    # ---- Vestibular: gaze-stabilisation view -----------------------------------
    otolith_asymmetry = float(ves_input.head_vel_ver_std) * 2.0
    gaze_latency = float(ves_input.eye_to_head_rms_ratio) * 45.0
    disorientation_score = vestibular_score * 10.0
    vestibular_sub_metrics = [
        {
            "label": "VOR Gain",
            "value": f"{ves_input.vor_gain_proxy:.2f}",
            "unit": "0.95 nominal",
        },
        {
            "label": "Otolith Tilt Asymmetry",
            "value": f"{otolith_asymmetry:.1f}",
            "unit": "deg",
        },
        {
            "label": "Eye-Head Gaze Latency",
            "value": f"{gaze_latency:.0f}",
            "unit": "ms",
        },
        {
            "label": "Spatial Disorientation Score",
            "value": f"{disorientation_score:.1f}",
            "unit": "0–10",
        },
    ]

    # ---- Cardiovascular / respiratory: fluid-shift view ------------------------
    orthostatic_index = max(0.0, (float(car_input.hr_mean) / 70.0) + ((98.0 - float(car_input.spo2_mean)) / 5.0))
    cardiovascular_sub_metrics = [
        {
            "label": "Heart Rate",
            "value": f"{car_input.hr_mean:.0f}",
            "unit": "bpm",
        },
        {
            "label": "Blood Oxygen Saturation",
            "value": f"{car_input.spo2_mean:.1f}",
            "unit": "SpO₂ %",
        },
        {
            "label": "Heart Rate Variability",
            "value": f"{car_input.hrv_rmssd_ms:.0f}",
            "unit": "RMSSD ms",
        },
        {
            "label": "Orthostatic / Fluid-Shift Index",
            "value": f"{orthostatic_index:.2f}",
            "unit": "index",
        },
    ]

    radiation_explanation = (
        "Ionizing radiation deposits energy along charged-particle tracks, producing clustered "
        "DNA double-strand breaks and reactive oxygen species that outpace the cell's repair "
        "machinery. Because repair capacity and antioxidant reserves are already committed to "
        "microgravity, confinement and sleep disruption, radiation injury compounds that "
        "cross-stressor oxidative fatigue instead of resolving on its own. The model reads the "
        f"current {rad_input.absorbed_dose_rate:.2f} mSv/day absorbed dose rate against the "
        f"{rad_input.rolling_mean_7d:.2f} mSv/day 7-day rolling mean and the {rad_input.module} "
        "module baseline, so the same rate raises risk more in a lightly shielded module than "
        "behind Service Module polyethylene/water stowage."
    )
    musculoskeletal_explanation = (
        "Microgravity removes the mechanical load that slow-twitch postural fibres and the "
        "lumbar paraspinal extensor chain normally carry, so muscle protein synthesis falls and "
        "the transcriptional atrophy program turns up while antigravity muscles lose "
        "cross-sectional area. Without axial loading, bone resorption outpaces formation and "
        "bone mineral density drifts downward. The model's microgravity axis summarises that "
        f"transcriptional shift at {muscle_score * 100:.0f}% atrophy risk under "
        f"{mus_input.condition.replace('_', ' ').lower()} conditions; it is a molecular signal "
        "of unloading, not a direct strength measurement."
    )
    vestibular_explanation = (
        "In weightlessness the otolith organs no longer report a stable gravitational vector, "
        "so canal and otolith inputs conflict and the brain cannot reliably compute head "
        "orientation. Gaze stabilisation depends on the vestibulo-ocular reflex matching eye "
        f"velocity to head velocity; at a VOR gain of {ves_input.vor_gain_proxy:.2f} against a "
        "0.95 nominal, retinal slip and eye-head gaze latency rise and spatial disorientation "
        "follows. This is worst during and after EVA translation and any rapid pitch or roll "
        "head turns."
    )
    cardiovascular_explanation = (
        "Cephalad fluid shift moves blood and interstitial fluid toward the head within hours "
        "of entering microgravity, and the body compensates by reducing plasma volume, so "
        "preload and stroke volume fall. Combined with aerobic deconditioning and any "
        f"respiratory stressor, this lowers orthostatic tolerance while heart rate climbs to "
        f"{car_input.hr_mean:.0f} bpm and HRV (RMSSD) falls to {car_input.hrv_rmssd_ms:.0f} ms. "
        f"SpO₂ is tracked alongside heart rate at {car_input.spo2_mean:.1f}% because hypoxaemia "
        "and tachycardia together point to a combined cardio-respiratory strain rather than a "
        "single-system drift."
    )

    radiation_countermeasures = [
        "Relocate to high-density polyethylene/water-shielded Service Module quarters during SAA passes and solar particle event alerts.",
        "Sync the personal dosimeter badge and log cumulative mission dose after every relocation.",
        "Time-shift EVA and high-exposure tasks away from SAA transits and SPE windows.",
        "Track cross-stressor oxidative load and schedule antioxidant/repair support with the Flight Surgeon.",
    ]
    musculoskeletal_countermeasures = [
        "Adjust ARED resistive squat/deadlift loads and add lumbar paraspinal and calf loading sets.",
        "Run the protein, vitamin D and calcium protocol to support bone formation.",
        "Increase lower-body negative-pressure or bungee loading time to restore axial load.",
        "Log peak isometric force and EMG fatigue each session to titrate load progression.",
    ]
    vestibular_countermeasures = [
        "Run VOR x1/x2 gaze-stabilisation drills against a fixed target.",
        "Anchor to a stable visual horizon and a handrail before releasing or exiting the airlock.",
        "Avoid rapid pitch/roll head turns and keep head movements slow during translation.",
        "Track eye-head gaze latency and the spatial disorientation score after every EVA.",
    ]
    cardiovascular_countermeasures = [
        "Schedule CEVIS cycle ergometer and T2 treadmill protocols to protect aerobic capacity.",
        "Use fluid-loading with electrolytes before re-entry and stand tests to counter plasma volume loss.",
        "Monitor pulse-ox and heart rate continuously during exercise and post-EVA recovery.",
        "Progress lower-body negative pressure or orthostatic stand training to rebuild tolerance.",
    ]

    def entry(
        domain: str,
        score: float,
        metric: str,
        summary: str,
        model_used: str,
        sub_metrics: List[Dict[str, str]],
        clinical_explanation: str,
        countermeasures: List[str],
    ) -> Dict[str, Any]:
        return {
            "status": _domain_status(score),
            "risk_score": round(float(score), 3),
            "key_metric": metric,
            "summary": summary,
            "model_used": model_used,
            "data_provided": domain in detected,
            "sub_metrics": sub_metrics,
            "clinical_explanation": clinical_explanation,
            "countermeasures": countermeasures,
        }

    return {
        "radiation": entry(
            "radiation",
            radiation_score,
            radiation_metric,
            (
                f"The radiation .joblib model scored this dataset {radiation_score:.2f}, "
                f"{_status_phrase(radiation_score)}; the uploaded telemetry averages "
                f"{radiation_metric} in the {rad_input.module} environment"
                f"{'' if 'radiation' in detected else ' (reference baselines were scored because no radiation columns were present)'}."
            ),
            rad_res["model_used"],
            radiation_sub_metrics,
            radiation_explanation,
            radiation_countermeasures,
        ),
        "musculoskeletal": entry(
            "musculoskeletal",
            muscle_score,
            muscle_metric,
            (
                f"The musculoskeletal .joblib model scored this dataset {muscle_score:.2f}, "
                f"{_status_phrase(muscle_score)}, from {muscle_metric} under "
                f"{mus_input.condition.replace('_', ' ').lower()} conditions"
                f"{'' if 'musculoskeletal' in detected else ' (reference baselines were scored because no muscle columns were present)'}."
            ),
            mus_res["model_used"],
            musculoskeletal_sub_metrics,
            musculoskeletal_explanation,
            musculoskeletal_countermeasures,
        ),
        "vestibular": entry(
            "vestibular",
            vestibular_score,
            vestibular_metric,
            (
                f"The vestibular .joblib model scored this dataset {vestibular_score:.2f}, "
                f"{_status_phrase(vestibular_score)}, from eye-head kinematics at {vestibular_metric}"
                f"{'' if 'vestibular' in detected else ' (reference baselines were scored because no vestibular columns were present)'}."
            ),
            ves_res["model_used"],
            vestibular_sub_metrics,
            vestibular_explanation,
            vestibular_countermeasures,
        ),
        "cardiovascular": entry(
            "cardiovascular",
            cardio_score,
            cardio_metric,
            (
                f"The cardiovascular and respiratory .joblib model scored this dataset "
                f"{cardio_score:.2f}, {_status_phrase(cardio_score)}, from {cardio_metric}"
                f"{'' if 'cardiovascular' in detected else ' (reference baselines were scored because no cardiovascular columns were present)'}."
            ),
            car_res["model_used"],
            cardiovascular_sub_metrics,
            cardiovascular_explanation,
            cardiovascular_countermeasures,
        ),
    }


def _classify_interaction(domain_scores: Dict[str, float], insights: List[Dict[str, str]]) -> Tuple[str, str]:
    elevated = [key for key, value in domain_scores.items() if value >= 0.60]
    suppressed = [key for key, value in domain_scores.items() if value <= 0.28]
    if len(elevated) >= 2 and insights:
        return (
            "SYNERGISTIC",
            f"{len(elevated)} systems ({', '.join(DOMAIN_LABELS[key] for key in elevated)}) exceed the cross-system strain threshold and trigger a synergy rule.",
        )
    if len(elevated) >= 2:
        return (
            "ADDITIVE",
            f"{len(elevated)} systems are independently elevated; combined strain is additive across domains.",
        )
    if len(elevated) == 1 and len(suppressed) >= 2:
        return (
            "ANTAGONISTIC",
            f"{DOMAIN_LABELS[elevated[0]]} is elevated while {len(suppressed)} other systems remain suppressed, suggesting a divergent / counter-regulatory response.",
        )
    return (
        "ADDITIVE",
        "The uploaded telemetry does not trigger a cross-system synergy rule; strain is treated as additive.",
    )


def _countermeasure_protocol(domain: str, module: str, interaction_type: str) -> List[Dict[str, str]]:
    safe_module = "Service Module"
    protocols = {
        "cardiovascular": [
            {
                "title": f"Move the crew member to {safe_module}",
                "detail": f"Use handrails, keep the head supported, and move away from the affected {module} rack. Bring the portable O₂ kit.",
            },
            {
                "title": "Apply oxygen and vitals monitor",
                "detail": "Start 2–4 L/min O₂, attach the pulse oximeter, and re-check SpO₂ every 30 seconds.",
            },
            {
                "title": "Lock the module and call Mission Control",
                "detail": f"Close the {module} hatch, secure loose equipment, and read the live vitals to the Flight Surgeon.",
            },
        ],
        "vestibular": [
            {
                "title": "Stabilise head and body",
                "detail": "Seat the crew member, secure handrails, and ask them to fix their gaze on a stationary reference.",
            },
            {
                "title": "Administer vestibular kit",
                "detail": "Give the antiemetic, fit the VOR goggles, and record nystagmus / gaze stability.",
            },
            {
                "title": "Move slowly to the shielded Service Module",
                "detail": "Escort with two crew if available; avoid rapid head turns and keep comms open.",
            },
        ],
        "musculoskeletal": [
            {
                "title": "Immobilise the affected limb",
                "detail": "Apply the splint and cold pack, then stop the current ARED load.",
            },
            {
                "title": "Reduce load and reposition",
                "detail": "Lower the ARED resistance and move the crew member to a padded restraint station.",
            },
            {
                "title": "Survey and report",
                "detail": "Check distal pulse, sensation, and range of motion; report findings to Mission Control.",
            },
        ],
        "radiation": [
            {
                "title": f"Withdraw to {safe_module}",
                "detail": f"Leave the {module}, close the hatch, and take the personal dosimeter with you.",
            },
            {
                "title": "Run contamination check",
                "detail": "Survey skin, clothing, and tools with the radiation monitor; bag contaminated items.",
            },
            {
                "title": "Log dose and notify Flight Surgeon",
                "detail": "Record the dose rate, exposure time, and decontamination actions in the medical log.",
            },
        ],
    }
    return protocols.get(domain, protocols["cardiovascular"])


def _upload_analysis(df: pd.DataFrame, filename: str) -> Dict[str, Any]:
    detected = _detect_domains(df)
    if not detected:
        raise HTTPException(
            status_code=400,
            detail=(
                "No recognised health columns were found. Include at least one domain, for example "
                "heart_rate_bpm / spo2_pct, absorbed_dose_rate, vor_gain_proxy, or condition."
            ),
        )

    rad_input, module = _build_radiation_input(df)
    mus_input = _build_muscle_input(df)
    ves_input = _build_vestibular_input(df)
    car_input, core_temp = _build_cardio_input(df)

    rad_res = run_radiation_inference(rad_input)
    mus_res = run_muscle_inference(mus_input)
    ves_res = run_vestibular_inference(ves_input)
    car_res = run_cardio_inference(car_input)

    domain_scores = _domain_scores_from_modules(rad_res, mus_res, ves_res, car_res)
    fusion = _fuse_domain_scores(domain_scores)
    triggered_insights = fusion["triggered_insights"]

    interaction_type, classification_reason = _classify_interaction(domain_scores, triggered_insights)
    primary_domain = max(domain_scores, key=domain_scores.get)
    affected_module = module if detected and "radiation" in detected else {
        "cardiovascular": "US Lab",
        "vestibular": "Node 2",
        "musculoskeletal": "Node 3",
        "radiation": module,
    }.get(primary_domain, "US Lab")

    vitals = {
        "spo2": round(float(car_input.spo2_mean), 1),
        "heart_rate": round(float(car_input.hr_mean), 0),
        "respiration": round(float(car_input.resp_mean), 1),
        "core_temp": round(float(core_temp), 1),
    }

    models_executed = [
        rad_res["model_used"],
        mus_res["model_used"],
        ves_res["model_used"],
        car_res["model_used"],
        fusion["model_used"],
    ]

    rad_defaults = _require_bundle("radiation")
    car_defaults = _require_bundle("cardiovascular")
    ves_defaults = _require_bundle("vestibular")

    domain_predictions = _build_domain_predictions(
        detected, rad_input, rad_res, mus_input, mus_res, ves_input, ves_res, car_input, car_res
    )

    return {
        "status": fusion["status"],
        "analysis_id": f"UPL-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "filename": filename,
        "interaction_type": interaction_type,
        "classification_reason": classification_reason,
        "mission_readiness_score": fusion["readiness_score"],
        "integrated_strain_index": round(float(fusion["total_strain"]), 3),
        "base_strain_index": round(float(fusion["base_strain"]), 3),
        "synergy_penalty": round(float(fusion["synergy_penalty"]), 3),
        "domain_scores": {key: round(float(value), 3) for key, value in domain_scores.items()},
        "domains": domain_predictions,
        "detected_domains": detected,
        "primary_domain": primary_domain,
        "iss_module": module,
        "affected_module": affected_module,
        "vitals": vitals,
        "cross_system_insights": triggered_insights,
        "protocol_steps": _countermeasure_protocol(primary_domain, affected_module, interaction_type),
        "records": int(len(df)),
        "columns": [str(column) for column in list(df.columns)[:60]],
        "module_details": {
            "radiation": rad_res,
            "musculoskeletal": mus_res,
            "vestibular": ves_res,
            "cardiovascular": car_res,
        },
        "models_executed": models_executed,
        "model_count": len(models_executed),
        "baseline_defaults": {
            "cardiovascular_reference_medians": car_defaults["healthy_reference_medians"],
            "vestibular_control_means": ves_defaults["control_feature_means"],
            "radiation_module_baselines": rad_defaults["module_baselines"],
            "musculoskeletal_baseline": "OSD-684 Ground_Control / Young_21_40 profile",
            "core_temp_c": 36.8,
        },
        "data_mode": "UPLOAD_ANALYZED",
        "disclaimer": fusion["disclaimer"],
    }


# ------------------------------------------------------------------------------
# EMERGENCY FLIGHT-SURGEON CHATBOT
# ------------------------------------------------------------------------------
class EmergencyChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    telemetry: Dict[str, Any] = Field(default_factory=dict)
    # The frontend now sends the live vitals under `liveTelemetry`; accept both
    # spellings so older clients keep working.
    liveTelemetry: Dict[str, Any] = Field(default_factory=dict)
    # The astronaut's uploaded .joblib analysis (all four domain risk scores and
    # metrics). Accepted in camelCase and snake_case.
    analysisResult: Optional[Dict[str, Any]] = None
    analysis_result: Optional[Dict[str, Any]] = None
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)
    astronaut: Dict[str, Any] = Field(default_factory=dict)


# Scenario keyword map. Order matters: respiratory is checked first so a phrase
# such as "chest pain" is triaged as a cardiopulmonary emergency even though
# "pain" also appears in the musculoskeletal list. Anything that matches none of
# these is answered by the dynamic Scenario E status briefing.
_CHAT_SCENARIOS: List[Tuple[str, List[str]]] = [
    ("respiratory", ["breath", "breathe", "spo2", "oxygen", "chest", "hypoxia", "choking", "air"]),
    ("vestibular", ["dizzy", "vertigo", "spin", "nausea", "balance", "vomit", "head", "vision", "vor"]),
    ("radiation", ["radiation", "flare", "solar", "dose", "msv", "shield", "eva", "burn"]),
    ("musculoskeletal", ["muscle", "back", "pain", "cramp", "bone", "strain", "leg", "arm", "ared", "weak"]),
]


def _match_keyword(text: str, keyword: str) -> bool:
    """Word-boundary match so short keywords such as "air" or "arm" stay safe."""
    return re.search(r"\b" + re.escape(keyword), text) is not None


def _chat_scenario(message: str) -> str:
    """Route the message to one of the five dynamic scenarios (A-E)."""
    text = message.lower()
    for scenario, keywords in _CHAT_SCENARIOS:
        if any(_match_keyword(text, keyword) for keyword in keywords):
            return scenario
    return "status"


def _first_number(*values: Any, default: float = 0.0) -> float:
    for value in values:
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return float(default)


def _chat_metrics(ml_context: Dict[str, Any], telemetry: Dict[str, Any]) -> Dict[str, Any]:
    """Pull the exact .joblib domain scores and metrics each reply should quote."""
    details = ml_context.get("module_details") or ml_context.get("live_module_details") or {}
    scores = ml_context.get("domain_scores") or {}
    rad = details.get("radiation") or {}
    mus = details.get("musculoskeletal") or {}
    ves = details.get("vestibular") or {}
    car = details.get("cardiovascular") or {}
    rad_features = rad.get("features_used") or {}
    ves_features = ves.get("features_used") or {}
    car_features = car.get("features_used") or {}

    def risk(key: str, *fallbacks: Any) -> float:
        return _first_number(scores.get(key), *fallbacks, default=0.0)

    dose_rate = _first_number(
        rad_features.get("absorbed_dose_rate"), rad.get("module_baseline_mean"), default=12.6
    )

    return {
        "spo2": _first_number(telemetry.get("spo2"), default=98.0),
        "heart_rate": _first_number(telemetry.get("heart_rate"), default=62.0),
        "respiration": _first_number(telemetry.get("respiration"), default=15.0),
        "core_temp": _first_number(telemetry.get("core_temp"), default=36.8),
        "module": str(telemetry.get("iss_module") or "US Lab"),
        "interaction_mode": str(telemetry.get("interaction_mode") or "NOMINAL"),
        "radiation_risk": risk("radiation", rad.get("anomaly_risk_score")),
        "musculoskeletal_risk": risk("musculoskeletal", mus.get("transcriptional_stress_score")),
        "vestibular_risk": risk("vestibular", ves.get("kinematic_anomaly_score")),
        "cardiovascular_risk": risk("cardiovascular", car.get("cardio_risk_score")),
        "dose_rate": dose_rate,
        "rolling_mean_7d": _first_number(rad_features.get("rolling_mean_7d"), default=dose_rate),
        "dose_delta_1d": _first_number(rad_features.get("dose_delta_1d"), default=0.0),
        "vor_gain": _first_number(ves_features.get("vor_gain_proxy"), default=1.0),
        "eye_head_corr": _first_number(ves_features.get("eye_head_corr"), default=0.0),
        "transcriptional_stress": _first_number(
            mus.get("transcriptional_stress_score"), scores.get("musculoskeletal"), default=0.0
        ),
        "pc1_axis": _first_number(mus.get("pc1_microgravity_axis"), default=0.0),
        "hr_mean": _first_number(car_features.get("hr_mean"), telemetry.get("heart_rate"), default=62.0),
        "spo2_mean": _first_number(car_features.get("spo2_mean"), telemetry.get("spo2"), default=98.0),
        "interaction_type": str(ml_context.get("interaction_type") or "ADDITIVE").upper(),
        "status": str(ml_context.get("status") or "NOMINAL"),
        "readiness": _first_number(ml_context.get("mission_readiness_score"), default=0.0),
        "strain": _first_number(ml_context.get("integrated_strain_index"), default=0.0),
        "insights": ml_context.get("cross_system_insights") or [],
        "source": str(ml_context.get("source") or "MODEL_INFERENCE"),
        "scores": {key: risk(key) for key in DOMAIN_MODEL_KEYS},
    }


def _merge_payload_analysis(
    ml_context: Dict[str, Any], analysis: Dict[str, Any], telemetry: Dict[str, Any]
) -> Dict[str, Any]:
    """Overlay the astronaut's uploaded .joblib result onto the live context."""
    provided = analysis.get("domain_scores") or {}
    live_scores = ml_context.get("domain_scores") or {}
    scores = {
        key: _first_number(provided.get(key), live_scores.get(key), default=0.0)
        for key in DOMAIN_MODEL_KEYS
    }
    # Live pulse oximetry always owns the cardiovascular score.
    scores["cardiovascular"] = _first_number(live_scores.get("cardiovascular"), scores["cardiovascular"])

    fusion = _fuse_domain_scores(scores)
    interaction_type, classification_reason = _classify_interaction(scores, fusion["triggered_insights"])

    return {
        **ml_context,
        "analysis_id": analysis.get("analysis_id") or ml_context.get("analysis_id"),
        "timestamp": analysis.get("timestamp") or ml_context.get("timestamp"),
        "status": fusion["status"],
        "interaction_type": interaction_type,
        "classification_reason": classification_reason,
        "mission_readiness_score": fusion["readiness_score"],
        "integrated_strain_index": round(float(fusion["total_strain"]), 3),
        "base_strain_index": round(float(fusion["base_strain"]), 3),
        "synergy_penalty": round(float(fusion["synergy_penalty"]), 3),
        "domain_scores": scores,
        "primary_domain": max(scores, key=scores.get),
        "iss_module": analysis.get("iss_module") or analysis.get("affected_module") or ml_context.get("iss_module"),
        "affected_module": analysis.get("affected_module") or ml_context.get("affected_module"),
        "cross_system_insights": fusion["triggered_insights"],
        "module_details": analysis.get("module_details") or ml_context.get("module_details"),
        "vitals": analysis.get("vitals") or ml_context.get("vitals"),
        "source": "FRONTEND_ANALYSIS+LIVE_TELEMETRY",
        "analysis_age_seconds": 0,
    }


def _respiratory_protocol(
    metrics: Dict[str, Any], severity: str, message: str, name: str
) -> Tuple[str, List[str], List[Dict[str, str]]]:
    """Scenario A - respiratory / hypoxia / chest pain / shortness of breath."""
    spo2 = metrics["spo2"]
    hr = metrics["heart_rate"]
    resp = metrics["respiration"]
    module = metrics["module"]
    cardio = metrics["cardiovascular_risk"]
    trend = (
        "critically hypoxic"
        if spo2 < 90
        else "below the 92% target"
        if spo2 < 92
        else "currently within the acceptable range"
    )
    reply = (
        f"{severity} — RESPIRATORY / HYPOXIC EMERGENCY in {module}. {name}, you reported: \"{message}\". "
        f"Live pulse oximetry reads SpO₂ {spo2:.0f}% ({trend}) with HR {hr:.0f} bpm and respiration "
        f"{resp:.0f}/min; the cardiovascular .joblib model scores {cardio:.2f} risk. Protect the airway, "
        f"drive SpO₂ back to ≥ 92%, and escalate immediately if it falls below 88%."
    )
    equipment = [
        "Portable Breathing Apparatus (PBA)",
        "ISS Pulse Oximeter",
        "Crew Medical Restraint System",
    ]
    steps = [
        {
            "title": "Open the airway and restrain",
            "detail": f"Seat {name} upright in the Crew Medical Restraint System, loosen the straps, and clear the airway; use a jaw-thrust if breathing is noisy.",
            "timing": "0–20 s",
        },
        {
            "title": "Apply the PBA and pulse oximeter",
            "detail": f"Fit the Portable Breathing Apparatus, start O₂ at 2–4 L/min, and clip on the ISS Pulse Oximeter to titrate SpO₂ from {spo2:.0f}% back to ≥ 92%.",
            "timing": "20–60 s",
        },
        {
            "title": "Monitor and report the trend",
            "detail": f"Recheck SpO₂/HR every 30 seconds against the current {spo2:.0f}% / {hr:.0f} bpm and read the trend to Mission Control.",
            "timing": "Continuous",
        },
    ]
    return reply, equipment, steps


def _vestibular_protocol(
    metrics: Dict[str, Any], severity: str, message: str, name: str
) -> Tuple[str, List[str], List[Dict[str, str]]]:
    """Scenario B - vestibular / dizziness / vertigo / nausea / disorientation."""
    vor = metrics["vor_gain"]
    ves_risk = metrics["vestibular_risk"]
    module = metrics["module"]
    reply = (
        f"{severity} — VESTIBULAR / DISORIENTATION EVENT in {module}. {name}, you reported: \"{message}\". "
        f"Live VOR gain is {vor:.2f} with a kinematic anomaly score of {ves_risk:.2f}. That mismatch is "
        f"consistent with canal/otolith conflict, so freeze head movement, anchor your visual horizon, and "
        f"treat the nausea before attempting any translation."
    )
    equipment = [
        "Visual Horizon Anchor Strap",
        "Meclizine / Promethazine Med-Kit",
        "Handrail Tether",
    ]
    steps = [
        {
            "title": "Anchor and freeze the head",
            "detail": f"Tether {name} with the Visual Horizon Anchor Strap, fix the gaze on one point, and hold the head still — a VOR gain of {vor:.2f} means every head turn amplifies the vertigo.",
            "timing": "0–30 s",
        },
        {
            "title": "Give the vestibular med-kit",
            "detail": "Administer meclizine (promethazine if vomiting) from the med-kit and re-check gaze stability and nystagmus.",
            "timing": "30–90 s",
        },
        {
            "title": "Translate slowly with an escort",
            "detail": f"Move {name} along the Handrail Tether to the {module} restraint station without rapid head turns and report the VOR-gain trend to Mission Control.",
            "timing": "Continuous",
        },
    ]
    return reply, equipment, steps


def _radiation_protocol(
    metrics: Dict[str, Any], severity: str, message: str, name: str
) -> Tuple[str, List[str], List[Dict[str, str]]]:
    """Scenario C - radiation / solar flare / EVA exposure / fatigue."""
    dose = metrics["dose_rate"]
    delta = metrics["dose_delta_1d"]
    rad_risk = metrics["radiation_risk"]
    module = metrics["module"]
    reply = (
        f"{severity} — RADIATION / SOLAR PARTICLE EVENT in {module}. {name}, you reported: \"{message}\". "
        f"Live absorbed dose rate is {dose:.2f} mSv/day (24 h delta {delta:+.2f} mSv) and the radiation "
        f".joblib model scores {rad_risk:.2f} anomaly risk. Time, distance, and shielding are the only "
        f"countermeasures — relocate to the most shielded water-wall volume now and log dwell time."
    )
    equipment = [
        "Personal Active Dosimeter (PAD)",
        "Polyethylene Water-Wall Liner",
        "Potassium Iodide (KI) Pack",
    ]
    steps = [
        {
            "title": "Relocate to the shielded core",
            "detail": f"Move {name} out of the {module} to the most heavily shielded water-wall station and clip on the Personal Active Dosimeter.",
            "timing": "0–60 s",
        },
        {
            "title": "Deploy polyethylene shielding",
            "detail": f"Position the Polyethylene Water-Wall Liner between the crew and the hull, then log the {dose:.2f} mSv/day rate and exposure time.",
            "timing": "60–180 s",
        },
        {
            "title": "Distribute KI and report",
            "detail": "Issue the Potassium Iodide (KI) pack per protocol, survey skin and clothing, and read the cumulative dose to Mission Control.",
            "timing": "Continuous",
        },
    ]
    return reply, equipment, steps


def _musculoskeletal_protocol(
    metrics: Dict[str, Any], severity: str, message: str, name: str
) -> Tuple[str, List[str], List[Dict[str, str]]]:
    """Scenario D - musculoskeletal / cramp / back pain / injury / fracture."""
    stress = metrics["transcriptional_stress"]
    pc1 = metrics["pc1_axis"]
    mus_risk = metrics["musculoskeletal_risk"]
    module = metrics["module"]
    reply = (
        f"{severity} — MUSCULOSKELETAL INJURY / STRAIN in {module}. {name}, you reported: \"{message}\". "
        f"Live transcriptional/EMG stress is {stress:.2f} (PC1 microgravity axis {pc1:.2f}) with a "
        f"musculoskeletal .joblib risk of {mus_risk:.2f}. Offload the affected segment now and confirm "
        f"distal neurovascular status before any repositioning."
    )
    equipment = [
        "Ultrasound Bone/Muscle Scanner",
        "ISS Cold Compress & Analgesic Kit",
        "ARED Lockout Pin",
    ]
    steps = [
        {
            "title": "Offload and lock the ARED",
            "detail": f"Stop the current exercise, insert the ARED Lockout Pin, and float {name} into a neutral, unloaded posture.",
            "timing": "0–60 s",
        },
        {
            "title": "Scan and compress",
            "detail": f"Run the Ultrasound Bone/Muscle Scanner over the painful segment (stress {stress:.2f}), then apply the ISS Cold Compress & Analgesic Kit.",
            "timing": "60–120 s",
        },
        {
            "title": "Recheck distal function and report",
            "detail": f"Confirm pulse, sensation, and movement beyond the injury, re-scan every 15 minutes, and report the {stress:.2f} stress-score trend to Mission Control.",
            "timing": "Continuous",
        },
    ]
    return reply, equipment, steps


_STATUS_DOMAIN_EQUIPMENT: Dict[str, List[str]] = {
    "radiation": ["Personal Active Dosimeter (PAD)", "Radiation Survey Meter"],
    "musculoskeletal": ["Ultrasound Bone/Muscle Scanner", "ARED Lockout Pin"],
    "vestibular": ["Visual Horizon Anchor Strap", "VOR Goggles / Eye Tracker"],
    "cardiovascular": ["ISS Pulse Oximeter", "12-Lead ECG / Rhythm Monitor"],
}

_STATUS_DOMAIN_METRIC: Dict[str, str] = {
    "radiation": "absorbed dose rate {dose:.2f} mSv/day",
    "musculoskeletal": "transcriptional/EMG stress {stress:.2f}",
    "vestibular": "VOR gain {vor:.2f}",
    "cardiovascular": "SpO₂ {spo2:.0f}% / HR {hr:.0f} bpm",
}


def _domain_metric_phrase(domain: str, metrics: Dict[str, Any]) -> str:
    template = _STATUS_DOMAIN_METRIC.get(domain, "{score:.2f}")
    return template.format(
        dose=metrics["dose_rate"],
        stress=metrics["transcriptional_stress"],
        vor=metrics["vor_gain"],
        spo2=metrics["spo2"],
        hr=metrics["heart_rate"],
        score=metrics["scores"].get(domain, 0.0),
    )


def _status_protocol(
    metrics: Dict[str, Any],
    severity: str,
    message: str,
    name: str,
    role: str,
    prior_question: str,
) -> Tuple[str, List[str], List[Dict[str, str]]]:
    """Scenario E - status report / diagnosis / custom open question.

    Synthesises a bespoke briefing from the astronaut's exact name, the live
    .joblib risk ranking, the fusion interaction type, and the user's own words,
    so no two questions return the same clinical answer.
    """
    ranked = sorted(metrics["scores"].items(), key=lambda item: item[1], reverse=True)
    primary_key, primary_score = ranked[0]
    secondary_key, secondary_score = ranked[1]
    elevated = [(key, value) for key, value in ranked if value >= 0.60]
    primary_label = DOMAIN_LABELS.get(primary_key, primary_key)
    secondary_label = DOMAIN_LABELS.get(secondary_key, secondary_key)
    interaction = metrics["interaction_type"]
    readiness = metrics["readiness"]
    strain = metrics["strain"]

    if elevated:
        risk_clause = (
            f"{len(elevated)} of your four .joblib domains are elevated — "
            + ", ".join(f"{DOMAIN_LABELS.get(key, key)} {value:.2f}" for key, value in elevated)
            + f" — and the fusion layer labels the interaction {interaction}."
        )
    else:
        risk_clause = (
            f"No domain crosses the 0.60 anomaly threshold; your highest is {primary_label} at "
            f"{primary_score:.2f} ({_domain_metric_phrase(primary_key, metrics)})."
        )

    follow_up = f" This follows your earlier report: \"{prior_question}\"." if prior_question else ""
    action = (
        "Escalate to Mission Control now."
        if severity == "CRITICAL"
        else "Monitor closely and report any worsening trend."
    )
    reply = (
        f"{severity} — FLIGHT SURGEON STATUS BRIEFING for {name} ({role}) in {metrics['module']}. "
        f"You asked: \"{message}\".{follow_up} {risk_clause} Integrated strain {strain:.2f}, mission "
        f"readiness {readiness:.0f}%, consensus {interaction}. Primary focus is {primary_label} "
        f"({primary_score:.2f}, {_domain_metric_phrase(primary_key, metrics)}); secondary watch is "
        f"{secondary_label} ({secondary_score:.2f}, {_domain_metric_phrase(secondary_key, metrics)}). "
        f"Live vitals: SpO₂ {metrics['spo2']:.0f}% · HR {metrics['heart_rate']:.0f} bpm · respiration "
        f"{metrics['respiration']:.0f}/min · core {metrics['core_temp']:.1f}°C. {action}"
    )

    equipment = list(
        _STATUS_DOMAIN_EQUIPMENT.get(primary_key, _STATUS_DOMAIN_EQUIPMENT["cardiovascular"])
    )
    for item in _STATUS_DOMAIN_EQUIPMENT.get(secondary_key, []):
        if item not in equipment:
            equipment.append(item)
    equipment.append("ISS Medical Checklist + Comms")

    steps = [
        {
            "title": f"Stabilise the {primary_label} system",
            "detail": f"Treat {primary_label} first — {_domain_metric_phrase(primary_key, metrics)} at {primary_score:.2f} risk; secure {name} and apply the {equipment[0]}.",
            "timing": "0–60 s",
        },
        {
            "title": f"Rule out {secondary_label}",
            "detail": f"Your next-highest score is {secondary_label} ({secondary_score:.2f}) — {_domain_metric_phrase(secondary_key, metrics)}; screen it before clearing {name}.",
            "timing": "60–180 s",
        },
        {
            "title": "Re-run the .joblib panel and report",
            "detail": f"Re-upload {name}'s telemetry to refresh all four domain models, then read the {interaction} consensus and {readiness:.0f}% readiness to Mission Control.",
            "timing": "Continuous",
        },
    ]
    return reply, equipment, steps


def _telemetry_number(telemetry: Dict[str, Any], *keys: str, default: float) -> float:
    lower = {str(key).lower(): value for key, value in (telemetry or {}).items()}
    for key in keys:
        value = lower.get(key.lower())
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return float(default)


def _telemetry_text(telemetry: Dict[str, Any], *keys: str, default: str) -> str:
    lower = {str(key).lower(): value for key, value in (telemetry or {}).items()}
    for key in keys:
        value = lower.get(key.lower())
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


CHAT_ANALYSIS_MAX_AGE_SECONDS = 6 * 60 * 60


def _normalise_chat_telemetry(
    telemetry: Dict[str, Any], latest: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    latest = latest or {}
    latest_vitals = latest.get("vitals") or {}
    default_module = str(latest.get("iss_module") or latest.get("affected_module") or "US Lab")
    default_mode = str(latest.get("interaction_type") or "NOMINAL").upper()

    return {
        "spo2": float(np.clip(_telemetry_number(telemetry, "spo2", "SpO2", "oxygen_saturation", default=float(latest_vitals.get("spo2") or 98.0)), 0.0, 100.0)),
        "heart_rate": float(np.clip(_telemetry_number(telemetry, "heartRate", "heart_rate", "hr", "heart_rate_bpm", default=float(latest_vitals.get("heart_rate") or 62.0)), 0.0, 260.0)),
        "respiration": float(np.clip(_telemetry_number(telemetry, "respiration", "resp_rate", "respiratory_rate", default=float(latest_vitals.get("respiration") or 15.0)), 0.0, 80.0)),
        "core_temp": float(np.clip(_telemetry_number(telemetry, "coreTemp", "core_temp", "temperature", default=float(latest_vitals.get("core_temp") or 36.8)), 25.0, 45.0)),
        "iss_module": _telemetry_text(telemetry, "issModule", "iss_module", "module", default=default_module),
        "interaction_mode": _telemetry_text(telemetry, "interactionMode", "interaction_mode", "mode", default=default_mode).upper(),
    }


def _live_ml_assessment(telemetry: Dict[str, Any]) -> Dict[str, Any]:
    """Run the four domain .joblib models against live chat telemetry.

    Live vitals drive the cardiovascular model; domains without live inputs use
    their safe astronaut baselines from the trained bundles.
    """
    med = _require_bundle("cardiovascular")["healthy_reference_medians"]
    cardio = CardiovascularInput(
        hr_mean=float(telemetry["heart_rate"]),
        hr_std=float(med.get("hr_std", 1.5)) or 1.5,
        hrv_rmssd_ms=float(med.get("hrv_rmssd_ms", 36.0)),
        hrv_sdnn_ms=float(med.get("hrv_sdnn_ms", 33.0)),
        spo2_mean=float(telemetry["spo2"]),
        spo2_min=float(telemetry["spo2"]),
        resp_mean=float(telemetry["respiration"]),
        resp_std=float(med.get("resp_std", 0.7)) or 0.7,
        mode="CHAT_LIVE_TELEMETRY",
    )

    module_frame = pd.DataFrame([{"module": _canonical_module(telemetry.get("iss_module"), "US Lab")}])
    rad_input, module = _build_radiation_input(module_frame)
    mus_input = _build_muscle_input(pd.DataFrame())
    ves_input = _build_vestibular_input(pd.DataFrame())

    rad_res = run_radiation_inference(rad_input)
    mus_res = run_muscle_inference(mus_input)
    ves_res = run_vestibular_inference(ves_input)
    car_res = run_cardio_inference(cardio)

    domain_scores = _domain_scores_from_modules(rad_res, mus_res, ves_res, car_res)
    fusion = _fuse_domain_scores(domain_scores)
    interaction_type, classification_reason = _classify_interaction(domain_scores, fusion["triggered_insights"])

    return {
        "analysis_id": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "LIVE_TELEMETRY_INFERENCE",
        "astronaut_id": "AST-01",
        "status": fusion["status"],
        "interaction_type": interaction_type,
        "classification_reason": classification_reason,
        "mission_readiness_score": fusion["readiness_score"],
        "integrated_strain_index": round(float(fusion["total_strain"]), 3),
        "base_strain_index": round(float(fusion["base_strain"]), 3),
        "synergy_penalty": round(float(fusion["synergy_penalty"]), 3),
        "domain_scores": domain_scores,
        "vitals": {
            "spo2": telemetry["spo2"],
            "heart_rate": telemetry["heart_rate"],
            "respiration": telemetry["respiration"],
            "core_temp": telemetry["core_temp"],
        },
        "primary_domain": max(domain_scores, key=domain_scores.get),
        "iss_module": module,
        "affected_module": module,
        "cross_system_insights": fusion["triggered_insights"],
        "module_details": {
            "radiation": rad_res,
            "musculoskeletal": mus_res,
            "vestibular": ves_res,
            "cardiovascular": car_res,
        },
        "data_mode": "CHAT_LIVE_TELEMETRY",
    }


def _chat_ml_context(
    telemetry: Dict[str, Any], latest: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Combine the latest upload assessment with the current live telemetry."""
    latest = latest if latest is not None else _latest_analysis_snapshot()
    live = _live_ml_assessment(telemetry)
    age = _analysis_age_seconds(latest)

    if not latest or age is None or age > CHAT_ANALYSIS_MAX_AGE_SECONDS or not latest.get("domain_scores"):
        live["analysis_age_seconds"] = None
        return live

    latest_scores = latest.get("domain_scores") or {}
    scores = {
        key: float(latest_scores.get(key, live["domain_scores"].get(key, 0.0)))
        for key in DOMAIN_MODEL_KEYS
    }
    # Live vitals always own the cardiovascular score so the advice follows the
    # current pulse oximetry and heart-rate reading.
    scores["cardiovascular"] = live["domain_scores"]["cardiovascular"]

    fusion = _fuse_domain_scores(scores)
    interaction_type, classification_reason = _classify_interaction(scores, fusion["triggered_insights"])

    return {
        **latest,
        "domain_scores": scores,
        "status": fusion["status"],
        "interaction_type": interaction_type,
        "classification_reason": classification_reason,
        "mission_readiness_score": fusion["readiness_score"],
        "integrated_strain_index": round(float(fusion["total_strain"]), 3),
        "base_strain_index": round(float(fusion["base_strain"]), 3),
        "synergy_penalty": round(float(fusion["synergy_penalty"]), 3),
        "cross_system_insights": fusion["triggered_insights"],
        "source": "LATEST_ANALYSIS+LIVE_TELEMETRY",
        "analysis_age_seconds": round(age, 1),
        "live_module_details": live.get("module_details"),
    }


def _severity_rank(value: str) -> int:
    return {"ADVISORY": 0, "URGENT": 1, "CRITICAL": 2}.get(value.upper(), 0)


def _chat_severity(
    message: str, telemetry: Dict[str, Any], ml_context: Optional[Dict[str, Any]] = None
) -> str:
    text = message.lower()
    critical_words = [
        "can't breathe",
        "cannot breathe",
        "unconscious",
        "not breathing",
        "collapsed",
        "severe chest pain",
        "bleeding",
        "seizure",
        "unresponsive",
    ]
    urgent_words = ["severe", "sudden", "worsening", "shortness of breath", "chest pain", "vertigo", "injury"]

    severity = "ADVISORY"
    if (
        telemetry["spo2"] < 90
        or telemetry["heart_rate"] > 130
        or telemetry["heart_rate"] < 40
        or telemetry["respiration"] > 30
        or telemetry["core_temp"] >= 39.5
        or any(word in text for word in critical_words)
    ):
        severity = "CRITICAL"
    elif (
        telemetry["spo2"] < 94
        or telemetry["heart_rate"] > 115
        or telemetry["respiration"] > 24
        or telemetry["core_temp"] >= 38.5
        or any(word in text for word in urgent_words)
    ):
        severity = "URGENT"

    if ml_context:
        scores = ml_context.get("domain_scores") or {}
        max_risk = max((float(value) for value in scores.values()), default=0.0)
        interaction = str(ml_context.get("interaction_type") or "").upper()
        status = str(ml_context.get("status") or "").upper()
        if max_risk >= 0.80 or interaction == "SYNERGISTIC" or status == "HIGH_STRAIN_ALERT":
            ml_severity = "CRITICAL"
        elif max_risk >= 0.60 or status == "ELEVATED_MONITORING":
            ml_severity = "URGENT"
        else:
            ml_severity = "ADVISORY"
        if _severity_rank(ml_severity) > _severity_rank(severity):
            severity = ml_severity

    return severity


def _ml_context_summary(ml_context: Dict[str, Any]) -> str:
    scores = ml_context.get("domain_scores") or {}
    risk_text = " · ".join(
        f"{DOMAIN_LABELS.get(key, key)} {float(scores.get(key, 0.0)):.2f}" for key in DOMAIN_MODEL_KEYS
    )
    insights = ml_context.get("cross_system_insights") or []
    insight_text = ""
    if insights:
        insight_text = " Cross-system rules: " + "; ".join(
            str(insight.get("title") or insight.get("id")) for insight in insights
        ) + "."
    readiness = float(ml_context.get("mission_readiness_score") or 0.0)
    return (
        f"ML RISK [{ml_context.get('source', 'MODEL_INFERENCE')}]: {risk_text}. "
        f"Consensus {ml_context.get('interaction_type', 'ADDITIVE')} · "
        f"readiness {readiness:.0f}% · integrated strain "
        f"{float(ml_context.get('integrated_strain_index') or 0.0):.2f}.{insight_text}"
    )


@app.post("/api/health/upload-analyze")
async def upload_and_analyze_health(file: UploadFile = File(...)):
    raw = await file.read()
    filename = file.filename or "uploaded_dataset"
    df = _parse_health_upload(filename, raw)
    result = _upload_analysis(df, filename)
    _remember_analysis(result)
    return result


@app.post("/api/chat/emergency")
def emergency_flight_surgeon_chat(payload: EmergencyChatRequest):
    latest = _latest_analysis_snapshot()
    incoming = payload.telemetry or payload.liveTelemetry or {}
    telemetry = _normalise_chat_telemetry(incoming, latest)
    ml_context = _chat_ml_context(telemetry, latest)

    # Prefer the exact .joblib result the frontend is currently showing for this
    # astronaut; fall back to the server's newest cached upload or live inference.
    payload_analysis = payload.analysis_result or payload.analysisResult
    if payload_analysis and payload_analysis.get("domain_scores"):
        ml_context = _merge_payload_analysis(ml_context, payload_analysis, telemetry)

    metrics = _chat_metrics(ml_context, telemetry)
    severity = _chat_severity(payload.message, telemetry, ml_context)
    scenario = _chat_scenario(payload.message)

    astronaut = payload.astronaut or {}
    name = str(astronaut.get("name") or astronaut.get("astronaut_name") or "Crew member").strip() or "Crew member"
    role = str(astronaut.get("role") or astronaut.get("type") or "ISS crew").strip() or "ISS crew"
    profile_module = str(astronaut.get("issModule") or astronaut.get("iss_module") or "").strip()
    if profile_module:
        metrics["module"] = profile_module

    history = payload.conversation_history or []
    prior_user_questions = [
        str(entry.get("content") or entry.get("message") or "").strip()
        for entry in history
        if str(entry.get("role") or entry.get("sender") or "").lower() == "user"
    ]
    prior_question = prior_user_questions[-1] if prior_user_questions else ""

    clean_message = payload.message.strip()
    if scenario == "respiratory":
        reply, equipment, steps = _respiratory_protocol(metrics, severity, clean_message, name)
    elif scenario == "vestibular":
        reply, equipment, steps = _vestibular_protocol(metrics, severity, clean_message, name)
    elif scenario == "radiation":
        reply, equipment, steps = _radiation_protocol(metrics, severity, clean_message, name)
    elif scenario == "musculoskeletal":
        reply, equipment, steps = _musculoskeletal_protocol(metrics, severity, clean_message, name)
    else:
        reply, equipment, steps = _status_protocol(
            metrics, severity, clean_message, name, role, prior_question
        )

    domain_scores = ml_context.get("domain_scores") or {}
    max_risk = max((float(value) for value in domain_scores.values()), default=0.0)
    telemetry_alert = (
        f"LIVE VITALS: SpO2 {metrics['spo2']:.0f}% • HR {metrics['heart_rate']:.0f} BPM • "
        f"{ml_context.get('interaction_type', metrics['interaction_mode'])} • "
        f"ML MAX RISK {max_risk:.2f} — {severity}"
    )

    compact_ml_context = {
        "source": ml_context.get("source"),
        "analysis_id": ml_context.get("analysis_id") or ml_context.get("latest_analysis_id"),
        "timestamp": ml_context.get("timestamp"),
        "analysis_age_seconds": ml_context.get("analysis_age_seconds"),
        "status": ml_context.get("status"),
        "interaction_type": ml_context.get("interaction_type"),
        "classification_reason": ml_context.get("classification_reason"),
        "mission_readiness_score": ml_context.get("mission_readiness_score"),
        "integrated_strain_index": ml_context.get("integrated_strain_index"),
        "primary_domain": ml_context.get("primary_domain"),
        "domain_scores": {key: round(float(value), 3) for key, value in domain_scores.items()},
        "insights": [
            {"id": insight.get("id"), "title": insight.get("title")}
            for insight in (ml_context.get("cross_system_insights") or [])
        ],
    }

    return {
        "reply": reply,
        "telemetry_alert": telemetry_alert,
        "equipment": equipment,
        "steps": steps,
        "severity": severity,
        "domain": scenario,
        "scenario": scenario,
        "status": severity,
        "astronaut": {
            "id": astronaut.get("id") or astronaut.get("astronaut_id") or "AST-01",
            "name": name,
            "role": role,
            "iss_module": metrics["module"],
        },
        "ml_risk_scores": compact_ml_context["domain_scores"],
        "ml_interaction_type": ml_context.get("interaction_type"),
        "ml_status": ml_context.get("status"),
        "ml_primary_domain": ml_context.get("primary_domain"),
        "ml_source": ml_context.get("source"),
        "ml_analysis_id": compact_ml_context["analysis_id"],
        "ml_readiness_score": ml_context.get("mission_readiness_score"),
        "max_ml_risk": round(max_risk, 3),
        "ml_context": compact_ml_context,
        "models_online": [entry["name"] for entry in MODEL_STATUS],
        "disclaimer": "Decision-support only. This is not a clinically validated diagnosis.",
    }
