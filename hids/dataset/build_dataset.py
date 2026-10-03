"""
Build the HIDS Isolation Forest training table (Member 2).

Pipeline:
  1. Load one or more process-sensor CSVs (hids/logs/process_events_*.csv, Adityo.csv, ...).
     Keep the EXIT / END rows - exactly one summary row per process run.
  2. Load file-sensor CSVs (hids/logs/file_events_*.csv) and aggregate accesses per run.
  3. Join file activity onto each run by its (pid, create_time) key.
  4. Label each run: "Stealer" if its run key is in a simulator manifest, else "Normal".
     Labelling is by exact run identity, so there is no leakage and no
     "every python.exe is a stealer" guessing.
  5. Engineer one feature row per run (see features.py) and write the table.

The Isolation Forest trains on the "Normal" rows only; the "Stealer" rows are the
labelled set for measuring detection. Both are written to the same file with a `label`
column so you can split them however you like.

Examples (run from repo root):
  python -m hids.dataset.build_dataset                       # auto-discover hids/logs + manifests
  python -m hids.dataset.build_dataset --out hids/dataset/hids_dataset.csv
  python -m hids.dataset.build_dataset --process hids/logs/*.csv --files hids/logs/file_events_*.csv
  python -m hids.dataset.build_dataset --split                # also write *_normal.csv / *_stealer.csv
"""
from __future__ import annotations

import argparse
import glob
import os
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from hids.dataset.features import (
    FEATURE_COLUMNS,
    ID_COLUMNS,
    Corpus,
    RunKey,
    aggregate_file_events,
    build_run_features,
)
from hids.dataset.stealer_simulator import DEFAULT_MANIFEST, manifest_run_keys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(os.path.dirname(BASE_DIR), "logs")
MANIFEST_DIR = os.path.join(BASE_DIR, "manifests")
DEFAULT_OUT = os.path.join(BASE_DIR, "hids_dataset.csv")

PROCESS_MARKERS = {"event", "lifetime_s", "create_time"}
FILE_MARKERS = {"file_type", "browser", "access_mask"}


_DATED = re.compile(r"^(process|file)_events_\d{4}-\d{2}-\d{2}$")


def _host_from_path(path: str) -> str:
    """Dated sensor files are this machine ('self'); anything else is named after its owner."""
    stem = os.path.splitext(os.path.basename(path))[0]
    if _DATED.match(stem):
        return "self"
    for prefix in ("process_events_", "file_events_"):
        if stem.startswith(prefix):
            return stem[len(prefix):]
    return stem


def classify_csv(path: str) -> Optional[str]:
    """'process', 'file' or None, from the header only (cheap)."""
    try:
        cols = set(pd.read_csv(path, nrows=0).columns)
    except Exception:
        return None
    if FILE_MARKERS.issubset(cols):
        return "file"
    if PROCESS_MARKERS.issubset(cols):
        return "process"
    return None


def discover_inputs(log_dir: str = LOG_DIR) -> Tuple[List[str], List[str]]:
    process_csvs, file_csvs = [], []
    for path in sorted(glob.glob(os.path.join(log_dir, "*.csv"))):
        kind = classify_csv(path)
        if kind == "process":
            process_csvs.append(path)
        elif kind == "file":
            file_csvs.append(path)
    return process_csvs, file_csvs


def load_runs(process_csvs: List[str], host: Optional[str] = None) -> pd.DataFrame:
    """EXIT/END rows from every process CSV, tagged with a source host."""
    frames = []
    for path in process_csvs:
        df = pd.read_csv(path, dtype={"pid": "Int64"}, low_memory=False)
        df = df[df["event"].isin(["EXIT", "END"])].copy()
        df["source_host"] = host or _host_from_path(path)
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    runs = pd.concat(frames, ignore_index=True)
    runs = runs.dropna(subset=["pid", "create_time"])
    runs["run_key"] = list(zip(runs["pid"].astype(int), runs["create_time"].round(3)))
    return runs.drop_duplicates(subset=["source_host", "run_key"], keep="last")


def load_file_features(file_csvs: List[str]) -> Dict[RunKey, Dict]:
    events = []
    for path in file_csvs:
        df = pd.read_csv(path, low_memory=False)
        events.extend(df.to_dict("records"))
    return aggregate_file_events(events)


