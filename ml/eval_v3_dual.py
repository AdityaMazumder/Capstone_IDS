"""
Dual-domain evaluation for NIDS v3 (CIC + lab merge).

1) Held-out lab: data/lab/ssh_attacks.csv  (never in training)
2) CIC attack/benign samples from cic_multiclass_clean.csv
3) Lab training-family CSV spot-check (ssh_attack.pcap_Flow.csv) — in-domain sanity

From Capstone root:
  python ml/eval_v3_dual.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np
import pandas as pd

from config.paths import CLEAN_CSV, MODEL_ENCODER, MODEL_FEATURES, MODEL_XGB, ROOT

COLUMN_MAP = {
    "Total Fwd Packet": "Tot Fwd Pkts",
    "Total Bwd packets": "Tot Bwd Pkts",
    "Total Length of Fwd Packet": "TotLen Fwd Pkts",
    "Total Length of Bwd Packet": "TotLen Bwd Pkts",
    "Fwd Packet Length Max": "Fwd Pkt Len Max",
    "Fwd Packet Length Min": "Fwd Pkt Len Min",
    "Fwd Packet Length Mean": "Fwd Pkt Len Mean",
    "Fwd Packet Length Std": "Fwd Pkt Len Std",
    "Bwd Packet Length Max": "Bwd Pkt Len Max",
    "Bwd Packet Length Min": "Bwd Pkt Len Min",
    "Bwd Packet Length Mean": "Bwd Pkt Len Mean",
    "Bwd Packet Length Std": "Bwd Pkt Len Std",
    "Flow Bytes/s": "Flow Byts/s",
    "Flow Packets/s": "Flow Pkts/s",
    "Fwd IAT Total": "Fwd IAT Tot",
    "Bwd IAT Total": "Bwd IAT Tot",
    "Fwd Header Length": "Fwd Header Len",
    "Bwd Header Length": "Bwd Header Len",
    "Fwd Packets/s": "Fwd Pkts/s",
    "Bwd Packets/s": "Bwd Pkts/s",
    "Packet Length Min": "Pkt Len Min",
    "Packet Length Max": "Pkt Len Max",
    "Packet Length Mean": "Pkt Len Mean",
    "Packet Length Std": "Pkt Len Std",
    "Packet Length Variance": "Pkt Len Var",
    "FIN Flag Count": "FIN Flag Cnt",
    "SYN Flag Count": "SYN Flag Cnt",
    "RST Flag Count": "RST Flag Cnt",
    "PSH Flag Count": "PSH Flag Cnt",
    "ACK Flag Count": "ACK Flag Cnt",
    "URG Flag Count": "URG Flag Cnt",
    "CWR Flag Count": "CWE Flag Count",
    "ECE Flag Count": "ECE Flag Cnt",
    "Average Packet Size": "Pkt Size Avg",
    "Fwd Segment Size Avg": "Fwd Seg Size Avg",
    "Bwd Segment Size Avg": "Bwd Seg Size Avg",
    "Fwd Bytes/Bulk Avg": "Fwd Byts/b Avg",
    "Fwd Packet/Bulk Avg": "Fwd Pkts/b Avg",
    "Fwd Bulk Rate Avg": "Fwd Blk Rate Avg",
    "Bwd Bytes/Bulk Avg": "Bwd Byts/b Avg",
    "Bwd Packet/Bulk Avg": "Bwd Pkts/b Avg",
    "Bwd Bulk Rate Avg": "Bwd Blk Rate Avg",
    "Subflow Fwd Packets": "Subflow Fwd Pkts",
    "Subflow Fwd Bytes": "Subflow Fwd Byts",
    "Subflow Bwd Packets": "Subflow Bwd Pkts",
    "Subflow Bwd Bytes": "Subflow Bwd Byts",
    "FWD Init Win Bytes": "Init Fwd Win Byts",
    "Bwd Init Win Bytes": "Init Bwd Win Byts",
}


def predict_frame(model, le, feats, df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    X = df.reindex(columns=feats).replace([np.inf, -np.inf], np.nan).fillna(0)
    pred = le.inverse_transform(model.predict(X).astype(int))
    conf = model.predict_proba(X).max(axis=1)
    return pred, conf


def eval_ssh_heldout(model, le, feats) -> None:
    path = ROOT / "data" / "lab" / "ssh_attacks.csv"
    print("\n" + "=" * 64)
    print(f"[HELD-OUT LAB] {path}")
    df = pd.read_csv(path).rename(columns=COLUMN_MAP)
    pred, conf = predict_frame(model, le, feats, df)
    print(pd.DataFrame({"Prediction": pred, "Confidence": conf}))
    hits = (pred == "SSH-Bruteforce").sum()
    print(f"SSH-Bruteforce hits: {hits}/{len(pred)}")


def eval_cic_samples(model, le, feats, n_per: int = 200) -> None:
    print("\n" + "=" * 64)
    print(f"[CIC SAMPLE] {CLEAN_CSV.name} (n={n_per}/class)")
    wanted = ["Benign", "Botnet", "DDoS", "DoS", "FTP-BruteForce", "SSH-Bruteforce"]
    rows = []
    # stream by label via full read of labels is heavy; sample from full file with usecols then iloc
    df = pd.read_csv(CLEAN_CSV)
    for label in wanted:
        sub = df.loc[df["Label"] == label]
        if sub.empty:
            continue
        take = sub.sample(n=min(n_per, len(sub)), random_state=42)
        rows.append(take)
    sample = pd.concat(rows, ignore_index=True)
    pred, conf = predict_frame(model, le, feats, sample)
    sample = sample.copy()
    sample["Prediction"] = pred
    sample["Confidence"] = conf
    sample["Match"] = sample["Label"].astype(str) == sample["Prediction"].astype(str)

    print("\nPer-class accuracy:")
    for label in wanted:
        part = sample.loc[sample["Label"] == label]
        if part.empty:
            continue
        acc = part["Match"].mean()
        print(f"  {label:<16} {acc*100:5.1f}%  ({part['Match'].sum()}/{len(part)})")
    print(f"\nOverall: {sample['Match'].mean()*100:.1f}%")
    print("\nConfusion (true -> pred counts):")
    print(pd.crosstab(sample["Label"], sample["Prediction"]))


def eval_lab_ssh_family(model, le, feats) -> None:
    path = (
        ROOT
        / "data"
        / "lab"
        / "network_behavior"
        / "csv files"
        / "ssh_attack.pcap_Flow.csv"
    )
    print("\n" + "=" * 64)
    print(f"[LAB FAMILY SANITY] {path.name} (in training family; not held-out)")
    df = pd.read_csv(path).rename(columns=COLUMN_MAP)
    df = df.loc[
        (df["Src IP"] == "192.168.56.101")
        & (df["Dst IP"] == "192.168.56.102")
        & (df["Dst Port"] == 22)
    ]
    pred, conf = predict_frame(model, le, feats, df)
    hits = (pred == "SSH-Bruteforce").sum()
    print(f"SSH-Bruteforce hits: {hits}/{len(pred)}  mean_conf={conf.mean():.3f}")


def main() -> None:
    print(f"Model: {MODEL_XGB}")
    model = joblib.load(MODEL_XGB)
    le = joblib.load(MODEL_ENCODER)
    feats = list(joblib.load(MODEL_FEATURES))
    print("Classes:", list(le.classes_))

    eval_ssh_heldout(model, le, feats)
    eval_lab_ssh_family(model, le, feats)
    eval_cic_samples(model, le, feats, n_per=200)


if __name__ == "__main__":
    main()
