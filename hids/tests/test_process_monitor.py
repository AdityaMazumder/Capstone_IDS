"""
Tests for the HIDS process sensor (hids/process_monitor.py).
Run from repo root:  python -m unittest hids.tests.test_process_monitor -v
"""

import csv
import os
import shutil
import tempfile
import unittest
from datetime import datetime

from hids.process_monitor import FIELDS, DailyCsvWriter, ProcessTracker, read_static, scan


def proc(pid, name, create_time, ppid=1, cpu=0.0, mem=10.0):
    return {"pid": pid, "ppid": ppid, "name": name, "create_time": create_time, "cpu_percent": cpu, "memory_mb": mem}


def static(pid):
    return f"C:\\bin\\{pid}.exe", f"{pid}.exe --flag"


def events(rows, event):
    return [r for r in rows if r["event"] == event]


class TestProcessTracker(unittest.TestCase):

    def setUp(self):
        self.tracker = ProcessTracker(stats_every=10)
        self.parent = proc(1, "explorer.exe", 100.0)

    def test_start_is_emitted_once_per_run(self):
        first = self.tracker.update([self.parent, proc(50, "app.exe", 200.0)], 1000.0, static)
        second = self.tracker.update([self.parent, proc(50, "app.exe", 200.0)], 1002.0, static)
        self.assertEqual(len(events(first, "START")), 2)
        self.assertEqual(second, [])

    def test_start_row_has_identity_and_static_fields(self):
        rows = self.tracker.update([self.parent, proc(50, "app.exe", 200.0, mem=42.0)], 1000.0, static)
        row = next(r for r in rows if r["pid"] == 50)
        self.assertEqual(set(row), set(FIELDS))
        self.assertEqual(row["parent_name"], "explorer.exe")
        self.assertEqual(row["parent_alive"], 1)
        self.assertEqual(row["exe_path"], "C:\\bin\\50.exe")
        self.assertEqual(row["cmdline"], "50.exe --flag")
        self.assertEqual(row["memory_mb"], 42.0)
        self.assertEqual(row["cpu_percent"], "")

    def test_exit_summary_excludes_first_cpu_reading(self):
        self.tracker.update([self.parent, proc(50, "app.exe", 995.0, cpu=0.0)], 1000.0, static)
        self.tracker.update([self.parent, proc(50, "app.exe", 995.0, cpu=4.0, mem=30.0)], 1002.0, static)
        self.tracker.update([self.parent, proc(50, "app.exe", 995.0, cpu=8.0, mem=20.0)], 1004.0, static)
        rows = self.tracker.update([self.parent], 1006.0, static)
        exit_row = events(rows, "EXIT")[0]
        self.assertEqual(exit_row["pid"], 50)
        self.assertEqual(exit_row["samples"], 3)
        self.assertEqual(exit_row["cpu_mean"], 6.0)
        self.assertEqual(exit_row["cpu_max"], 8.0)
        self.assertEqual(exit_row["memory_max_mb"], 30.0)
        self.assertEqual(exit_row["lifetime_s"], 9.0)

    def test_reused_pid_is_a_new_run(self):
        self.tracker.update([self.parent, proc(50, "old.exe", 200.0)], 1000.0, static)
        rows = self.tracker.update([self.parent, proc(50, "new.exe", 1001.0)], 1002.0, static)
        self.assertEqual(events(rows, "EXIT")[0]["process_name"], "old.exe")
        self.assertEqual(events(rows, "START")[0]["process_name"], "new.exe")

    def test_parent_younger_than_child_is_not_its_parent(self):
        reused_parent_pid = proc(1, "notepad.exe", 500.0)
        rows = self.tracker.update([reused_parent_pid, proc(50, "app.exe", 200.0)], 1000.0, static)
        child = next(r for r in rows if r["pid"] == 50)
        self.assertEqual(child["parent_alive"], 0)
        self.assertEqual(child["parent_name"], "")

    def test_missing_parent_is_marked_not_alive(self):
        rows = self.tracker.update([proc(50, "app.exe", 200.0, ppid=999)], 1000.0, static)
        self.assertEqual(rows[0]["parent_alive"], 0)

    def test_self_parented_process(self):
        rows = self.tracker.update([proc(0, "System Idle Process", 0.0, ppid=0)], 1000.0, static)
        self.assertEqual(rows[0]["parent_alive"], 0)
        self.assertEqual(rows[0]["lifetime_s"], "")

    def test_excluded_pid_is_never_logged(self):
        tracker = ProcessTracker(exclude_pids={50})
        rows = tracker.update([self.parent, proc(50, "python.exe", 200.0)], 1000.0, static)
        self.assertEqual([r["pid"] for r in rows], [1])

    def test_stats_rows_follow_stats_interval(self):
        snap = [self.parent, proc(50, "app.exe", 200.0, cpu=3.0)]
        self.assertEqual(events(self.tracker.update(snap, 1000.0, static), "STATS"), [])
        self.assertEqual(events(self.tracker.update(snap, 1004.0, static), "STATS"), [])
        stats = events(self.tracker.update(snap, 1010.0, static), "STATS")
        self.assertEqual(len(stats), 2)
        app = next(r for r in stats if r["pid"] == 50)
        self.assertEqual(app["cpu_percent"], 3.0)
        self.assertEqual(app["cmdline"], "")

    def test_finish_emits_end_for_running_processes(self):
        self.tracker.update([self.parent, proc(50, "app.exe", 200.0)], 1000.0, static)
        rows = self.tracker.finish(1001.0)
        self.assertEqual(sorted(r["pid"] for r in events(rows, "END")), [1, 50])
        self.assertEqual(self.tracker.runs, {})


class TestDailyCsvWriter(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.writer = DailyCsvWriter(self.dir)
        self.row = dict.fromkeys(FIELDS, "")

    def tearDown(self):
        self.writer.close()
        shutil.rmtree(self.dir, ignore_errors=True)

    def read(self, path):
        with open(path, newline="", encoding="utf-8") as f:
            return list(csv.reader(f))

    def test_header_written_once_and_appends(self):
        now = datetime(2026, 10, 1, 12, 0).timestamp()
        self.writer.write([self.row], now)
        self.writer.close()
        self.writer.write([self.row], now)
        self.writer.close()
        lines = self.read(os.path.join(self.dir, "process_events_2026-10-01.csv"))
        self.assertEqual(lines[0], FIELDS)
        self.assertEqual(len(lines), 3)

    def test_rotates_to_new_file_each_day(self):
        self.writer.write([self.row], datetime(2026, 10, 1, 23, 59).timestamp())
        self.writer.write([self.row], datetime(2026, 10, 2, 0, 1).timestamp())
        self.writer.close()
        self.assertEqual(sorted(os.listdir(self.dir)), ["process_events_2026-10-01.csv", "process_events_2026-10-02.csv"])


class TestLiveScan(unittest.TestCase):

    def test_scan_returns_this_process(self):
        samples = scan()
        me = next(s for s in samples if s["pid"] == os.getpid())
        self.assertGreater(me["create_time"], 0)
        self.assertTrue(me["name"])

    def test_read_static_returns_exe_and_cmdline(self):
        exe, cmdline = read_static(os.getpid())
        self.assertTrue(exe.lower().endswith(".exe"))
        self.assertIn("python", cmdline.lower())


if __name__ == "__main__":
    unittest.main()
