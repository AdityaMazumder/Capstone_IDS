"""
PCAP → CIC-style flow CSV (CIC-compatible via cicflowmeter engine).

Universal approach: do NOT invent feature formulas. Feed packets into the
community CICFlowMeter Python Flow/FlowSession (same feature definitions),
using Scapy rdpcap so Windows needs no tcpdump.

Time units: cicflowmeter returns seconds; CSE-CIC training uses microseconds
for duration/IAT → we scale * 1e6 on those fields only.

**Live OOD policy (SOAR):** When ML says Benign but auth-port / window / SYN / velocity
signals fire, DetectionAgent may override the *effective* label for response while
keeping `ml_attack_type` on the result (`policies.yaml` → `ood_policy`).

Usage (from Capstone root):
  python -m nids.pcap_to_flows data/lab/ssh_attack.pcap
  python -m nids.pcap_to_flows data/lab/ssh_attack.pcap --predict --expected SSH-Bruteforce
  python -m nids.pcap_to_flows data/lab/ssh_attack.pcap --predict --ml-only --expected SSH-Bruteforce
"""
from __future__ import annotations

import argparse
import csv
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from config.paths import MODEL_FEATURES

META_COLS = ["Src IP", "Dst IP", "Src Port", "Dst Port", "Timestamp"]

# cicflowmeter snake_case → CSE-CIC-IDS2018 column names used in training
CIC_NAME_MAP: Dict[str, str] = {
    "src_ip": "Src IP",
    "dst_ip": "Dst IP",
    "src_port": "Src Port",
    "dst_port": "Dst Port",
    "timestamp": "Timestamp",
    "protocol": "Protocol",
    "flow_duration": "Flow Duration",
    "tot_fwd_pkts": "Tot Fwd Pkts",
    "tot_bwd_pkts": "Tot Bwd Pkts",
    "totlen_fwd_pkts": "TotLen Fwd Pkts",
    "totlen_bwd_pkts": "TotLen Bwd Pkts",
    "fwd_pkt_len_max": "Fwd Pkt Len Max",
    "fwd_pkt_len_min": "Fwd Pkt Len Min",
    "fwd_pkt_len_mean": "Fwd Pkt Len Mean",
    "fwd_pkt_len_std": "Fwd Pkt Len Std",
    "bwd_pkt_len_max": "Bwd Pkt Len Max",
    "bwd_pkt_len_min": "Bwd Pkt Len Min",
    "bwd_pkt_len_mean": "Bwd Pkt Len Mean",
    "bwd_pkt_len_std": "Bwd Pkt Len Std",
    "flow_byts_s": "Flow Byts/s",
    "flow_pkts_s": "Flow Pkts/s",
    "flow_iat_mean": "Flow IAT Mean",
    "flow_iat_std": "Flow IAT Std",
    "flow_iat_max": "Flow IAT Max",
    "flow_iat_min": "Flow IAT Min",
    "fwd_iat_tot": "Fwd IAT Tot",
    "fwd_iat_mean": "Fwd IAT Mean",
    "fwd_iat_std": "Fwd IAT Std",
    "fwd_iat_max": "Fwd IAT Max",
    "fwd_iat_min": "Fwd IAT Min",
    "bwd_iat_tot": "Bwd IAT Tot",
    "bwd_iat_mean": "Bwd IAT Mean",
    "bwd_iat_std": "Bwd IAT Std",
    "bwd_iat_max": "Bwd IAT Max",
    "bwd_iat_min": "Bwd IAT Min",
    "fwd_psh_flags": "Fwd PSH Flags",
    "bwd_psh_flags": "Bwd PSH Flags",
    "fwd_urg_flags": "Fwd URG Flags",
    "bwd_urg_flags": "Bwd URG Flags",
    "fwd_header_len": "Fwd Header Len",
    "bwd_header_len": "Bwd Header Len",
    "fwd_pkts_s": "Fwd Pkts/s",
    "bwd_pkts_s": "Bwd Pkts/s",
    "pkt_len_min": "Pkt Len Min",
    "pkt_len_max": "Pkt Len Max",
    "pkt_len_mean": "Pkt Len Mean",
    "pkt_len_std": "Pkt Len Std",
    "pkt_len_var": "Pkt Len Var",
    "fin_flag_cnt": "FIN Flag Cnt",
    "syn_flag_cnt": "SYN Flag Cnt",
    "rst_flag_cnt": "RST Flag Cnt",
    "psh_flag_cnt": "PSH Flag Cnt",
    "ack_flag_cnt": "ACK Flag Cnt",
    "urg_flag_cnt": "URG Flag Cnt",
    "cwr_flag_count": "CWE Flag Count",
    "ece_flag_cnt": "ECE Flag Cnt",
    "down_up_ratio": "Down/Up Ratio",
    "pkt_size_avg": "Pkt Size Avg",
    "fwd_seg_size_avg": "Fwd Seg Size Avg",
    "bwd_seg_size_avg": "Bwd Seg Size Avg",
    "fwd_byts_b_avg": "Fwd Byts/b Avg",
    "fwd_pkts_b_avg": "Fwd Pkts/b Avg",
    "fwd_blk_rate_avg": "Fwd Blk Rate Avg",
    "bwd_byts_b_avg": "Bwd Byts/b Avg",
    "bwd_pkts_b_avg": "Bwd Pkts/b Avg",
    "bwd_blk_rate_avg": "Bwd Blk Rate Avg",
    "subflow_fwd_pkts": "Subflow Fwd Pkts",
    "subflow_fwd_byts": "Subflow Fwd Byts",
    "subflow_bwd_pkts": "Subflow Bwd Pkts",
    "subflow_bwd_byts": "Subflow Bwd Byts",
    "init_fwd_win_byts": "Init Fwd Win Byts",
    "init_bwd_win_byts": "Init Bwd Win Byts",
    "fwd_act_data_pkts": "Fwd Act Data Pkts",
    "fwd_seg_size_min": "Fwd Seg Size Min",
    "active_mean": "Active Mean",
    "active_std": "Active Std",
    "active_max": "Active Max",
    "active_min": "Active Min",
    "idle_mean": "Idle Mean",
    "idle_std": "Idle Std",
    "idle_max": "Idle Max",
    "idle_min": "Idle Min",
}

