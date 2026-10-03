"""
Feature engineering for the HIDS Isolation Forest (Member 2).

Turns raw sensor rows into ONE row per process run with numeric / boolean / small
categorical features. Pure functions only (no file or pandas I/O) so they are easy to
unit-test and reuse; build_dataset.py wires them to the CSVs.

A process run is identified by its (pid, create_time) key - the same key the process
and file sensors use - so a reused PID is a different run and a file access can be
joined to the exact process that made it.

Design choices that matter:
  * Raw exe_path / cmdline are NOT emitted (they leak usernames and personal paths and
    are useless to a model). They become a path bucket, boolean flags and lengths.
  * Rarity is measured against the BENIGN corpus: a program/parent/pair the normal data
    rarely shows gets a low frequency, which is what an Isolation Forest isolates.
  * File-access features default to 0, so runs with no file activity are still valid rows.
"""
from __future__ import annotations

import math
import os
import re
from collections import Counter
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

RunKey = Tuple[int, float]

# Where an executable lives - a strong stealer signal (Temp / Downloads / AppData).
# Fragments are matched against a lower-cased, backslash-normalised path.
PATH_BUCKETS = [
    ("system", ("\\windows\\system32\\", "\\windows\\syswow64\\", "\\windows\\")),
    ("program_files", ("\\program files\\", "\\program files (x86)\\")),
    ("appdata_local", ("\\appdata\\local\\",)),
    ("appdata_roaming", ("\\appdata\\roaming\\",)),
    ("temp", ("\\appdata\\local\\temp\\", "\\windows\\temp\\", "\\temp\\")),
    ("downloads", ("\\downloads\\",)),
    ("desktop", ("\\desktop\\",)),
    ("user_profile", ("\\users\\",)),
]

SHELL_PARENTS = {"powershell.exe", "pwsh.exe", "cmd.exe", "wscript.exe", "cscript.exe",
                 "mshta.exe", "rundll32.exe", "regsvr32.exe", "wmic.exe"}

SUSPICIOUS_CMDLINE = {
    "encoded": re.compile(r"-e(nc|ncodedcommand)?\b", re.I),
    "hidden": re.compile(r"-w(indowstyle)?\s+hidden|-windowstyle\s+hidden", re.I),
    "noninteractive_bypass": re.compile(r"-nop(rofile)?\b|- exec(utionpolicy)?\s+bypass|-ep\s+bypass", re.I),
    "download": re.compile(r"invoke-webrequest|downloadstring|downloadfile|certutil|bitsadmin|curl\b|wget\b", re.I),
    "browser_data": re.compile(r"appdata|user data|login data|cookies|local state|\.sqlite", re.I),
}

# File types the sensors emit (see host_agent.SENSITIVE_TARGETS)
PASSWORD_TYPES = {"Saved Passwords DB", "Firefox Saved Passwords", "Firefox Key Database"}
COOKIE_TYPES = {"CookieDB", "Firefox CookieDB"}
MASTERKEY_TYPES = {"LocalState (Master Key)"}


def path_bucket(exe_path: str) -> str:
    if not exe_path:
        return "unknown"
    marker = exe_path.lower().replace("/", "\\")
    # temp must win over appdata_local, so check it first
    for name in ("temp", "downloads", "desktop"):
        for frag in dict(PATH_BUCKETS)[name]:
            if frag in marker:
                return name
    for name, frags in PATH_BUCKETS:
        if name in ("temp", "downloads", "desktop"):
            continue
        if any(frag in marker for frag in frags):
            return name
    return "other"


def is_user_space(bucket: str) -> bool:
    return bucket in ("appdata_local", "appdata_roaming", "temp", "downloads", "desktop", "user_profile")


def split_cmdline(cmdline: str) -> List[str]:
    return [tok for tok in re.split(r"\s+", cmdline.strip()) if tok] if cmdline else []


def cmdline_flags(cmdline: str) -> Dict[str, int]:
    text = cmdline or ""
    flags = {f"cmd_{name}": int(bool(rx.search(text))) for name, rx in SUSPICIOUS_CMDLINE.items()}
    flags["cmd_len"] = len(text)
    flags["cmd_tokens"] = len(split_cmdline(text))
    flags["cmd_has_url"] = int(bool(re.search(r"https?://", text, re.I)))
    return flags


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        f = float(value)
        return default if math.isnan(f) else f
    except (TypeError, ValueError):
        return default


