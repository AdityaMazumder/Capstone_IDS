"""
File sensor (watchdog) — Phase 5 HIDS browser-file monitor.

Watches browser files that infostealers commonly target and logs an event
whenever one is touched:

  Browser   | File(s)
  ----------|---------------------------
  Chrome    | Cookies  and  Local State
  Edge      | Cookies
  Firefox   | cookies.sqlite

Each CSV row has four columns:
  timestamp, process, file_path, event_type (READ / MODIFY / CREATE)

Output:  hids/logs/file_events.csv

Run from repo root:
  python -m hids.file_monitor [--duration 0] [--poll-interval 1.0]
"""
from __future__ import annotations

import argparse
import csv
import os
import platform
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
LOG_FILE = "file_events.csv"
POLL_INTERVAL = 1.0  # seconds between watchdog poll ticks

FIELDS = ["timestamp", "process", "file_path", "event_type"]

# ---------------------------------------------------------------------------
# Browser-path resolution (Windows)
# ---------------------------------------------------------------------------

def _resolve_browser_paths() -> Dict[str, List[Path]]:
    """
    Return a mapping  { browser_name: [Path, ...] }  for the current user.
    Only includes paths that actually exist on disk so we don't watch ghosts.
    """
    targets: Dict[str, List[str]] = {}

    if platform.system() != "Windows":
        # Graceful no-op on Linux/macOS lab boxes
        return {}

    local_app = os.environ.get("LOCALAPPDATA", "")
    appdata = os.environ.get("APPDATA", "")

    if local_app:
        chrome_dir = os.path.join(local_app, "Google", "Chrome", "User Data")
        targets["Chrome"] = [
            os.path.join(chrome_dir, "Default", "Cookies"),
            os.path.join(chrome_dir, "Default", "Network", "Cookies"),
            os.path.join(chrome_dir, "Local State"),
        ]

        edge_dir = os.path.join(local_app, "Microsoft", "Edge", "User Data")
        targets["Edge"] = [
            os.path.join(edge_dir, "Default", "Cookies"),
            os.path.join(edge_dir, "Default", "Network", "Cookies"),
        ]

    if appdata:
        # Firefox profiles live in %APPDATA%/Mozilla/Firefox/Profiles/<random>.default*/
        ff_profiles = os.path.join(appdata, "Mozilla", "Firefox", "Profiles")
        ff_cookies: List[str] = []
        if os.path.isdir(ff_profiles):
            for profile in os.listdir(ff_profiles):
                cookie_db = os.path.join(ff_profiles, profile, "cookies.sqlite")
                ff_cookies.append(cookie_db)
        targets["Firefox"] = ff_cookies

    # Keep only paths that exist right now
    resolved: Dict[str, List[Path]] = {}
    for browser, paths in targets.items():
        existing = [Path(p) for p in paths if os.path.exists(p)]
        if existing:
            resolved[browser] = existing

    return resolved


def get_all_watch_paths() -> List[Path]:
    """Flat list of every file we should monitor."""
    paths: List[Path] = []
    for file_list in _resolve_browser_paths().values():
        paths.extend(file_list)
    return paths


# ---------------------------------------------------------------------------
# Heuristic: which process is touching the file?
# ---------------------------------------------------------------------------

def _identify_accessor(file_path: str) -> str:
    """
    Best-effort identification of the process holding a handle on *file_path*.
    Falls back to active browser detection or 'unknown'.
    """
    try:
        import psutil
    except ImportError:
        return "unknown"

    file_lower = file_path.lower().replace("/", "\\")
    active_procs = set()

    for proc in psutil.process_iter(["pid", "name"]):
        try:
            name = (proc.info.get("name") or "").lower()
            if name:
                active_procs.add(name)
            for f in proc.open_files():
                if f.path.lower().replace("/", "\\") == file_lower:
                    return proc.info["name"] or f"pid:{proc.info['pid']}"
        except (psutil.AccessDenied, psutil.NoSuchProcess, OSError):
            continue

    # Fallback heuristic: correlate file path with known active browser processes
    if "google\\chrome" in file_lower and "chrome.exe" in active_procs:
        return "chrome.exe"
    if "microsoft\\edge" in file_lower and "msedge.exe" in active_procs:
        return "msedge.exe"
    if "mozilla\\firefox" in file_lower and "firefox.exe" in active_procs:
        return "firefox.exe"

    return "unknown"


