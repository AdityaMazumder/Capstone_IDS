"""
Evaluate active NIDS model on the first lab capture: data/lab/ssh_attacks.csv
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np
import pandas as pd

from config.paths import MODEL_ENCODER, MODEL_FEATURES, MODEL_XGB, ROOT

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


def main() -> None:
    csv_path = ROOT / "data" / "lab" / "ssh_attacks.csv"
    print(f"Model: {MODEL_XGB}")
    print(f"Test:  {csv_path}")

    model = joblib.load(MODEL_XGB)
    le = joblib.load(MODEL_ENCODER)
    feats = list(joblib.load(MODEL_FEATURES))

    df = pd.read_csv(csv_path).rename(columns=COLUMN_MAP)
    X = df.reindex(columns=feats).replace([np.inf, -np.inf], np.nan).fillna(0)

    pred = le.inverse_transform(model.predict(X).astype(int))
    proba = model.predict_proba(X)
    conf = proba.max(axis=1)

    df["Prediction"] = pred
    df["Confidence"] = conf

    print("\nPer-flow:")
    cols = [c for c in ["Src IP", "Dst IP", "Dst Port", "Init Fwd Win Byts", "PSH Flag Cnt", "Prediction", "Confidence"] if c in df.columns]
    print(df[cols].to_string(index=False))

    print("\nPrediction counts:")
    print(pd.Series(pred).value_counts().to_string())
    ssh_hits = (pd.Series(pred) == "SSH-Bruteforce").sum()
    print(f"\nSSH-Bruteforce hits: {ssh_hits}/{len(pred)}")


if __name__ == "__main__":
    main()
