"""
Score one finished process run with the trained HIDS Isolation Forest.

The saved pipeline (models/hids_isolation_forest.joblib) was fit on Normal runs only.
A run is anomalous when decision_function(X) < threshold. Lower decision scores are
more anomalous; SOAR wants the opposite, so anomaly_score is mapped to 0..1 with
higher meaning more anomalous.

Features are the same four the trainer saved in the bundle:
log_life, from_user_space, from_temp_or_downloads, parent_is_shell.

Run from repo root:
  python -m hids.predict
"""
from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import Any, Mapping

import joblib
import pandas as pd

from hids.dataset.features import Corpus, build_run_features

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL = os.path.join(os.path.dirname(BASE_DIR), "models", "hids_isolation_forest.joblib")

# decision_function gaps on this model are small (a stealer sits ~0.02-0.06 below
# the threshold). This width turns that gap into a 0..1 score SOAR can use.
ANOMALY_WIDTH = 0.02


@dataclass(frozen=True)
class Prediction:
    label: str
    confidence: float
    anomaly_score: float
    decision_score: float
    threshold: float
    is_anomalous: bool
    features: dict


def anomaly_score_from_decision(decision: float, threshold: float, width: float = ANOMALY_WIDTH) -> float:
    """Map a decision score to 0..1. The threshold lands at 0.5; below it rises toward 1."""
    gap = (threshold - decision) / width
    score = 1.0 / (1.0 + math.exp(-gap))
    return float(min(1.0, max(0.0, score)))


def confidence_from_anomaly(anomaly_score: float) -> float:
    """1 at either extreme, 0 when the score sits on the threshold."""
    return float(min(1.0, abs(anomaly_score - 0.5) * 2.0))


class IsolationForestPredictor:
    """Loads the saved pipeline and scores one process-sensor EXIT/END row."""

    def __init__(self, model_path: str = DEFAULT_MODEL):
        bundle = joblib.load(model_path)
        self.model_path = model_path
        self.pipeline = bundle["pipeline"]
        self.numeric_features = list(bundle["numeric_features"])
        self.threshold = float(bundle["threshold"])
        self._corpus = Corpus([])

    def feature_row(self, run: Mapping[str, Any]) -> dict:
        """Same columns the trainer used. File-access columns are included only if the bundle asks for them."""
        built = build_run_features(run, self._corpus)
        built["log_life"] = math.log1p(max(0.0, float(built["lifetime_s"])))
        return {name: built.get(name, 0) for name in self.numeric_features}

    def predict(self, run: Mapping[str, Any]) -> Prediction:
        features = self.feature_row(run)
        frame = pd.DataFrame([features], columns=self.numeric_features)
        decision = float(self.pipeline.decision_function(frame)[0])
        anomalous = decision < self.threshold
        anomaly = anomaly_score_from_decision(decision, self.threshold)
        return Prediction(
            label="Stealer" if anomalous else "Normal",
            confidence=confidence_from_anomaly(anomaly),
            anomaly_score=anomaly,
            decision_score=decision,
            threshold=self.threshold,
            is_anomalous=anomalous,
            features=features,
        )


def main() -> None:
    """Score two built-in examples so the bundle can be checked without a sensor."""
    predictor = IsolationForestPredictor()
    examples = [
        {
            "event": "EXIT", "pid": 100, "create_time": 1.0,
            "process_name": "chrome.exe", "parent_name": "explorer.exe",
            "exe_path": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            "lifetime_s": 400.0,
        },
        {
            "event": "EXIT", "pid": 200, "create_time": 2.0,
            "process_name": "svchost_update.exe", "parent_name": "cmd.exe",
            "exe_path": r"C:\Users\Lab\AppData\Local\Temp\svchost_update.exe",
            "lifetime_s": 4.0,
        },
    ]
    print(f"model: {predictor.model_path}")
    print(f"features: {', '.join(predictor.numeric_features)}")
    print(f"threshold: {predictor.threshold:.4f}  (anomalous when decision_score < threshold)")
    for run in examples:
        pred = predictor.predict(run)
        print(
            f"  {run['process_name']:<22} {pred.label:<8} "
            f"anomaly {pred.anomaly_score:.2f}  confidence {pred.confidence:.2f}  "
            f"decision {pred.decision_score:.4f}"
        )


if __name__ == "__main__":
    main()
