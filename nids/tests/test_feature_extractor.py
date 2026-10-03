"""
Tests for the NIDS feature bridge (nids/feature_extractor.py).
Run from repo root:  python -m pytest nids/tests -q

Import-safe: these exercise the pure helpers with an explicit feature list, so
no model file or data CSV is loaded.
"""
import unittest

from nids.feature_extractor import normalize_keys, to_cic_raw_features

FEATURES = ["Flow Duration", "Tot Fwd Pkts", "SYN Flag Cnt", "Protocol"]


class TestNormalizeKeys(unittest.TestCase):

    def test_aliases_mapped(self):
        out = normalize_keys({"flow_duration": 10, "tot_fwd_pkts": 3})
        self.assertEqual(out["Flow Duration"], 10)
        self.assertEqual(out["Tot Fwd Pkts"], 3)

    def test_excluded_columns_dropped(self):
        out = normalize_keys({"Dst Port": 443, "dst_port": 443, "Label": "Benign", "Protocol": 6})
        self.assertNotIn("Dst Port", out)
        self.assertNotIn("dst_port", out)
        self.assertNotIn("Label", out)
        self.assertEqual(out["Protocol"], 6)


class TestToCicRawFeatures(unittest.TestCase):

    def test_fills_missing_with_zero_in_order(self):
        raw = to_cic_raw_features({"flow_duration": 5}, feature_names=FEATURES)
        self.assertEqual(list(raw.keys()), FEATURES)
        self.assertEqual(raw["Flow Duration"], 5.0)
        self.assertEqual(raw["Tot Fwd Pkts"], 0.0)

    def test_non_numeric_and_inf_become_zero(self):
        raw = to_cic_raw_features(
            {"Flow Duration": "oops", "Tot Fwd Pkts": float("inf")}, feature_names=FEATURES
        )
        self.assertEqual(raw["Flow Duration"], 0.0)
        self.assertEqual(raw["Tot Fwd Pkts"], 0.0)

    def test_values_are_floats(self):
        raw = to_cic_raw_features({"Protocol": 6}, feature_names=FEATURES)
        self.assertTrue(all(isinstance(v, float) for v in raw.values()))


if __name__ == "__main__":
    unittest.main()
