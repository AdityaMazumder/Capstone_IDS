"""
Teach / run: lab CICFlowMeter CSV -> SOAR pipeline (scorecard).

What this does (simple):
  1. Open one of your lab CSV files
  2. Read rows (sample big files so it stays fast)
  3. Rename Java CICFlowMeter long names -> short CIC names
  4. Build flow_dict with 77 features via csv_row_to_raw_features
  5. Call orchestrator.process_flow(...)  [SOAR, firewall dry-run]
  6. Save predictions to data/lab/soar_scorecard.csv
  7. Compile a SOC summary PDF from SQLite incidents

From Capstone root (examples):

  python soar/lab_csv_to_soar.py --csv "data/lab/ssh_attacks.csv" --expected SSH-Bruteforce

  python soar/lab_csv_to_soar.py --csv "data/lab/network_behavior/csv files/ftp_attack.pcap_Flow.csv" --expected FTP-BruteForce --limit 50

  python soar/lab_csv_to_soar.py --all-lab --limit 40

  # noisy console alerts (default is quiet batch mode):
  python soar/lab_csv_to_soar.py --csv "data/lab/ssh_attacks.csv" --expected SSH-Bruteforce --verbose-alerts

  # skip PDF:
  python soar/lab_csv_to_soar.py --all-lab --limit 10 --no-pdf
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_SOAR = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_SOAR)
sys.path.insert(0, _SOAR)
sys.path.insert(0, _ROOT)

import pandas as pd

from core.orchestrator import SentinelOrchestrator
from nids.feature_extractor import csv_row_to_raw_features

# Java CICFlowMeter long names -> training short names
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

LAB_DIR = Path(_ROOT) / "data" / "lab" / "network_behavior" / "csv files"

# File name -> expected class for --all-lab
LAB_EXPECTED = {
    "ssh_attack.pcap_Flow.csv": "SSH-Bruteforce",
    "ftp_attack.pcap_Flow.csv": "FTP-BruteForce",
    "dos.pcap_Flow.csv": "DoS",
    "ddos.pcap_Flow.csv": "DDoS",
    "portscan.pcap_Flow.csv": "PortScan",
    "benign.pcap_Flow.csv": "Benign",
}

KALI = "192.168.56.101"
UBUNTU = "192.168.56.102"
# Lab "benign" capture is SSH-heavy; these ports are not fair Benign ground truth
AUTH_PORTS = {21, 22}


def prepare_df(path: Path, expected: str) -> pd.DataFrame:
    df = pd.read_csv(path).rename(columns=COLUMN_MAP)
    # Prefer attack-direction lab rows when IPs exist
    if "Src IP" in df.columns and "Dst IP" in df.columns:
        atk = df[(df["Src IP"] == KALI) & (df["Dst IP"] == UBUNTU)]
        if len(atk) > 0:
            df = atk

    # Soften Benign eval: drop auth-port sessions that were misfiled as benign
    if expected == "Benign" and "Dst Port" in df.columns:
        before = len(df)
        df = df.loc[~df["Dst Port"].astype(int).isin(AUTH_PORTS)].copy()
        dropped = before - len(df)
        if dropped:
            print(
                f"  (Benign soften) dropped {dropped} auth-port flows "
                f"(dst in {sorted(AUTH_PORTS)}); not scored as Benign"
            )

    return df.reset_index(drop=True)


def row_to_flow(row: pd.Series) -> dict:
    """Step 3+4: one CSV row -> flow_dict SOAR understands."""
    raw = csv_row_to_raw_features(row)
    src_ip = str(row.get("Src IP", KALI))
    dst_ip = str(row.get("Dst IP", UBUNTU))
    src_port = int(row.get("Src Port", 0) or 0)
    dst_port = int(row.get("Dst Port", 0) or 0)
    protocol = int(row.get("Protocol", 6) or 6)
    return {
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "src_port": src_port,
        "dst_port": dst_port,
        "protocol": protocol,
        "raw_features": raw,
    }


def run_csv(
    orch: SentinelOrchestrator,
    csv_path: Path,
    expected: str,
    limit: int,
) -> pd.DataFrame:
    print(f"\n=== {csv_path.name} | expected={expected} ===")
    df = prepare_df(csv_path, expected)
    if df.empty:
        print("  (no rows after filter)")
        return pd.DataFrame()

    if len(df) > limit:
        df = df.sample(n=limit, random_state=42).reset_index(drop=True)
        print(f"  sampled {limit} rows")
    else:
        print(f"  using all {len(df)} rows")

    records = []
    last_incident = None
    for i, row in df.iterrows():
        flow = row_to_flow(row)
        incident = orch.process_flow(flow)
        last_incident = incident
        pred = incident.detection.attack_type
        conf = float(incident.detection.confidence)
        risk = float(incident.risk.score)
        action = incident.action_plan.action_type.value if incident.action_plan else ""
        match = str(pred) == str(expected)
        records.append(
            {
                "file": csv_path.name,
                "row": int(i),
                "src_ip": flow["src_ip"],
                "dst_ip": flow["dst_ip"],
                "dst_port": flow["dst_port"],
                "expected": expected,
                "predicted": pred,
                "confidence": round(conf, 6),
                "risk": risk,
                "action": action,
                "match": match,
            }
        )
        flag = "OK" if match else "MISS"
        print(
            f"  [{flag}] port={flow['dst_port']:<5} pred={pred:<16} "
            f"conf={conf*100:5.1f}% risk={risk:.1f} action={action}"
        )

    out = pd.DataFrame(records)
    hits = int(out["match"].sum()) if len(out) else 0
    print(f"  SCORE: {hits}/{len(out)} matched expected={expected}")
    # stash last incident for optional per-incident PDF
    out.attrs["last_incident"] = last_incident
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Lab CSV -> SOAR scorecard")
    parser.add_argument("--csv", type=Path, help="Path to one CICFlowMeter CSV")
    parser.add_argument("--expected", type=str, help="Expected class label")
    parser.add_argument("--limit", type=int, default=50, help="Max rows per file")
    parser.add_argument(
        "--all-lab",
        action="store_true",
        help="Run all CSVs under data/lab/network_behavior/csv files",
    )
    parser.add_argument(
        "--verbose-alerts",
        action="store_true",
        help="Print rich console alerts (default: quiet batch mode)",
    )
    parser.add_argument(
        "--no-pdf",
        action="store_true",
        help="Skip SOC summary / incident PDF generation",
    )
    args = parser.parse_args()

    if not args.all_lab and (not args.csv or not args.expected):
        parser.error("Provide --csv and --expected, or use --all-lab")

    # Batch demos: dry-run firewall, no desktop toasts, quiet console unless asked
    orch = SentinelOrchestrator(
        dry_run_firewall=True,
        enable_desktop_alerts=False,
        enable_console_alerts=bool(args.verbose_alerts),
    )
    orch.initialize()
    if not orch.detection_agent.is_ml_loaded:
        print("FAIL: model did not load")
        orch.shutdown()
        sys.exit(1)
    print(f"ML loaded: {orch.detection_agent.adapter.model_path}")
    print(
        f"Alerts: desktop=OFF console={'ON' if args.verbose_alerts else 'OFF (batch)'}"
    )

    frames = []
    last_incident = None
    if args.all_lab:
        for name, expected in LAB_EXPECTED.items():
            path = LAB_DIR / name
            if not path.exists():
                print(f"SKIP missing {path}")
                continue
            part = run_csv(orch, path, expected, args.limit)
            frames.append(part)
            if part.attrs.get("last_incident") is not None:
                last_incident = part.attrs["last_incident"]
    else:
        part = run_csv(orch, args.csv, args.expected, args.limit)
        frames.append(part)
        last_incident = part.attrs.get("last_incident")

    scorecard = pd.concat([f for f in frames if f is not None and len(f)], ignore_index=True)
    if scorecard.empty:
        print("No results to save")
        orch.shutdown()
        return

    out_dir = Path(_ROOT) / "data" / "lab"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "soar_scorecard.csv"
    scorecard.to_csv(out_path, index=False)
    print(f"\nSaved scorecard: {out_path}")
    print("\nSummary by file:")
    print(
        scorecard.groupby(["file", "expected"])["match"]
        .agg(total="count", hits="sum")
        .assign(pct=lambda x: (100 * x["hits"] / x["total"]).round(1))
        .to_string()
    )

    if not args.no_pdf:
        print("\nCompiling SOC PDF report(s) from SQLite incidents...")
        try:
            summary_pdf = orch.report_agent.generate_soc_summary_pdf()
            print(f"  Summary PDF: {summary_pdf}")
        except Exception as exc:
            print(f"  Summary PDF failed: {exc}")
        if last_incident is not None:
            try:
                inc_pdf = orch.report_agent.generate_incident_pdf(last_incident)
                print(f"  Incident PDF: {inc_pdf}")
            except Exception as exc:
                print(f"  Incident PDF failed: {exc}")

    orch.shutdown()


if __name__ == "__main__":
    main()
