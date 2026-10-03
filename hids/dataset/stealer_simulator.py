"""
Infostealer simulator - generates REAL labelled "Stealer" behaviour for Member 2's dataset.

It behaves like an infostealer (RedLine / Vidar / Lumma / Raccoon) so the HIDS sensors
record genuine malicious-looking telemetry, WITHOUT any real malware:

  * copies the running Python interpreter to %TEMP% under an innocent name
    (e.g. svchost_update.exe) and runs the payload from there, launched via cmd.exe,
    so the process has an executable path in Temp and a shell parent - exactly what a
    real stealer looks like, and the opposite of a browser reading its own files;
  * finds the browser credential files infostealers target (Login Data, Cookies,
    Local State, Web Data for every Chromium profile; Firefox logins.json / key4.db /
    cookies.sqlite; Bitcoin wallet.dat) via hids.file_monitor.resolve_targets;
  * copies each one to a temp "loot" folder, handling locked databases, then shreds
    the loot and exits within a few seconds (one-shot, never a forever loop);
  * records exactly what it did - its own (pid, create_time) run key and the files it
    touched - to a manifest, so build_dataset.py can label precisely these runs
    "Stealer" and nothing else (no "every python.exe is a stealer" guessing).

NOTHING is exfiltrated and the copies are deleted immediately.

Run from repo root (optionally in an Administrator PowerShell, alongside the sensors,
so the file sensor's event 4663 also records the reads):

  # one disguised run
  python -m hids.dataset.stealer_simulator

  # several runs with varied names / shells (for a labelled evaluation set)
  python -m hids.dataset.stealer_simulator --runs 20

  # run in-place, no Temp copy (exe_path stays the real interpreter)
  python -m hids.dataset.stealer_simulator --no-disguise

Capture the behaviour by running the process sensor at the same time:
  python -m hids.process_monitor --interval 1 --duration 300
and, as Administrator, the file sensor:
  python -m hids.file_monitor --mode audit --duration 300
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import random
import shutil
import subprocess
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MANIFEST = os.path.join(BASE_DIR, "manifests", "stealer_runs.jsonl")

PAYLOAD_ENV = "SENTINEL_SIM_PAYLOAD"
MANIFEST_ENV = "SENTINEL_SIM_MANIFEST"
DWELL_ENV = "SENTINEL_SIM_DWELL"  # fixed "collection" seconds, so the sensor reliably samples the run

# Innocent-looking names real stealers hide behind
DISGUISE_NAMES = [
    "svchost_update.exe", "OneDriveStandaloneUpdater.exe", "chrome_update.exe",
    "AdobeArmSvc.exe", "RuntimeBrokerHelper.exe", "WindowsUpdateHost.exe",
    "nvcontainer_update.exe", "SecurityHealthService.exe",
]
# Shells that launch the disguised process (realistic malicious parents)
LAUNCH_SHELLS = ["cmd", "powershell"]

READ_CHUNK = 1 << 16  # 64 KiB, enough to trigger a real file read


# ---------------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------------

def _resolve_targets() -> List[Tuple[str, str, str]]:
    """(path, browser, file_type) for every credential file that exists."""
    try:
        from hids.file_monitor import resolve_targets

        return [(t.path, t.browser, t.file_type) for t in resolve_targets()]
    except Exception as exc:  # pragma: no cover - only if file_monitor import breaks
        print(f"[sim] could not resolve targets via file_monitor: {exc}")
        return []


# ---------------------------------------------------------------------------
# The payload: what the "stealer" actually does
# ---------------------------------------------------------------------------

def _copy_locked(src: str, dst: str) -> str:
    """Copy a possibly-locked DB the way a stealer does. Returns an outcome string."""
    try:
        shutil.copy2(src, dst)
        return "copied"
    except PermissionError:
        pass
    except OSError as exc:
        return f"error:{exc.__class__.__name__}"
    # Locked (browser open): read with shared access, like a stealer grabbing an open DB
    try:
        with open(src, "rb", buffering=0) as fh, open(dst, "wb") as out:
            while True:
                chunk = fh.read(READ_CHUNK)
                if not chunk:
                    break
                out.write(chunk)
        return "copied_shared"
    except Exception as exc:
        return f"locked:{exc.__class__.__name__}"


def run_payload(manifest_path: str, loot_dir: Optional[str] = None) -> Dict[str, Any]:
    """Steal (copy then shred) credential files; record and return a manifest entry."""
    import psutil

    proc = psutil.Process(os.getpid())
    create_time = round(proc.create_time(), 3)
    try:
        parent = proc.parent()
        parent_name = parent.name() if parent else ""
    except Exception:
        parent_name = ""

    loot = loot_dir or os.path.join(os.environ.get("TEMP", BASE_DIR), f"ldr_{os.getpid()}")
    os.makedirs(loot, exist_ok=True)
    started = time.time()
    records: List[Dict[str, str]] = []

    for path, browser, file_type in _resolve_targets():
        dst = os.path.join(loot, f"{browser}_{os.path.basename(path)}_{len(records)}")
        outcome = _copy_locked(path, dst) if os.path.isfile(path) else "missing"
        records.append({"path": path, "browser": browser, "file_type": file_type, "outcome": outcome})
        print(f"[sim] {outcome:>14}  [{browser}] {path}")

    dwell_env = os.environ.get(DWELL_ENV)
    dwell = float(dwell_env) if dwell_env else random.uniform(0.4, 1.2)
    time.sleep(dwell)  # brief "collection" pause, still short-lived
    shutil.rmtree(loot, ignore_errors=True)  # never exfiltrate; destroy the loot
    ended = time.time()

    stolen = sum(1 for r in records if r["outcome"].startswith("copied"))
    entry = {
        "run_key": [os.getpid(), create_time],
        "pid": os.getpid(),
        "create_time": create_time,
        "process_name": os.path.basename(sys.executable),
        "exe_path": sys.executable,
        "parent_name": parent_name,
        "cmdline": " ".join(sys.argv),
        "started": round(started, 3),
        "started_iso": datetime.fromtimestamp(started).isoformat(timespec="milliseconds"),
        "ended": round(ended, 3),
        "duration_s": round(ended - started, 3),
        "files_targeted": len(records),
        "files_stolen": stolen,
        "files": records,
        "label": "Stealer",
    }
    _append_manifest(manifest_path, entry)
    print(f"[sim] run {os.getpid()} done: stole {stolen}/{len(records)} file(s) in {entry['duration_s']}s "
          f"as {entry['process_name']} (parent {parent_name or '?'})")
    return entry


def _append_manifest(manifest_path: str, entry: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(manifest_path)), exist_ok=True)
    with open(manifest_path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")


def load_manifest(manifest_path: str = DEFAULT_MANIFEST) -> List[Dict[str, Any]]:
    if not os.path.isfile(manifest_path):
        return []
    with open(manifest_path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def manifest_run_keys(manifest_path: str = DEFAULT_MANIFEST) -> Dict[Tuple[int, float], Dict[str, Any]]:
    return {(e["pid"], float(e["create_time"])): e for e in load_manifest(manifest_path)}


# ---------------------------------------------------------------------------
# Disguise: run a copied interpreter from %TEMP% under an innocent name
# ---------------------------------------------------------------------------

def _stage_interpreter(name: str, temp_root: Optional[str] = None) -> str:
    r"""Copy python.exe + its runtime DLLs to %TEMP%\<name>, return the exe path."""
    src_dir = os.path.dirname(sys.executable)
    staging = os.path.join(temp_root or os.environ.get("TEMP", BASE_DIR), f"sentinel_sim_{os.getpid()}_{random.randint(1000,9999)}")
    os.makedirs(staging, exist_ok=True)
    exe = os.path.join(staging, name)
    shutil.copy2(sys.executable, exe)
    patterns = ["python3.dll", f"python{sys.version_info.major}{sys.version_info.minor}.dll", "vcruntime*.dll"]
    for pattern in patterns:
        for dll in glob.glob(os.path.join(src_dir, pattern)):
            shutil.copy2(dll, os.path.join(staging, os.path.basename(dll)))
    return exe


def _launch_disguised(name: str, shell: str, manifest_path: str) -> int:
    exe = _stage_interpreter(name)
    staging = os.path.dirname(exe)
    script = os.path.abspath(__file__)
    env = dict(os.environ, PYTHONHOME=sys.base_prefix, PYTHONPATH=os.pathsep.join(sys.path),
               **{PAYLOAD_ENV: "1", MANIFEST_ENV: manifest_path})
    inner = [exe, script, "--payload"]
    if shell == "cmd":
        cmd = ["cmd", "/c"] + inner
    elif shell == "powershell":
        cmd = ["powershell", "-NoProfile", "-Command",
               "& '{0}' '{1}' --payload".format(exe, script)]
    else:
        cmd = inner
    try:
        return subprocess.call(cmd, env=env)
    finally:
        shutil.rmtree(staging, ignore_errors=True)


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------

def simulate(runs: int = 1, disguise: bool = True, manifest_path: str = DEFAULT_MANIFEST,
             gap: float = 1.0) -> None:
    for i in range(runs):
        if disguise:
            name = random.choice(DISGUISE_NAMES)
            shell = random.choice(LAUNCH_SHELLS)
            print(f"\n[sim] run {i + 1}/{runs}: disguised as {name} via {shell}")
            code = _launch_disguised(name, shell, manifest_path)
            if code != 0:
                print(f"[sim] disguised run exited with code {code}; falling back to in-place")
                run_payload(manifest_path)
        else:
            print(f"\n[sim] run {i + 1}/{runs}: in-place ({os.path.basename(sys.executable)})")
            run_payload(manifest_path)
        if i < runs - 1:
            time.sleep(gap)


def main() -> None:
    if os.environ.get(PAYLOAD_ENV) == "1":
        run_payload(os.environ.get(MANIFEST_ENV, DEFAULT_MANIFEST))
        return

    parser = argparse.ArgumentParser(description="SentinelAI infostealer simulator (safe, Member 2 dataset)")
    parser.add_argument("--runs", type=int, default=1, help="Number of stealer runs to simulate")
    parser.add_argument("--no-disguise", action="store_true",
                        help="Run in-place instead of copying the interpreter to Temp")
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST,
                        help=f"Manifest file to append run records to (default {DEFAULT_MANIFEST})")
    parser.add_argument("--payload", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--gap", type=float, default=1.0, help="Seconds between runs")
    parser.add_argument("--dwell", type=float, default=None,
                        help="Fixed collection seconds per run (default: random 0.4-1.2)")
    args = parser.parse_args()

    if args.dwell is not None:
        os.environ[DWELL_ENV] = str(args.dwell)

    if args.payload:
        run_payload(args.manifest)
        return
    simulate(runs=args.runs, disguise=not args.no_disguise, manifest_path=args.manifest, gap=args.gap)


if __name__ == "__main__":
    main()