def _clip(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


class Corpus:
    """Frequencies of names / parents / parent>child pairs in the benign runs."""

    def __init__(self, runs: Iterable[Mapping[str, Any]]):
        runs = list(runs)
        self.total = max(1, len(runs))
        self.name = Counter(str(r.get("process_name", "")).lower() for r in runs)
        self.parent = Counter(str(r.get("parent_name", "")).lower() for r in runs)
        self.pair = Counter(
            (str(r.get("parent_name", "")).lower(), str(r.get("process_name", "")).lower())
            for r in runs
        )

    def name_freq(self, name: str) -> float:
        return self.name.get(str(name).lower(), 0) / self.total

    def parent_freq(self, name: str) -> float:
        return self.parent.get(str(name).lower(), 0) / self.total

    def pair_freq(self, parent: str, name: str) -> float:
        return self.pair.get((str(parent).lower(), str(name).lower()), 0) / self.total


def aggregate_file_events(events: Iterable[Mapping[str, Any]]) -> Dict[RunKey, Dict[str, Any]]:
    """Group file-sensor rows by run key into per-run access features."""
    out: Dict[RunKey, Dict[str, Any]] = {}
    for ev in events:
        pid = ev.get("pid")
        ct = ev.get("create_time")
        if pid in (None, "", 0) or ct in (None, ""):
            continue
        key = (int(pid), round(float(ct), 3))
        agg = out.setdefault(key, {
            "file_reads": 0, "file_writes": 0, "file_deletes": 0,
            "touched_password_db": 0, "touched_cookies": 0, "touched_master_key": 0,
            "touched_web_data": 0, "file_types": set(), "browsers": set(),
            "accessed_not_owner": 0, "accessed_as_owner": 0,
        })
        etype = str(ev.get("event_type", "")).upper()
        if etype == "READ":
            agg["file_reads"] += 1
        elif etype in ("MODIFY", "CREATE"):
            agg["file_writes"] += 1
        elif etype == "DELETE":
            agg["file_deletes"] += 1
        ftype = str(ev.get("file_type", ""))
        if ftype:
            agg["file_types"].add(ftype)
        if ftype in PASSWORD_TYPES:
            agg["touched_password_db"] = 1
        if ftype in COOKIE_TYPES:
            agg["touched_cookies"] = 1
        if ftype in MASTERKEY_TYPES:
            agg["touched_master_key"] = 1
        if ftype == "Autofill & Credit Cards":
            agg["touched_web_data"] = 1
        browser = str(ev.get("browser", ""))
        if browser:
            agg["browsers"].add(browser)
        owner = ev.get("accessor_is_owner")
        if owner in (0, "0"):
            agg["accessed_not_owner"] = 1
        elif owner in (1, "1"):
            agg["accessed_as_owner"] = 1
    for agg in out.values():
        agg["distinct_sensitive_types"] = len(agg.pop("file_types"))
        agg["distinct_browsers"] = len(agg.pop("browsers"))
    return out


EMPTY_FILE_FEATURES = {
    "file_reads": 0, "file_writes": 0, "file_deletes": 0,
    "touched_password_db": 0, "touched_cookies": 0, "touched_master_key": 0,
    "touched_web_data": 0, "distinct_sensitive_types": 0, "distinct_browsers": 0,
    "accessed_not_owner": 0, "accessed_as_owner": 0,
}

FEATURE_COLUMNS = [
    "lifetime_s", "is_running", "samples",
    "cpu_mean", "cpu_max", "memory_max_mb",
    "name_freq", "parent_freq", "pair_freq",
    "path_bucket", "from_user_space", "from_temp_or_downloads", "from_program_files",
    "parent_is_shell", "name_exe_mismatch",
    "cmd_len", "cmd_tokens", "cmd_has_url",
    "cmd_encoded", "cmd_hidden", "cmd_noninteractive_bypass", "cmd_download", "cmd_browser_data",
    "file_reads", "file_writes", "file_deletes",
    "touched_password_db", "touched_cookies", "touched_master_key", "touched_web_data",
    "distinct_sensitive_types", "distinct_browsers", "accessed_not_owner", "accessed_as_owner",
]
ID_COLUMNS = ["pid", "create_time", "process_name", "parent_name", "source_host", "label"]


def build_run_features(
    run: Mapping[str, Any],
    corpus: Corpus,
    file_features: Optional[Mapping[str, Any]] = None,
    source_host: str = "",
    label: str = "Normal",
) -> Dict[str, Any]:
    """One raw EXIT/END row (+ optional joined file features) -> one feature row."""
    event = str(run.get("event", "")).upper()
    exe_path = str(run.get("exe_path", "") or "")
    process_name = str(run.get("process_name", "") or "")
    parent_name = str(run.get("parent_name", "") or "")
    cmdline = str(run.get("cmdline", "") or "")
    bucket = path_bucket(exe_path)

    row: Dict[str, Any] = {
        "pid": int(_to_float(run.get("pid"))),
        "create_time": round(_to_float(run.get("create_time")), 3),
        "process_name": process_name,
        "parent_name": parent_name,
        "source_host": source_host,
        "label": label,

        "lifetime_s": round(max(0.0, _to_float(run.get("lifetime_s"))), 3),
        "is_running": int(event == "END"),
        "samples": int(_to_float(run.get("samples"))),
        "cpu_mean": round(_clip(_to_float(run.get("cpu_mean")), 0.0, 100.0), 3),
        "cpu_max": round(_clip(_to_float(run.get("cpu_max")), 0.0, 100.0), 3),
        "memory_max_mb": round(_to_float(run.get("memory_max_mb") or run.get("memory_mb")), 3),

        "name_freq": round(corpus.name_freq(process_name), 6),
        "parent_freq": round(corpus.parent_freq(parent_name), 6),
        "pair_freq": round(corpus.pair_freq(parent_name, process_name), 6),

        "path_bucket": bucket,
        "from_user_space": int(is_user_space(bucket)),
        "from_temp_or_downloads": int(bucket in ("temp", "downloads")),
        "from_program_files": int(bucket == "program_files"),
        "parent_is_shell": int(parent_name.lower() in SHELL_PARENTS),
        "name_exe_mismatch": int(
            bool(exe_path) and bool(process_name)
            and os.path.basename(exe_path).lower() != process_name.lower()
        ),
    }
    flags = cmdline_flags(cmdline)
    row.update({
        "cmd_len": flags["cmd_len"],
        "cmd_tokens": flags["cmd_tokens"],
        "cmd_has_url": flags["cmd_has_url"],
        "cmd_encoded": flags["cmd_encoded"],
        "cmd_hidden": flags["cmd_hidden"],
        "cmd_noninteractive_bypass": flags["cmd_noninteractive_bypass"],
        "cmd_download": flags["cmd_download"],
        "cmd_browser_data": flags["cmd_browser_data"],
    })
    row.update(dict(EMPTY_FILE_FEATURES))
    if file_features:
        row.update({k: file_features[k] for k in EMPTY_FILE_FEATURES if k in file_features})
    return row