# cicflowmeter returns these in seconds; CIC CSV uses microseconds
_TIME_FIELDS_US = {
    "Flow Duration",
    "Flow IAT Mean",
    "Flow IAT Std",
    "Flow IAT Max",
    "Flow IAT Min",
    "Fwd IAT Tot",
    "Fwd IAT Mean",
    "Fwd IAT Std",
    "Fwd IAT Max",
    "Fwd IAT Min",
    "Bwd IAT Tot",
    "Bwd IAT Mean",
    "Bwd IAT Std",
    "Bwd IAT Max",
    "Bwd IAT Min",
    "Active Mean",
    "Active Std",
    "Active Max",
    "Active Min",
    "Idle Mean",
    "Idle Std",
    "Idle Max",
    "Idle Min",
}


def _normalize_packet(pkt):
    """
    Peel to IP as outermost layer so cicflowmeter len(packet) ≈ IP packet length
    (CookedLinuxV2 / Ethernet headers otherwise inflate TotLen / Pkt Len features).
    """
    from scapy.layers.inet import IP, TCP, UDP

    if IP not in pkt:
        return None
    if TCP not in pkt and UDP not in pkt:
        return None
    ip_pkt = pkt[IP].copy()
    ip_pkt.time = float(pkt.time)
    try:
        ip_pkt.proto = int(ip_pkt.proto)
    except Exception:
        pass
    return ip_pkt


def pcap_to_cicflowmeter_dicts(pcap_path: Path) -> List[Dict[str, Any]]:
    """
    Offline CIC-compatible extraction: rdpcap → FlowSession.process (no BPF/tcpdump).
    """
    from scapy.all import rdpcap
    from cicflowmeter.flow_session import FlowSession

    packets = rdpcap(str(pcap_path))
    tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()

    session = FlowSession(
        output_mode="csv",
        output=str(tmp_path),
        fields=None,
        verbose=False,
    )

    accepted = 0
    for pkt in packets:
        norm = _normalize_packet(pkt)
        if norm is None:
            continue
        session.process(norm)
        accepted += 1

    # Flush remaining flows into the temp CSV (includes any early GC writes)
    session.flush_flows()

    rows_raw: List[Dict[str, Any]] = []
    if tmp_path.is_file() and tmp_path.stat().st_size > 0:
        import pandas as pd

        df = pd.read_csv(tmp_path)
        rows_raw = df.to_dict(orient="records")

    try:
        tmp_path.unlink(missing_ok=True)
    except OSError:
        pass

    print(f"Packets accepted (IP+TCP/UDP): {accepted}/{len(packets)}")
    print(f"Flows from cicflowmeter engine: {len(rows_raw)}")
    return rows_raw