# ---------------------------------------------------------------------------
# CSV writer  (single file, appends)
# ---------------------------------------------------------------------------

class FileEventCsvWriter:
    """Appends rows to hids/logs/file_events.csv."""

    def __init__(self, log_dir: str = LOG_DIR, log_file: str = LOG_FILE):
        self.log_dir = log_dir
        self.path = os.path.join(log_dir, log_file)
        self._file = None
        self._writer: Optional[csv.DictWriter] = None

    def open(self) -> None:
        os.makedirs(self.log_dir, exist_ok=True)
        new_file = not os.path.exists(self.path) or os.path.getsize(self.path) == 0
        self._file = open(self.path, "a", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._file, fieldnames=FIELDS)
        if new_file:
            self._writer.writeheader()

    def write(self, rows: List[Dict[str, Any]]) -> None:
        if self._writer is None:
            self.open()
        if rows:
            self._writer.writerows(rows)
            self._file.flush()

    def close(self) -> None:
        if self._file:
            self._file.close()
        self._file = None
        self._writer = None


# ---------------------------------------------------------------------------
# Watchdog event handler
# ---------------------------------------------------------------------------

def _map_event_type(event_type: str, is_new: bool) -> str:
    """Map watchdog event constants to our schema (READ / MODIFY / CREATE)."""
    if is_new or event_type == "created":
        return "CREATE"
    elif event_type in ("modified", "closed"):
        return "MODIFY"
    else:
        return "READ"


class _BrowserFileHandler:
    """
    Watchdog FileSystemEventHandler that filters for our target files only.
    Collects events into a thread-safe list that the main loop drains.
    """

    def __init__(self, watched_files: List[Path]):
        import threading
        self._targets = {str(p).lower().replace("/", "\\"): str(p) for p in watched_files}
        self._lock = threading.Lock()
        self._pending: List[Dict[str, Any]] = []

    def _match_target(self, path: str) -> Optional[str]:
        p = path.lower().replace("/", "\\")
        if p in self._targets:
            return self._targets[p]
        # Check SQLite WAL/journal/shm companions (e.g. Cookies-wal -> Cookies)
        for target_low, target_orig in self._targets.items():
            if p.startswith(target_low) and any(
                p[len(target_low):] == suffix
                for suffix in ("-wal", "-journal", "-shm", ".bak", "_temp")
            ):
                return target_orig
        return None

    def _record(self, event_type: str, src_path: str) -> None:
        matched = self._match_target(src_path)
        if not matched:
            return
        proc_name = _identify_accessor(src_path)
        row = {
            "timestamp": datetime.now().isoformat(timespec="milliseconds"),
            "process": proc_name,
            "file_path": matched,
            "event_type": _map_event_type(event_type, is_new=(event_type == "created")),
        }
        print(f"  [EVENT] {row['event_type']} -> {matched} ({row['process']})")
        with self._lock:
            self._pending.append(row)

    def drain(self) -> List[Dict[str, Any]]:
        with self._lock:
            batch, self._pending = self._pending, []
        return batch

    # --- watchdog callbacks ---
    def on_modified(self, event):
        if not event.is_directory:
            self._record("modified", event.src_path)

    def on_created(self, event):
        if not event.is_directory:
            self._record("created", event.src_path)

    def on_closed(self, event):
        if not getattr(event, "is_directory", False):
            self._record("closed", event.src_path)


# ---------------------------------------------------------------------------
# Polling-based fallback (no watchdog dependency)
# ---------------------------------------------------------------------------

class _PollingWatcher:
    """
    Simple stat-based poller used when watchdog is unavailable or
    when the user explicitly requests polling mode.
    Tracks mtime + size of each target file and emits events on change.
    """

    def __init__(self, watched_files: List[Path]):
        self._files = watched_files
        self._state: Dict[str, tuple] = {}
        # Seed with current state so we don't fire on startup
        for f in self._files:
            key = str(f)
            try:
                st = os.stat(f)
                self._state[key] = (st.st_mtime, st.st_size)
            except OSError:
                pass  # file doesn't exist yet

    def poll(self) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for f in self._files:
            key = str(f)
            try:
                st = os.stat(f)
            except OSError:
                continue
            current = (st.st_mtime, st.st_size)
            prev = self._state.get(key)
            if prev is None:
                # File appeared
                rows.append(self._row(key, "CREATE"))
            elif current != prev:
                rows.append(self._row(key, "MODIFY"))
            self._state[key] = current
        return rows

    @staticmethod
    def _row(path: str, event_type: str) -> Dict[str, Any]:
        return {
            "timestamp": datetime.now().isoformat(timespec="milliseconds"),
            "process": _identify_accessor(path),
            "file_path": path,
            "event_type": event_type,
        }


