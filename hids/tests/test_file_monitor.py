"""
Tests for the HIDS file sensor (hids/file_monitor.py).
Run from repo root:  python -m unittest hids.tests.test_file_monitor -v
"""

import csv
import os
import shutil
import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from hids.file_monitor import (
    FIELDS,
    FileEventCsvWriter,
    _BrowserFileHandler,
    _PollingWatcher,
    _map_event_type,
    describe_watch_targets,
    path_looks_sensitive,
)


# ---------------------------------------------------------------
# path_looks_sensitive (legacy helper, kept for backward compat)
# ---------------------------------------------------------------

class TestPathLooksSensitive(unittest.TestCase):

    def test_chrome_cookies(self):
        self.assertTrue(
            path_looks_sensitive(
                r"C:\Users\Lab\AppData\Local\Google\Chrome\User Data\Default\Cookies"
            )
        )

    def test_edge_cookies(self):
        self.assertTrue(
            path_looks_sensitive(
                r"C:\Users\Lab\AppData\Local\Microsoft\Edge\User Data\Default\Cookies"
            )
        )

    def test_firefox_cookies(self):
        self.assertTrue(
            path_looks_sensitive(
                r"C:\Users\Lab\AppData\Roaming\Mozilla\Firefox\Profiles\abc.default\cookies.sqlite"
            )
        )

    def test_chrome_local_state(self):
        self.assertTrue(
            path_looks_sensitive(
                r"C:\Users\Lab\AppData\Local\Google\Chrome\User Data\Local State"
            )
        )

    def test_unrelated_path(self):
        self.assertFalse(path_looks_sensitive(r"C:\Windows\System32\notepad.exe"))

    def test_describe_watch_targets(self):
        targets = describe_watch_targets()
        self.assertIsInstance(targets, list)
        self.assertTrue(len(targets) >= 4)


# ---------------------------------------------------------------
# _map_event_type
# ---------------------------------------------------------------

class TestMapEventType(unittest.TestCase):

    def test_created(self):
        self.assertEqual(_map_event_type("created", is_new=True), "CREATE")

    def test_modified(self):
        self.assertEqual(_map_event_type("modified", is_new=False), "MODIFY")

    def test_closed(self):
        self.assertEqual(_map_event_type("closed", is_new=False), "MODIFY")

    def test_other_defaults_to_read(self):
        self.assertEqual(_map_event_type("opened", is_new=False), "READ")


# ---------------------------------------------------------------
# FileEventCsvWriter
# ---------------------------------------------------------------

class TestFileEventCsvWriter(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.writer = FileEventCsvWriter(log_dir=self.dir)

    def tearDown(self):
        self.writer.close()
        shutil.rmtree(self.dir, ignore_errors=True)

    def _read_csv(self):
        path = os.path.join(self.dir, "file_events.csv")
        with open(path, newline="", encoding="utf-8") as f:
            return list(csv.reader(f))

    def test_header_written_once(self):
        row = {
            "timestamp": "2026-10-01T12:00:00.000",
            "process": "chrome.exe",
            "file_path": r"C:\cookies",
            "event_type": "MODIFY",
        }
        self.writer.write([row])
        self.writer.close()
        # Re-open and append
        self.writer.write([row])
        self.writer.close()

        lines = self._read_csv()
        # 1 header + 2 data rows
        self.assertEqual(lines[0], FIELDS)
        self.assertEqual(len(lines), 3)

    def test_empty_write(self):
        self.writer.write([])
        # Should still create the file with a header
        self.assertTrue(os.path.exists(os.path.join(self.dir, "file_events.csv")))


# ---------------------------------------------------------------
# _BrowserFileHandler  (unit-testable without watchdog installed)
# ---------------------------------------------------------------

class TestBrowserFileHandler(unittest.TestCase):

    def setUp(self):
        self.target = Path(r"C:\fake\Cookies")
        self.handler = _BrowserFileHandler([self.target])

    def test_matching_event_is_recorded(self):
        """Simulate a watchdog-style on_modified call."""

        class FakeEvent:
            is_directory = False
            src_path = str(self.target)

        self.handler.on_modified(FakeEvent())
        rows = self.handler.drain()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["event_type"], "MODIFY")
        self.assertEqual(rows[0]["file_path"], str(self.target))

    def test_non_matching_event_is_ignored(self):
        class FakeEvent:
            is_directory = False
            src_path = r"C:\unrelated\file.txt"

        self.handler.on_modified(FakeEvent())
        self.assertEqual(self.handler.drain(), [])

    def test_drain_clears_buffer(self):
        class FakeEvent:
            is_directory = False
            src_path = str(self.target)

        self.handler.on_created(FakeEvent())
        self.assertEqual(len(self.handler.drain()), 1)
        self.assertEqual(self.handler.drain(), [])  # second drain is empty


# ---------------------------------------------------------------
# _PollingWatcher
# ---------------------------------------------------------------

class TestPollingWatcher(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.file = os.path.join(self.dir, "Cookies")
        # Create the target so the watcher seeds its state
        with open(self.file, "w") as f:
            f.write("initial")
        self.watcher = _PollingWatcher([Path(self.file)])

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def test_no_change_no_events(self):
        self.assertEqual(self.watcher.poll(), [])

    def test_modify_detected(self):
        # Ensure mtime actually changes (filesystem resolution can be 1 s)
        time.sleep(0.05)
        with open(self.file, "a") as f:
            f.write("extra")
        # Force mtime bump on NTFS (granularity ~100 ns, but open+write suffices)
        rows = self.watcher.poll()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["event_type"], "MODIFY")

    def test_create_detected_for_new_file(self):
        new_file = os.path.join(self.dir, "LocalState")
        watcher = _PollingWatcher([Path(new_file)])
        # File doesn't exist yet → no seed
        with open(new_file, "w") as f:
            f.write("content")
        rows = watcher.poll()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["event_type"], "CREATE")


if __name__ == "__main__":
    unittest.main()