def build(
    process_csvs: List[str],
    file_csvs: List[str],
    manifest_paths: List[str],
    host: Optional[str] = None,
) -> pd.DataFrame:
    runs = load_runs(process_csvs, host=host)
    if runs.empty:
        return pd.DataFrame(columns=ID_COLUMNS + FEATURE_COLUMNS)

    file_features = load_file_features(file_csvs)
    stealer_keys = {}
    for mpath in manifest_paths:
        stealer_keys.update(manifest_run_keys(mpath))

    labels = {
        key: "Stealer"
        for key in zip(runs["pid"].astype(int), runs["create_time"].round(3))
        if key in stealer_keys
    }

    benign = [r for r in runs.to_dict("records")
              if labels.get((int(r["pid"]), round(float(r["create_time"]), 3))) != "Stealer"]
    corpus = Corpus(benign)

    rows = []
    for r in runs.to_dict("records"):
        key = (int(r["pid"]), round(float(r["create_time"]), 3))
        rows.append(build_run_features(
            r, corpus,
            file_features=file_features.get(key),
            source_host=r.get("source_host", ""),
            label=labels.get(key, "Normal"),
        ))
    return pd.DataFrame(rows, columns=ID_COLUMNS + FEATURE_COLUMNS)


def _summary(df: pd.DataFrame) -> str:
    if df.empty:
        return "No runs found."
    lines = [
        f"runs           : {len(df)}",
        f"  normal       : {(df.label == 'Normal').sum()}",
        f"  stealer      : {(df.label == 'Stealer').sum()}",
        f"hosts          : {df.source_host.nunique()} ({', '.join(sorted(df.source_host.unique()))})",
        f"distinct procs : {df.process_name.nunique()}",
        f"runs with file activity: {(df.file_reads + df.file_writes + df.file_deletes > 0).sum()}",
        f"  touched password DB  : {df.touched_password_db.sum()}",
        f"  accessed as non-owner: {df.accessed_not_owner.sum()}",
        f"from temp/downloads    : {df.from_temp_or_downloads.sum()}",
        f"parent is a shell      : {df.parent_is_shell.sum()}",
    ]
    if (df.label == "Stealer").sum():
        s = df[df.label == "Stealer"]
        lines.append(f"stealer runs from temp/downloads: {s.from_temp_or_downloads.sum()}/{len(s)}, "
                     f"touched password DB: {s.touched_password_db.sum()}/{len(s)}")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the HIDS Isolation Forest dataset (Member 2)")
    parser.add_argument("--process", nargs="*", help="Process-sensor CSV globs (default: auto-discover hids/logs)")
    parser.add_argument("--files", nargs="*", help="File-sensor CSV globs (default: auto-discover hids/logs)")
    parser.add_argument("--manifest", nargs="*", help=f"Stealer manifest globs (default {MANIFEST_DIR}/*.jsonl)")
    parser.add_argument("--out", default=DEFAULT_OUT, help=f"Output CSV (default {DEFAULT_OUT})")
    parser.add_argument("--host", default=None, help="Force the source_host tag for all process CSVs")
    parser.add_argument("--split", action="store_true", help="Also write <out>_normal.csv and <out>_stealer.csv")
    args = parser.parse_args()

    if args.process:
        process_csvs = sorted({p for g in args.process for p in glob.glob(g)})
    else:
        process_csvs, auto_files = discover_inputs()
    if args.files:
        file_csvs = sorted({p for g in args.files for p in glob.glob(g)})
    elif args.process:
        file_csvs = []
    else:
        file_csvs = auto_files
    if args.manifest:
        manifest_paths = sorted({p for g in args.manifest for p in glob.glob(g)})
    else:
        manifest_paths = sorted(glob.glob(os.path.join(MANIFEST_DIR, "*.jsonl"))) or [DEFAULT_MANIFEST]

    print("Process CSVs:", *(f"\n  {p}" for p in process_csvs) or "  none")
    print("File CSVs   :", *(f"\n  {p}" for p in file_csvs) or "  none")
    print("Manifests   :", *(f"\n  {p}" for p in manifest_paths) or "  none")

    df = build(process_csvs, file_csvs, manifest_paths, host=args.host)
    if df.empty:
        print("\nNo EXIT/END runs found - run the process sensor first.")
        return

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    df.to_csv(args.out, index=False)
    print(f"\nWrote {args.out}")
    print(_summary(df))

    if args.split:
        base, ext = os.path.splitext(args.out)
        df[df.label == "Normal"].to_csv(f"{base}_normal{ext}", index=False)
        df[df.label == "Stealer"].to_csv(f"{base}_stealer{ext}", index=False)
        print(f"Wrote {base}_normal{ext} and {base}_stealer{ext}")


if __name__ == "__main__":
    main()
