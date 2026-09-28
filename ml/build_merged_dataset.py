"""
Build a professional CIC + lab merged training set for NIDS v3.

Strategy (domain adaptation, not lab-only overwrite):
  1. Stratified sample from cic_multiclass_clean.csv (keeps all 6 CIC classes,
     including Botnet, at manageable size with class balance).
  2. Overlay cleaned Kali→Ubuntu lab flows with hard caps so floods cannot
     drown SSH/FTP or CIC diversity.
  3. Replicate scarce lab SSH/FTP rows so the lab feature regime (e.g. init
     win 64240) is actually learned without fabricating new attacks.
  4. Lab Benign: only non-SSH, non-noise rows (tiny); rely on CIC Benign.

Output: data/processed/cic_lab_merged_clean.csv

Held-out forever (never read here): data/lab/ssh_attacks.csv
"""
from __future__ import annotations

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from paths import CLEAN_CSV, DATA_PROCESSED, MODELS_DIR, ROOT

LAB_CSV_DIR = ROOT / "data" / "lab" / "network_behavior" / "csv files"
OUT_CSV = DATA_PROCESSED / "cic_lab_merged_clean.csv"
FEATURE_CONTRACT = MODELS_DIR / "feature_columns_v2.pkl"

KALI = "192.168.56.101"
UBUNTU = "192.168.56.102"
SEED = 42

# CIC subsample caps — preserve coverage, avoid 2.4M-row wall-clock pain
CIC_CAPS = {
    "Benign": 100_000,
    "Botnet": 50_000,
    "DDoS": 50_000,
    "DoS": 50_000,
    "FTP-BruteForce": 50_000,
    "SSH-Bruteforce": 50_000,
}

# Lab overlay caps (after Kali→Ubuntu filter)
LAB_CAPS = {
    "DoS": 4_000,
    "DDoS": 4_000,
    "PortScan": 2_000,
}

# Repeat scarce lab auth attacks so trees see the modern-stack regime
LAB_REPLICATE = {
    "SSH-Bruteforce": 20,
    "FTP-BruteForce": 12,
}

LAB_SOURCES = {
    "benign.pcap_Flow.csv": "Benign",
    "ddos.pcap_Flow.csv": "DDoS",
    "dos.pcap_Flow.csv": "DoS",
    "ftp_attack.pcap_Flow.csv": "FTP-BruteForce",
    "portscan.pcap_Flow.csv": "PortScan",
    "ssh_attack.pcap_Flow.csv": "SSH-Bruteforce",
}

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


def _is_noise(df: pd.DataFrame) -> pd.Series:
    src = df["Src IP"].astype(str)
    dst = df["Dst IP"].astype(str)
    return (
        src.isin(["8.6.0.1", "192.168.56.1"])
        | dst.isin(["8.0.6.4", "8.6.0.1"])
        | dst.str.startswith("224.")
        | dst.str.startswith("239.")
        | dst.str.endswith(".255")
    )


def _finalize(df: pd.DataFrame, feature_cols: list[str], label: str) -> pd.DataFrame:
    out = df.replace([np.inf, -np.inf], np.nan).copy()
    out["Label"] = label
    for c in feature_cols:
        out[c] = pd.to_numeric(out[c], errors="coerce")
    out = out.dropna(subset=feature_cols)
    return out[feature_cols + ["Label"]]


def sample_cic(feature_cols: list[str]) -> pd.DataFrame:
    if not CLEAN_CSV.exists():
        raise SystemExit(f"Missing CIC clean CSV: {CLEAN_CSV}")

    print(f"\n=== CIC base from {CLEAN_CSV.name} ===")
    # Stream and reservoir-sample per class to avoid loading 2.4M if possible
    # Simpler reliable path: read once (already used for v2 training on this machine)
    df = pd.read_csv(CLEAN_CSV)
    print(f"  raw CIC shape: {df.shape}")
    print(df["Label"].value_counts().to_string())

    parts = []
    rng = np.random.RandomState(SEED)
    for label, cap in CIC_CAPS.items():
        sub = df.loc[df["Label"] == label]
        if sub.empty:
            print(f"  WARN: no CIC rows for {label}")
            continue
        if len(sub) > cap:
            sub = sub.sample(n=cap, random_state=rng.randint(0, 10_000))
        missing = [c for c in feature_cols if c not in sub.columns]
        if missing:
            raise ValueError(f"CIC missing features: {missing[:8]}")
        part = _finalize(sub, feature_cols, label)
        print(f"  CIC {label}: {len(part)}")
        parts.append(part)

    return pd.concat(parts, ignore_index=True)


def load_lab_overlay(feature_cols: list[str]) -> pd.DataFrame:
    print("\n=== Lab overlay ===")
    frames = []
    for fname, label in LAB_SOURCES.items():
        path = LAB_CSV_DIR / fname
        if not path.exists():
            print(f"  SKIP missing {fname}")
            continue
        raw = pd.read_csv(path, low_memory=False).rename(columns=COLUMN_MAP)
        before = len(raw)
        raw = raw.loc[~_is_noise(raw)].copy()

        if label == "Benign":
            raw = raw.loc[raw["Dst Port"] != 22].copy()
            print(f"  {fname}: noise/SSH stripped {before} -> {len(raw)} (Benign lab)")
        else:
            raw = raw.loc[(raw["Src IP"] == KALI) & (raw["Dst IP"] == UBUNTU)].copy()
            if label == "SSH-Bruteforce":
                raw = raw.loc[raw["Dst Port"] == 22]
            elif label == "FTP-BruteForce":
                raw = raw.loc[raw["Dst Port"] == 21]
            elif label in ("DoS", "DDoS"):
                raw = raw.loc[raw["Dst Port"] == 80]
            print(f"  {fname}: {before} -> {len(raw)} ({label})")

        if raw.empty:
            continue

        part = _finalize(raw, feature_cols, label)
        if label in LAB_CAPS and len(part) > LAB_CAPS[label]:
            part = part.sample(n=LAB_CAPS[label], random_state=SEED)
            print(f"    capped {label} -> {len(part)}")

        reps = LAB_REPLICATE.get(label, 1)
        if reps > 1 and len(part) > 0:
            part = pd.concat([part] * reps, ignore_index=True)
            print(f"    replicated x{reps} -> {len(part)}")

        frames.append(part)

    if not frames:
        raise SystemExit("No lab overlays loaded")
    return pd.concat(frames, ignore_index=True)


def main() -> None:
    feature_cols = list(joblib.load(FEATURE_CONTRACT))
    assert len(feature_cols) == 77

    cic = sample_cic(feature_cols)
    lab = load_lab_overlay(feature_cols)

    merged = pd.concat([cic, lab], ignore_index=True)
    merged = merged.sample(frac=1.0, random_state=SEED).reset_index(drop=True)

    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    merged.to_csv(OUT_CSV, index=False)

    print("\n" + "=" * 64)
    print(f"Wrote {OUT_CSV}")
    print(f"Shape: {merged.shape}")
    print("\nFinal label counts:")
    print(merged["Label"].value_counts().to_string())
    print("\nHeld out (not in this file): data/lab/ssh_attacks.csv")


if __name__ == "__main__":
    main()
