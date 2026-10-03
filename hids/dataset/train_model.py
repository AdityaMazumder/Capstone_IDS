"""
Train the HIDS Isolation Forest (Member 2).

Reads the labelled table from build_dataset.py, trains on the NORMAL process runs
only (unsupervised anomaly detection), picks a score threshold at a target
false-positive rate, and evaluates against the labelled Stealer runs.

Reported:
  * detection rate (stealers flagged) and false-positive rate (normal flagged)
  * ROC-AUC of the anomaly score (normal vs stealer)
  * leave-one-host-out: train on some PCs, test on an unseen PC, so we know how
    well it generalises beyond the machines it was trained on

Saved to models/hids_isolation_forest.joblib: the fitted sklearn Pipeline
(preprocessing + IsolationForest), the feature list and the chosen threshold, so
SOAR / an inference helper can reproduce label + anomaly score for a new run.

Run from repo root:
  python -m hids.dataset.train_model
  python -m hids.dataset.train_model --dataset hids/dataset/hids_dataset.csv --target-fpr 0.02
"""
from __future__ import annotations

import argparse
import json
import os
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATASET = os.path.join(BASE_DIR, "hids_dataset.csv")
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(BASE_DIR)), "models")
DEFAULT_MODEL = os.path.join(MODELS_DIR, "hids_isolation_forest.joblib")

# Curated, host-independent behaviour that separates a stealer from a normal run.
# Chosen by leave-one-host-out: these generalise to an unseen PC, whereas the
# rarity features (name_freq / pair_freq) make every program on a new machine look
# rare, and extra low-signal columns let a cluster of near-identical anomalies mask
# itself in a vanilla Isolation Forest. Keep this set small and high-signal.
NUMERIC_FEATURES = [
    "log_life",               # short-lived (log of lifetime seconds)
    "from_user_space",        # ran from AppData / Temp / Downloads / Desktop / user profile
    "from_temp_or_downloads", # ran specifically from Temp or Downloads
    "parent_is_shell",        # launched by powershell / cmd / wscript / mshta / rundll32
]
CATEGORICAL_FEATURES: List[str] = []

# Add these once the file sensor has run as Administrator (event 4663 populates them):
#   file_reads, touched_password_db, touched_cookies, touched_master_key, accessed_not_owner
# Retrain with --with-file-features to include them.
FILE_FEATURES = [
    "file_reads", "touched_password_db", "touched_cookies",
    "touched_master_key", "accessed_not_owner",
]


