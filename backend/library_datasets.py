"""Prepared NASA/ISS demonstration datasets for the MYOSHIELD dataset library.

Every dataset is a genuine tabular sample (not a placeholder): its rows use the
same column names that ``POST /api/health/upload-analyze`` understands, so the
frontend can send a library dataset straight through the bundled ``.joblib``
models. The samples are generated from the models' published reference ranges,
never presented as real astronaut medical records.
"""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional

import numpy as np

DOMAIN_MODEL_KEYS = ("radiation", "musculoskeletal", "vestibular", "cardiovascular")

_DISCLAIMER = (
    "Prepared demonstration data. MYOSHIELD is a research decision-support tool, "
    "not a clinically validated diagnostic system."
)


def _base_rows(
    rng: np.random.Generator,
    count: int,
    module: str = "US Lab",
    condition: str = "Ground_Control",
) -> List[Dict[str, Any]]:
    """Nominal multi-system telemetry shaped like the backend's recognised columns."""
    rows: List[Dict[str, Any]] = []
    for _ in range(count):
        rows.append(
            {
                "astronaut_id": "AST-01",
                "iss_module": module,
                "instrument": "RAD",
                "module": module,
                "condition": condition,
                "age_group": "Older_65_80",
                "absorbed_dose_rate": round(float(max(1.0, rng.normal(11.6, 0.35))), 4),
                "rolling_mean_7d": round(float(max(1.0, rng.normal(11.6, 0.25))), 4),
                "dose_delta_1d": round(float(rng.normal(0.0, 0.12)), 4),
                "heart_rate_bpm": round(float(rng.normal(89.0, 2.2)), 4),
                "spo2_pct": round(float(np.clip(rng.normal(97.5, 0.3), 90.0, 100.0)), 4),
                "resp_rate_bpm": round(float(rng.normal(17.9, 0.45)), 4),
                "hrv_rmssd_ms": round(float(max(5.0, rng.normal(36.0, 2.5))), 4),
                "hrv_sdnn_ms": round(float(max(5.0, rng.normal(32.7, 2.5))), 4),
                "body_temp_c": round(float(rng.normal(36.7, 0.1)), 4),
                "head_vel_hor_std": round(float(rng.normal(56.5, 3.0)), 4),
                "head_vel_ver_std": round(float(rng.normal(4.7, 0.35)), 4),
                "head_acc_hor_rms": round(float(max(0.05, rng.normal(0.96, 0.07))), 4),
                "eye_vel_hor_std": round(float(rng.normal(501.0, 25.0)), 4),
                "eye_vel_ver_std": round(float(rng.normal(152.0, 9.0)), 4),
                "eye_peak_vel_p95": round(float(rng.normal(753.0, 35.0)), 4),
                "vor_gain_proxy": round(float(max(0.05, rng.normal(2.13, 0.12))), 4),
                "eye_head_corr": round(float(np.clip(rng.normal(-0.65, 0.04), -1.0, 1.0)), 4),
                "eye_to_head_rms_ratio": round(float(max(0.05, rng.normal(1.5, 0.12))), 4),
            }
        )
    return rows


def _override(
    rows: List[Dict[str, Any]],
    rng: np.random.Generator,
    **values: float,
) -> None:
    """Set a lightly jittered constant for every row."""
    for key, target in values.items():
        for row in rows:
            jitter = abs(target) * 0.004 if target else 0.0
            row[key] = round(float(target + rng.normal(0.0, jitter)), 4)


def _spec(
    *,
    dataset_id: str,
    name: str,
    description: str,
    source: str,
    rows: List[Dict[str, Any]],
    category: str,
    expected_severity: str,
    file_name: str,
    limitation: str,
    domains: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        "id": dataset_id,
        "name": name,
        "description": description,
        "source": source,
        "domains": domains or list(DOMAIN_MODEL_KEYS),
        "category": category,
        "expected_severity": expected_severity,
        "file_name": file_name,
        "limitation": limitation,
        "rows": rows,
        "record_count": len(rows),
        "columns": list(rows[0].keys()) if rows else [],
        "data_mode": "DEMO_SIMULATION",
        "disclaimer": _DISCLAIMER,
    }


