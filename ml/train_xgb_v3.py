"""
Train SentinelAI NIDS v3 on CIC + lab merged CSV.

Keeps v2 artefacts frozen. Writes:
  models/sentinel_xgb_v3.pkl
  models/label_encoder_v3.pkl
  models/feature_columns_v3.pkl
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from paths import DATA_PROCESSED, MODELS_DIR

MERGED_CSV = DATA_PROCESSED / "cic_lab_merged_clean.csv"
MODEL_XGB = MODELS_DIR / "sentinel_xgb_v3.pkl"
MODEL_ENCODER = MODELS_DIR / "label_encoder_v3.pkl"
MODEL_FEATURES = MODELS_DIR / "feature_columns_v3.pkl"


def main() -> None:
    if not MERGED_CSV.exists():
        raise SystemExit(
            f"Missing {MERGED_CSV}. Run: python ml/build_merged_dataset.py"
        )

    df = pd.read_csv(MERGED_CSV)
    y = df["Label"]
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    X = df.drop(columns=["Label", "Dst Port"], errors="ignore")
    print("X shape (no Dst Port):", X.shape)
    print("Classes:", list(le.classes_))
    print(y.value_counts().to_string())

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y_encoded,
        test_size=0.2,
        random_state=42,
        stratify=y_encoded,
    )
    sample_weight = compute_sample_weight(class_weight="balanced", y=y_train)

    xgb = XGBClassifier(
        random_state=42,
        n_estimators=350,
        max_depth=7,
        learning_rate=0.07,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=2,
        eval_metric="mlogloss",
        tree_method="hist",
    )
    xgb.fit(X_train, y_train, sample_weight=sample_weight)

    labels = list(range(len(le.classes_)))
    y_pred = xgb.predict(X_test)
    print("\n========== Merged v3 holdout ==========")
    print("Accuracy:", accuracy_score(y_test, y_pred))
    print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred, labels=labels))
    print(
        classification_report(
            y_test,
            y_pred,
            labels=labels,
            target_names=list(le.classes_),
            zero_division=0,
        )
    )

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(xgb, MODEL_XGB)
    joblib.dump(le, MODEL_ENCODER)
    joblib.dump(list(X.columns), MODEL_FEATURES)
    print("\nSaved:")
    print(MODEL_XGB)
    print(MODEL_ENCODER)
    print(MODEL_FEATURES)
    print("n_features:", len(X.columns))


if __name__ == "__main__":
    main()