def add_engineered(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["log_life"] = np.log1p(df["lifetime_s"].clip(lower=0))
    return df


def make_pipeline(contamination: float, seed: int,
                  numeric: List[str] = NUMERIC_FEATURES,
                  categorical: List[str] = CATEGORICAL_FEATURES) -> Pipeline:
    transformers = [("num", StandardScaler(), numeric)]
    if categorical:
        transformers.append(("cat", OneHotEncoder(handle_unknown="ignore"), categorical))
    pre = ColumnTransformer(transformers)
    forest = IsolationForest(
        n_estimators=400, contamination=contamination,
        max_samples="auto", random_state=seed, n_jobs=-1,
    )
    return Pipeline([("pre", pre), ("iforest", forest)])


def threshold_at_fpr(normal_scores: np.ndarray, target_fpr: float) -> float:
    """Score cut-off so that ~target_fpr of normal runs fall below it (lower = more anomalous)."""
    return float(np.quantile(normal_scores, target_fpr))


def evaluate(pipe: Pipeline, normal: pd.DataFrame, stealer: pd.DataFrame,
             threshold: float) -> Dict[str, float]:
    n_scores = pipe.decision_function(normal)
    out = {
        "normal_fpr": float((n_scores < threshold).mean()),
        "n_normal": int(len(normal)),
        "n_stealer": int(len(stealer)),
    }
    if len(stealer):
        s_scores = pipe.decision_function(stealer)
        out["stealer_detection"] = float((s_scores < threshold).mean())
        y = np.r_[np.zeros(len(n_scores)), np.ones(len(s_scores))]
        # higher anomaly = lower decision_function, so negate for AUC
        out["roc_auc"] = float(roc_auc_score(y, np.r_[-n_scores, -s_scores]))
    return out


def leave_one_host_out(df: pd.DataFrame, contamination: float, target_fpr: float,
                       seed: int) -> List[Dict[str, float]]:
    results = []
    stealer = df[df.label == "Stealer"]
    for host in sorted(df[df.label == "Normal"].source_host.unique()):
        train = df[(df.label == "Normal") & (df.source_host != host)]
        held = df[(df.label == "Normal") & (df.source_host == host)]
        if len(train) < 50 or held.empty:
            continue
        pipe = make_pipeline(contamination, seed).fit(train)
        thr = threshold_at_fpr(pipe.decision_function(train), target_fpr)
        row = {"held_out_host": host, "held_out_runs": int(len(held)),
               "fpr_on_unseen_host": float((pipe.decision_function(held) < thr).mean())}
        if len(stealer):
            row["stealer_detection"] = float((pipe.decision_function(stealer) < thr).mean())
        results.append(row)
    return results


def train(dataset: str, model_out: str, target_fpr: float, contamination: float,
          seed: int, val_frac: float = 0.2) -> Dict:
    df = add_engineered(pd.read_csv(dataset))
    normal = df[df.label == "Normal"].reset_index(drop=True)
    stealer = df[df.label == "Stealer"].reset_index(drop=True)
    if normal.empty:
        raise SystemExit("No Normal runs in the dataset - run build_dataset first.")

    val = normal.sample(frac=val_frac, random_state=seed)
    train_df = normal.drop(val.index)

    pipe = make_pipeline(contamination, seed).fit(train_df)
    threshold = threshold_at_fpr(pipe.decision_function(train_df), target_fpr)

    metrics = {
        "validation": evaluate(pipe, val, stealer, threshold),
        "train_only_normal": int(len(train_df)),
        "leave_one_host_out": leave_one_host_out(df, contamination, target_fpr, seed),
        "hosts": sorted(normal.source_host.unique().tolist()),
    }

    # Final model: fit on ALL normal data, recompute threshold
    final = make_pipeline(contamination, seed).fit(normal)
    final_threshold = threshold_at_fpr(final.decision_function(normal), target_fpr)

    os.makedirs(os.path.dirname(os.path.abspath(model_out)), exist_ok=True)
    joblib.dump({
        "pipeline": final,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "threshold": final_threshold,
        "target_fpr": target_fpr,
        "trained_on_hosts": metrics["hosts"],
        "n_normal": int(len(normal)),
        "note": "flag a run as anomalous when pipeline.decision_function(X) < threshold",
    }, model_out)

    metrics["final_threshold"] = final_threshold
    metrics["model_path"] = model_out
    return metrics


def _print_report(m: Dict) -> None:
    v = m["validation"]
    print("\n=== HIDS Isolation Forest ===")
    print(f"trained on normal runs : {m['train_only_normal']} (hosts: {', '.join(m['hosts'])})")
    print(f"held-out validation    : {v['n_normal']} normal, {v['n_stealer']} stealer")
    if "stealer_detection" in v:
        print(f"  stealer detection    : {v['stealer_detection']:.1%}")
        print(f"  normal false positive: {v['normal_fpr']:.1%}")
        print(f"  ROC-AUC              : {v['roc_auc']:.3f}")
    print("\nleave-one-host-out (train on the other PCs, test on an unseen PC):")
    for r in m["leave_one_host_out"]:
        det = f", stealer detection {r['stealer_detection']:.1%}" if "stealer_detection" in r else ""
        print(f"  {r['held_out_host']:>10}: FP {r['fpr_on_unseen_host']:.1%} on {r['held_out_runs']} runs{det}")
    print(f"\nsaved model: {m['model_path']}  (threshold {m['final_threshold']:.4f})")


def main() -> None:
    ap = argparse.ArgumentParser(description="Train the HIDS Isolation Forest (Member 2)")
    ap.add_argument("--dataset", default=DEFAULT_DATASET)
    ap.add_argument("--out", default=DEFAULT_MODEL)
    ap.add_argument("--target-fpr", type=float, default=0.02, help="Target false-positive rate for the threshold")
    ap.add_argument("--contamination", type=float, default=0.02)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--with-file-features", action="store_true",
                    help="Include file-access features (use after the file sensor has run as Administrator)")
    args = ap.parse_args()
    if args.with_file_features:
        for f in FILE_FEATURES:
            if f not in NUMERIC_FEATURES:
                NUMERIC_FEATURES.append(f)  # default args reference this list in place
    _print_report(train(args.dataset, args.out, args.target_fpr, args.contamination, args.seed))


if __name__ == "__main__":
    main()