def cicflowmeter_to_cic_row(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Map snake_case cicflowmeter dict → CIC training column names + time scale."""
    row: Dict[str, Any] = {}
    for src, dst in CIC_NAME_MAP.items():
        if src not in raw:
            continue
        val = raw[src]
        if dst in _TIME_FIELDS_US and val is not None:
            try:
                val = float(val) * 1_000_000.0
            except (TypeError, ValueError):
                val = 0.0
        row[dst] = val
    return row


def write_flows_csv(rows: List[Dict[str, Any]], out_path: Path) -> None:
    import joblib

    feature_names: List[str] = list(joblib.load(MODEL_FEATURES))
    fieldnames = META_COLS + feature_names
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            # Ensure every feature column exists
            out = {name: row.get(name, 0.0) for name in fieldnames}
            writer.writerow(out)


def predict_scorecard(
    rows: List[Dict[str, Any]],
    expected: Optional[str] = None,
    *,
    ml_only: bool = False,
) -> None:
    """
    Score flows via DetectionAgent (ML + OOD policy) unless ml_only=True.
    """
    from nids.feature_extractor import to_cic_raw_features

    if ml_only:
        from soar.adapters.cic_xgb_adapter import CicXgbAdapter

        adapter = CicXgbAdapter()
        adapter.load()
        print(f"\n=== ML-only scorecard ({len(rows)} flows) ===")
        if expected:
            print(f"Expected label: {expected}")
        matches = 0
        for i, row in enumerate(rows):
            raw = to_cic_raw_features(row)
            label, conf, probs = adapter.predict(raw, dst_port=row.get("Dst Port"))
            if expected is None:
                mark = "n/a"
            elif str(label) == str(expected):
                matches += 1
                mark = "OK"
            else:
                mark = "MISS"
            print(
                f"  [{i}] {row.get('Src IP')}:{row.get('Src Port')} -> "
                f"{row.get('Dst IP')}:{row.get('Dst Port')}  =>  {label}  "
                f"({conf * 100:.1f}%)  [{mark}]"
            )
            top = sorted(probs.items(), key=lambda x: -x[1])[:3]
            print("       top:", ", ".join(f"{k}={v:.3f}" for k, v in top))
        if expected and rows:
            print(f"\nMatch rate vs expected: {matches}/{len(rows)} ({100 * matches / len(rows):.0f}%)")
        return

    # Full SOAR detection path (frozen ML + OOD policy)
    soar_dir = str(_ROOT / "soar")
    if soar_dir not in sys.path:
        sys.path.insert(0, soar_dir)

    from agents.detection_agent import DetectionAgent
    from core.schemas import FlowEvent
    from rules.policy_engine import PolicyEngine

    agent = DetectionAgent(policy_engine=PolicyEngine())
    agent.initialize()

    print(f"\n=== SOAR scorecard - ML + OOD policy ({len(rows)} flows) ===")
    if expected:
        print(f"Expected (effective) label: {expected}")
    matches = 0
    policy_hits = 0
    for i, row in enumerate(rows):
        raw = to_cic_raw_features(row)
        flow = FlowEvent(
            src_ip=str(row.get("Src IP", "0.0.0.0")),
            dst_ip=str(row.get("Dst IP", "0.0.0.0")),
            src_port=int(row.get("Src Port") or 0),
            dst_port=int(row.get("Dst Port") or 0),
            protocol=int(row.get("Protocol") or 6),
            tot_fwd_pkts=int(row.get("Tot Fwd Pkts") or 0),
            syn_flag_count=int(row.get("SYN Flag Cnt") or 0),
            raw_features=raw,
        )
        det = agent.predict(flow)
        if det.policy_applied:
            policy_hits += 1
        if expected is None:
            mark = "n/a"
        elif str(det.attack_type) == str(expected):
            matches += 1
            mark = "OK"
        else:
            mark = "MISS"
        print(
            f"  [{i}] {flow.src_ip}:{flow.src_port} -> {flow.dst_ip}:{flow.dst_port}  =>  "
            f"{det.attack_type} ({det.confidence * 100:.1f}%)  [{mark}]"
        )
        print(
            f"       ml={det.ml_attack_type} ({det.ml_confidence * 100:.1f}%)  "
            f"policy={'YES' if det.policy_applied else 'no'}"
        )
        if det.policy_applied:
            print(f"       reason: {det.policy_reason}")
    if expected and rows:
        print(f"\nMatch rate vs expected: {matches}/{len(rows)} ({100 * matches / len(rows):.0f}%)")
    print(f"OOD policy overrides: {policy_hits}/{len(rows)}")
    agent.shutdown()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="PCAP → CIC-compatible flows via cicflowmeter engine (rdpcap, no tcpdump)"
    )
    parser.add_argument("pcap", type=Path, help="Input .pcap path")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output CSV (default: <pcap_stem>_flows.csv beside the pcap)",
    )
    parser.add_argument(
        "--predict",
        action="store_true",
        help="Run DetectionAgent scorecard (ML + OOD policy)",
    )
    parser.add_argument(
        "--ml-only",
        action="store_true",
        help="With --predict: skip OOD policy (raw frozen model only)",
    )
    parser.add_argument(
        "--expected",
        type=str,
        default=None,
        help="Expected class for scorecard (e.g. SSH-Bruteforce)",
    )
    args = parser.parse_args()

    pcap = args.pcap
    if not pcap.is_file():
        raise SystemExit(f"PCAP not found: {pcap}")

    out = args.output or pcap.with_name(pcap.stem + "_flows.csv")
    print(f"Reading {pcap} with cicflowmeter engine ...")
    raw_rows = pcap_to_cicflowmeter_dicts(pcap)
    rows = [cicflowmeter_to_cic_row(r) for r in raw_rows]
    write_flows_csv(rows, out)
    print(f"Wrote {out} ({len(rows)} flows)")

    if args.predict or args.expected:
        predict_scorecard(rows, expected=args.expected, ml_only=args.ml_only)


if __name__ == "__main__":
    main()
