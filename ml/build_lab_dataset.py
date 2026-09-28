"""
Build a labelled lab multiclass CSV from CICFlowMeter exports under
data/lab/network_behavior/csv files/.

Output: data/processed/lab_multiclass_clean.csv
Classes: Benign, DDoS, DoS, FTP-BruteForce, PortScan, SSH-Bruteforce

Benign from the lab capture is SSH-heavy / noisy, so we:
  - drop multicast / VirtualBox noise
  - drop dst port 22 from the Benign file
  - supplement with CIC Benign rows if still too few
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
OUT_CSV = DATA_PROCESSED / "lab_multiclass_clean.csv"
# Feature contract is frozen from v2; v3 model reuses the same 77 names.
FEATURE_CONTRACT = MODELS_DIR / "feature_columns_v2.pkl"

KALI = "192.168.56.101"
UBUNTU = "192.168.56.102"

# Cap mega-classes so SSH/FTP are not drowned out
CAPS = {
    "DoS": 8_000,
    "DDoS": 8_000,
    "PortScan": 2_000,
    "Benign": 5_000,
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

SOURCES = {
    "benign.pcap_Flow.csv": "Benign",
    "ddos.pcap_Flow.csv": "DDoS",
    "dos.pcap_Flow.csv": "DoS",
    "ftp_attack.pcap_Flow.csv": "FTP-BruteForce",
    "portscan.pcap_Flow.csv": "PortScan",
    "ssh_attack.pcap_Flow.csv": "SSH-Bruteforce",
}

DROP_META = [
    "Flow ID",
    "Src IP",
    "Src Port",
    "Dst IP",
    "Dst Port",
    "Timestamp",
    "Label",
]


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


def load_lab_file(path: Path, label: str, feature_cols: list[str]) -> pd.DataFrame:
    print(f"\nLoading {path.name} -> {label}")
    df = pd.read_csv(path, low_memory=False).rename(columns=COLUMN_MAP)
    before = len(df)
    df = df.loc[~_is_noise(df)].copy()
    print(f"  dropped noise: {before - len(df)}")

    if label == "Benign":
        # Lab "benign" is dominated by SSH sessions — exclude those from Benign class
        before = len(df)
        df = df.loc[df["Dst Port"] != 22].copy()
        print(f"  dropped Benign dst:22: {before - len(df)}")
    else:
        before = len(df)
        df = df.loc[(df["Src IP"] == KALI) & (df["Dst IP"] == UBUNTU)].copy()
        print(f"  kept Kali→Ubuntu only: {len(df)} (dropped {before - len(df)})")
        if label == "SSH-Bruteforce":
            df = df.loc[df["Dst Port"] == 22]
        elif label == "FTP-BruteForce":
            df = df.loc[df["Dst Port"] == 21]
        elif label in ("DoS", "DDoS"):
            df = df.loc[df["Dst Port"] == 80]

    df["Label"] = label
    df = df.replace([np.inf, -np.inf], np.nan).dropna(subset=feature_cols)

    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name} missing features: {missing[:10]}")

    out = df[feature_cols + ["Label"]].copy()
    for c in feature_cols:
        out[c] = pd.to_numeric(out[c], errors="coerce")
    out = out.dropna()
    print(f"  kept: {len(out)}")
    return out


def maybe_cap(df: pd.DataFrame, label: str, seed: int = 42) -> pd.DataFrame:
    cap = CAPS.get(label)
    if cap is None or len(df) <= cap:
        return df
    print(f"  cap {label}: {len(df)} → {cap}")
    return df.sample(n=cap, random_state=seed)


def supplement_benign(lab_benign: pd.DataFrame, feature_cols: list[str], target: int = 5_000, seed: int = 42) -> pd.DataFrame:
    if len(lab_benign) >= target:
        return lab_benign.sample(n=target, random_state=seed) if len(lab_benign) > target else lab_benign

    need = target - len(lab_benign)
    if not CLEAN_CSV.exists():
        print(f"  WARN: {CLEAN_CSV} missing; Benign stays at {len(lab_benign)}")
        return lab_benign

    print(f"  supplementing Benign with {need} CIC rows from {CLEAN_CSV.name}")
    chunks = []
    got = 0
    for chunk in pd.read_csv(CLEAN_CSV, chunksize=100_000):
        b = chunk.loc[chunk["Label"] == "Benign"]
        if b.empty:
            continue
        chunks.append(b)
        got += len(b)
        if got >= need * 3:
            break
    if not chunks:
        print("  WARN: no CIC Benign found")
        return lab_benign

    cic = pd.concat(chunks, ignore_index=True)
    for c in feature_cols:
        if c not in cic.columns:
            raise ValueError(f"CIC missing {c}")
        cic[c] = pd.to_numeric(cic[c], errors="coerce")
    cic = cic[feature_cols + ["Label"]].dropna()
    cic = cic.sample(n=min(need, len(cic)), random_state=seed)
    return pd.concat([lab_benign, cic], ignore_index=True)


def main() -> None:
    feature_cols = list(joblib.load(FEATURE_CONTRACT))
    assert len(feature_cols) == 77

    frames: list[pd.DataFrame] = []
    for fname, label in SOURCES.items():
        path = LAB_CSV_DIR / fname
        if not path.exists():
            print(f"SKIP missing: {path}")
            continue
        part = load_lab_file(path, label, feature_cols)
        if label != "Benign":
            part = maybe_cap(part, label)
        frames.append(part)

    if not frames:
        raise SystemExit("No lab CSVs found")

    # Benign handling after other classes collected
    by_label = {f["Label"].iloc[0]: f for f in frames}
    if "Benign" in by_label:
        by_label["Benign"] = supplement_benign(by_label["Benign"], feature_cols, target=CAPS["Benign"])
        by_label["Benign"] = maybe_cap(by_label["Benign"], "Benign")

    merged = pd.concat(list(by_label.values()), ignore_index=True)
    merged = merged.sample(frac=1.0, random_state=42).reset_index(drop=True)

    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    merged.to_csv(OUT_CSV, index=False)
    print("\n" + "=" * 60)
    print(f"Wrote {OUT_CSV}")
    print(f"Shape: {merged.shape}")
    print(merged["Label"].value_counts().to_string())


if __name__ == "__main__":
    main()
