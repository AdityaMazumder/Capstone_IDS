"""
Tests for the shared path config (config/paths.py via ml/paths.py shim).
Run from repo root:  python -m pytest ml/tests -q

Guards the frozen-model wiring: these artefact files must exist for NIDS/SOAR.
"""
import unittest
from pathlib import Path

from ml import paths


class TestPaths(unittest.TestCase):

    def test_shim_reexports_config(self):
        from config import paths as cfg

        self.assertEqual(paths.MODEL_XGB, cfg.MODEL_XGB)
        self.assertEqual(paths.ROOT, cfg.ROOT)

    def test_frozen_model_artifacts_exist(self):
        for artefact in (paths.MODEL_XGB, paths.MODEL_ENCODER, paths.MODEL_FEATURES):
            self.assertTrue(Path(artefact).is_file(), f"missing model artefact: {artefact}")

    def test_paths_are_under_root(self):
        self.assertTrue(str(paths.MODELS_DIR).startswith(str(paths.ROOT)))


if __name__ == "__main__":
    unittest.main()