# ---------------------------------------------------------------------------
# Legacy helpers (kept so existing imports from the stub don't break)
# ---------------------------------------------------------------------------

SENSITIVE_GLOBS = [
    "**/Google/Chrome/User Data/**/Cookies",
    "**/Google/Chrome/User Data/Local State",
    "**/Microsoft/Edge/User Data/**/Cookies",
    "**/Mozilla/Firefox/Profiles/**/cookies.sqlite",
]


def describe_watch_targets() -> List[str]:
    return list(SENSITIVE_GLOBS)


def path_looks_sensitive(path: str | Path) -> bool:
    text = str(path).lower().replace("\\", "/")
    needles = ("cookies", "local state", "cookies.sqlite")
    return any(n in text for n in needles)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run(
    poll_interval: float = POLL_INTERVAL,
    log_dir: str = LOG_DIR,
    duration: float = 0.0,
) -> None:
    """
    Start watching browser files for access / modification.

    Tries the *watchdog* library first (inotify / ReadDirectoryChangesW).
    Falls back to polling if watchdog is not installed.
    """
    watch_paths = get_all_watch_paths()
    if not watch_paths:
        print("No browser cookie/credential files found on this machine.")
        print("Resolved targets would be:")
        for g in describe_watch_targets():
            print(f"  {g}")
        return

    out = FileEventCsvWriter(log_dir)
    out.open()

    # Collect the parent directories we need to watch
    watch_dirs = list({str(p.parent) for p in watch_paths})

    use_watchdog = False
    observer = None
    handler = None

    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler

        # Build a proper watchdog handler class by composing our helper
        class _Handler(FileSystemEventHandler):
            def __init__(self, inner: _BrowserFileHandler):
                super().__init__()
                self._inner = inner

            def on_modified(self, event):
                self._inner.on_modified(event)

            def on_created(self, event):
                self._inner.on_created(event)

            def on_closed(self, event):
                self._inner.on_closed(event)

        handler = _BrowserFileHandler(watch_paths)
        observer = Observer()
        for d in watch_dirs:
            observer.schedule(_Handler(handler), d, recursive=False)
        observer.start()
        use_watchdog = True
        mode = "watchdog"
    except ImportError:
        mode = "polling"

    poller = None if use_watchdog else _PollingWatcher(watch_paths)

    events_logged = 0
    start = time.monotonic()

    print(f"File sensor ({mode}) watching {len(watch_paths)} file(s):")
    for p in watch_paths:
        print(f"  {p}")
    print(f"Logging to {out.path}")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            if use_watchdog:
                rows = handler.drain()
            else:
                rows = poller.poll()

            if rows:
                out.write(rows)
                events_logged += len(rows)

            if duration and time.monotonic() - start >= duration:
                break

            time.sleep(poll_interval)
    except KeyboardInterrupt:
        pass
    finally:
        if observer is not None:
            observer.stop()
            observer.join()
        out.close()
        elapsed = round(time.monotonic() - start, 1)
        print(f"\nStopped after {elapsed}s — {events_logged} event(s) logged to {out.path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="SentinelAI HIDS file sensor (Role 2)")
    parser.add_argument(
        "--poll-interval", type=float, default=POLL_INTERVAL,
        help=f"Seconds between poll/drain ticks (default {POLL_INTERVAL})",
    )
    parser.add_argument(
        "--log-dir", default=LOG_DIR,
        help="Output folder (default hids/logs)",
    )
    parser.add_argument(
        "--duration", type=float, default=0.0,
        help="Stop after N seconds (0 = run until Ctrl+C)",
    )
    args = parser.parse_args()
    run(poll_interval=args.poll_interval, log_dir=args.log_dir, duration=args.duration)


if __name__ == "__main__":
    main()