def build_library_specs() -> List[Dict[str, Any]]:
    """Return fresh copies of every prepared library dataset."""
    rng = np.random.default_rng(2026)
    specs: List[Dict[str, Any]] = []

    # 1) Nominal multi-system baseline (US Lab).
    specs.append(
        _spec(
            dataset_id="ISS-NOMINAL-USLAB",
            name="ISS Nominal Multi-System Baseline (US Lab)",
            description=(
                "Prepared 24-record baseline of routine ISS US Lab telemetry covering radiation, "
                "cardio-respiratory, vestibular kinematics and a ground-control musculoskeletal profile."
            ),
            source="Prepared from NASA OSDR / ISS telemetry reference ranges",
            rows=_base_rows(rng, 24, module="US Lab"),
            category="baseline",
            expected_severity="NOMINAL",
            file_name="iss_nominal_uslab_baseline.csv",
            limitation=(
                "Demonstration sample generated from model reference ranges. It is not a beat-for-beat "
                "NASA crew record and must not be used for clinical decisions."
            ),
        )
    )

    # 2) Nominal sleep / recovery baseline (Node 2).
    node2 = _base_rows(rng, 24, module="Node 2")
    _override(
        node2,
        rng,
        absorbed_dose_rate=14.85,
        rolling_mean_7d=14.8,
        dose_delta_1d=0.05,
        heart_rate_bpm=78.0,
        spo2_pct=98.2,
        resp_rate_bpm=16.0,
        hrv_rmssd_ms=44.0,
        hrv_sdnn_ms=41.0,
    )
    specs.append(
        _spec(
            dataset_id="ISS-NOMINAL-NODE2-SLEEP",
            name="ISS Node 2 Crew Sleep & Recovery Baseline",
            description=(
                "Prepared 24-record overnight baseline from Node 2 with resting heart rate, stable "
                "oxygen saturation and normal vestibular micro-movements for comparison against strain."
            ),
            source="Prepared from NASA OSDR / ISS telemetry reference ranges",
            rows=node2,
            category="baseline",
            expected_severity="NOMINAL",
            file_name="iss_node2_sleep_recovery_baseline.csv",
            limitation=(
                "Demonstration sample generated from model reference ranges. Sleep and recovery values "
                "are illustrative, not a real crew medical record."
            ),
        )
    )

    # 3) Elevated radiation watch: single-domain anomaly.
    radiation_watch = _base_rows(rng, 24, module="US Lab")
    _override(
        radiation_watch,
        rng,
        absorbed_dose_rate=21.5,
        rolling_mean_7d=12.4,
        dose_delta_1d=4.2,
    )
    specs.append(
        _spec(
            dataset_id="ISS-RAD-SAA-WATCH",
            name="ISS South Atlantic Anomaly Radiation Watch",
            description=(
                "Prepared 24-record pass through the South Atlantic Anomaly with a rising absorbed dose "
                "rate while the other systems stay at their nominal reference values."
            ),
            source="Prepared from NASA RadLab environmental telemetry patterns",
            rows=radiation_watch,
            category="anomaly",
            expected_severity="ELEVATED_MONITORING",
            file_name="iss_saa_radiation_watch.csv",
            limitation=(
                "Environmental dose-rate sample. It is not a personal absorbed-dose measurement and "
                "does not estimate an individual astronaut's exposure."
            ),
        )
    )

    # 4) CRITICAL: solar particle event during EVA telemetry.
    spe_eva = _base_rows(rng, 24, module="US Lab")
    _override(
        spe_eva,
        rng,
        absorbed_dose_rate=28.5,
        rolling_mean_7d=11.9,
        dose_delta_1d=6.4,
        heart_rate_bpm=138.0,
        spo2_pct=87.0,
        resp_rate_bpm=29.0,
        hrv_rmssd_ms=11.0,
        hrv_sdnn_ms=13.0,
        body_temp_c=38.4,
        head_vel_hor_std=122.0,
        head_vel_ver_std=21.0,
        head_acc_hor_rms=4.3,
        eye_vel_hor_std=940.0,
        eye_vel_ver_std=330.0,
        eye_peak_vel_p95=1350.0,
        vor_gain_proxy=0.45,
        eye_head_corr=0.42,
        eye_to_head_rms_ratio=5.2,
    )
    specs.append(
        _spec(
            dataset_id="ISS-SPE-EVA-TELEMETRY",
            name="ISS Solar Particle Event + EVA Telemetry",
            description=(
                "Critical multi-stressor sample: a rising solar-particle dose rate during EVA together "
                "with hypoxia, tachycardia and eye-head kinematic instability. Designed to trigger the "
                "vestibular + autonomic cross-system synergy rule."
            ),
            source="Prepared from NASA RadLab + ISS EVA physiology patterns",
            rows=spe_eva,
            category="critical",
            expected_severity="HIGH_STRAIN_ALERT",
            file_name="iss_solar_particle_event_eva.csv",
            limitation=(
                "Multi-stressor demonstration sample built from model reference ranges. Not a real EVA "
                "medical record and not a clinically validated diagnosis."
            ),
        )
    )

    # 5) CRITICAL: long-duration microgravity muscle + vestibular drift.
    muscle_vest = _base_rows(rng, 24, module="US Lab", condition="Space_Flight")
    _override(
        muscle_vest,
        rng,
        head_vel_hor_std=122.0,
        head_vel_ver_std=21.0,
        head_acc_hor_rms=4.3,
        eye_vel_hor_std=940.0,
        eye_vel_ver_std=330.0,
        eye_peak_vel_p95=1350.0,
        vor_gain_proxy=0.45,
        eye_head_corr=0.42,
        eye_to_head_rms_ratio=5.2,
        heart_rate_bpm=124.0,
        spo2_pct=89.0,
        resp_rate_bpm=27.0,
        hrv_rmssd_ms=10.0,
        hrv_sdnn_ms=11.0,
        body_temp_c=37.9,
    )
    specs.append(
        _spec(
            dataset_id="ISS-MICROGRAVITY-MUSCLE-VESTIBULAR",
            name="Long-Duration Microgravity Muscle + Vestibular Drift",
            description=(
                "Critical multi-stressor sample from a long-duration mission: spaceflight muscle "
                "transcriptional stress, vestibular/VOR drift and secondary autonomic strain. Designed "
                "to trigger the vestibular-autonomic and multi-system deconditioning rules."
            ),
            source="Prepared from NASA OSDR OSD-684 + ICPSR 235362 reference profiles",
            rows=muscle_vest,
            category="critical",
            expected_severity="HIGH_STRAIN_ALERT",
            file_name="iss_microgravity_muscle_vestibular_drift.csv",
            limitation=(
                "Multi-stressor demonstration sample. Gene-expression and vestibular values are prepared "
                "references, not measurements from a named astronaut."
            ),
            domains=["musculoskeletal", "vestibular", "cardiovascular", "radiation"],
        )
    )

    return copy.deepcopy(specs)
