"""
Inference and the dry-run SOAR bridge.

Nothing here starts a sensor or the stealer simulator. Rows are built in memory
and sent to a temporary SOAR database with host response forced to dry-run.
"""
import os
import tempfile
import unittest

from hids.live import HostBridge
from hids.predict import IsolationForestPredictor, anomaly_score_from_decision

TEMP_EXE = r"C:\Users\Lab\AppData\Local\Temp\svchost_update.exe"
CHROME_EXE = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
LOGIN_DATA = r"C:\Users\Lab\AppData\Local\Google\Chrome\User Data\Default\Login Data"


def exit_row(**kw):
    row = {
        "event": "EXIT",
        "pid": 4242,
        "create_time": 1_700_000_000.125,
        "process_name": "chrome.exe",
        "parent_name": "explorer.exe",
        "exe_path": CHROME_EXE,
        "lifetime_s": 600.0,
        "cpu_mean": 1.2,
        "memory_max_mb": 180.0,
    }
    row.update(kw)
    return row


def file_row(**kw):
    row = {
        "pid": 4242,
        "create_time": 1_700_000_000.125,
        "process_name": "svchost_update.exe",
        "exe_path": TEMP_EXE,
        "parent_name": "cmd.exe",
        "file_path": LOGIN_DATA,
        "file_type": "Saved Passwords DB",
        "event_type": "READ",
        "accessor_is_owner": 0,
        "source": "audit",
    }
    row.update(kw)
    return row


class TestPredictor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.predictor = IsolationForestPredictor()

    def test_uses_the_four_training_features(self):
        self.assertEqual(
            self.predictor.numeric_features,
            ["log_life", "from_user_space", "from_temp_or_downloads", "parent_is_shell"],
        )

    def test_threshold_maps_to_half(self):
        self.assertAlmostEqual(
            anomaly_score_from_decision(self.predictor.threshold, self.predictor.threshold),
            0.5,
        )

    def test_browser_is_normal_and_temp_shell_child_is_stealer(self):
        normal = self.predictor.predict(exit_row())
        stealer = self.predictor.predict(exit_row(
            pid=5252,
            process_name="svchost_update.exe",
            parent_name="cmd.exe",
            exe_path=TEMP_EXE,
            lifetime_s=4.0,
        ))
        self.assertEqual(normal.label, "Normal")
        self.assertFalse(normal.is_anomalous)
        self.assertLess(normal.anomaly_score, 0.5)
        self.assertEqual(stealer.label, "Stealer")
        self.assertTrue(stealer.is_anomalous)
        self.assertGreater(stealer.anomaly_score, 0.5)
        self.assertLess(stealer.decision_score, stealer.threshold)


class TestHostBridge(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.bridge = HostBridge(
            predictor=TestPredictor.predictor if hasattr(TestPredictor, "predictor") else IsolationForestPredictor(),
            dry_run=True,
            db_path=os.path.join(self.tmp, "sentinel.db"),
        )

    def tearDown(self):
        self.bridge.close()

    def test_owner_read_is_not_sent(self):
        incidents = self.bridge.on_file_rows([file_row(
            process_name="chrome.exe", exe_path=CHROME_EXE, parent_name="explorer.exe",
            accessor_is_owner=1,
        )])
        self.assertEqual(incidents, [])

    def test_non_owner_read_alerts_immediately_in_dry_run(self):
        incidents = self.bridge.on_file_rows([file_row(), file_row()])
        self.assertEqual(len(incidents), 1)
        incident = incidents[0]
        self.assertEqual(incident.classification, "Stealer")
        self.assertIn("Dry-Run", incident.action_status)
        self.assertEqual(incident.soar_action.value, "TERMINATE_PROCESS")

    def test_anomalous_exit_carries_model_scores_and_the_file(self):
        self.bridge.on_file_rows([file_row()])
        run = exit_row(
            process_name="svchost_update.exe",
            parent_name="cmd.exe",
            exe_path=TEMP_EXE,
            lifetime_s=4.0,
        )
        incidents = self.bridge.on_process_rows([run])
        self.assertEqual(len(incidents), 1)
        incident = incidents[0]
        self.assertEqual(incident.classification, "Stealer")
        self.assertGreater(incident.anomaly_score, 0.5)
        self.assertEqual(incident.file_event.file_path, LOGIN_DATA)
        self.assertIn("Dry-Run", incident.action_status)
        self.assertIn("hids_isolation_forest", incident.raw_event.get("source", ""))

    def test_normal_exit_is_not_sent(self):
        self.assertEqual(self.bridge.on_process_rows([exit_row()]), [])
