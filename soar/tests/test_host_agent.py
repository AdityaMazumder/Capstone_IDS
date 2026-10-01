"""
SentinelAI - Unit & Integration Tests for HostSOARAgent (Capstone_IDS/soar)
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.host_agent import HostSOARAgent
from core.schemas import HostActionType, SeverityLevel


class TestHostSOARAgent(unittest.TestCase):
    """Test suite for Phase 5 HIDS Host SOAR Agent in Capstone_IDS/soar."""

    def setUp(self):
        self.agent = HostSOARAgent(dry_run=True)
        self.agent.initialize()

    def tearDown(self):
        self.agent.shutdown()

    def test_normal_browser_activity_logged_only(self):
        """Verify legitimate Chrome reading Cookies is classified Normal and LOG_ONLY."""
        event = {
            "pid": 11240,
            "process_name": "chrome.exe",
            "parent_name": "explorer.exe",
            "cpu_percent": 2.5,
            "memory_mb": 250.0,
            "file_path": "C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Network\\Cookies",
            "file_type": "CookieDB",
            "event_type": "READ",
            "label": "Normal"
        }
        incident = self.agent.process_host_event(event)
        self.assertEqual(incident.classification, "Normal")
        self.assertEqual(incident.soar_action, HostActionType.LOG_ONLY)
        self.assertEqual(incident.severity, SeverityLevel.LOW)
        self.assertTrue(incident.risk_score < 4.0)

    def test_infostealer_detection_and_process_termination(self):
        """Verify unauthorized python.exe reading Chrome Cookies triggers Stealer and TERMINATE_PROCESS."""
        event = {
            "pid": 5892,
            "process_name": "python.exe",
            "parent_name": "cmd.exe",
            "cpu_percent": 8.1,
            "memory_mb": 72.0,
            "file_path": "C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Network\\Cookies",
            "file_type": "CookieDB",
            "event_type": "READ",
            "label": "Stealer"
        }
        incident = self.agent.process_host_event(event)
        self.assertEqual(incident.classification, "Stealer")
        self.assertEqual(incident.soar_action, HostActionType.TERMINATE_PROCESS)
        self.assertIn("SIMULATED", incident.action_status)
        self.assertIn("5892", incident.action_status)
        self.assertEqual(incident.mitre_technique_id, "T1539")
        self.assertEqual(incident.mitre_technique_name, "Steal Web Session Cookie")
        self.assertEqual(incident.severity, SeverityLevel.CRITICAL)
        self.assertTrue(incident.risk_score >= 8.5)

    def test_local_state_master_key_theft(self):
        """Verify PowerShell accessing Local State triggers Credentials from Web Browsers (T1555.003)."""
        event = {
            "pid": 9410,
            "process_name": "powershell.exe",
            "parent_name": "cmd.exe",
            "cpu_percent": 12.0,
            "memory_mb": 85.0,
            "file_path": "C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Local State",
            "file_type": "LocalState (Master Key)",
            "event_type": "READ"
        }
        incident = self.agent.process_host_event(event)
        self.assertEqual(incident.classification, "Stealer")
        self.assertEqual(incident.mitre_technique_id, "T1555.003")
        self.assertEqual(incident.soar_action, HostActionType.TERMINATE_PROCESS)


if __name__ == "__main__":
    unittest.main()
