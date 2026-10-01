"""
Process monitor (psutil) - Phase 5 HIDS process sensor.

Every INTERVAL seconds, snapshots all running processes and appends
one row per process to hids/logs/process_events.csv.
Read-only: never kills or modifies processes.

Run from repo root:  python -m hids.process_monitor
"""
from __future__ import annotations

import csv
import os
import time
from datetime import datetime
from typing import Any, Dict, List

INTERVAL = 2  # seconds between snapshots
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(BASE_DIR, "logs", "process_events.csv")
FIELDS = [
    "timestamp", "pid", "process_name", "parent_name",
    "cpu_percent", "memory_mb", "exe_path",
]


def list_running_processes(limit: int = 25) -> List[Dict[str, Any]]:
    """Original stub helper, kept so existing imports don't break."""
    try:
        import psutil
    except ImportError as exc:
        raise ImportError("Install psutil: pip install psutil") from exc

    rows: List[Dict[str, Any]] = []
    for proc in psutil.process_iter(["pid", "name", "username", "exe"]):
        info = proc.info
        rows.append(
            {
                "pid": info.get("pid"),
                "name": info.get("name"),
                "username": info.get("username"),
                "exe": info.get("exe"),
            }
        )
        if len(rows) >= limit:
            break
    return rows


def snapshot() -> List[Dict[str, Any]]:
    """One row per running process, in the Week 1 schema."""
    import psutil

    procs = list(psutil.process_iter())

    # pid -> name, so parent names can be looked up cheaply
    names: Dict[int, str] = {}
    for p in procs:
        try:
            names[p.pid] = p.name()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rows: List[Dict[str, Any]] = []
    for p in procs:
        try:
            rows.append(
                {
                    "timestamp": now,
                    "pid": p.pid,
                    "process_name": p.name(),
                    "parent_name": names.get(p.ppid(), ""),
                    "cpu_percent": p.cpu_percent(interval=None),
                    "memory_mb": round(p.memory_info().rss / (1024 * 1024), 1),
                    "exe_path": p.exe() or "",
                }
            )
        except psutil.AccessDenied:
            # Protected system process: keep the row, blank the details
            try:
                rows.append(
                    {
                        "timestamp": now,
                        "pid": p.pid,
                        "process_name": p.name(),
                        "parent_name": names.get(p.ppid(), ""),
                        "cpu_percent": 0.0,
                        "memory_mb": 0.0,
                        "exe_path": "",
                    }
                )
            except psutil.Error:
                pass
        except psutil.NoSuchProcess:
            pass  # process exited mid-scan
    return rows


def run(interval: int = INTERVAL, log_path: str = LOG_PATH) -> None:
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    new_file = not os.path.exists(log_path) or os.path.getsize(log_path) == 0

    with open(log_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if new_file:
            writer.writeheader()
        print(f"Monitoring processes every {interval}s -> {log_path}")
        print("Press Ctrl+C to stop.")
        try:
            while True:
                writer.writerows(snapshot())
                f.flush()
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    run()