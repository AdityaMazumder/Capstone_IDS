"""
Shim over config.paths, the single source of truth for project paths.

The ml/ training scripts are run from inside ml/ and do `from paths import ...`,
so this module puts the project root on sys.path and re-exports config.paths.
"""
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from config.paths import (  # noqa: E402,F401
    CLEAN_CSV,
    DATA_PROCESSED,
    DATA_RAW,
    MERGED_CLEAN_CSV,
    MODEL_ENCODER,
    MODEL_ENCODER_V2,
    MODEL_FEATURES,
    MODEL_FEATURES_V2,
    MODEL_XGB,
    MODEL_XGB_V2,
    MODELS_DIR,
    RAW_CSV,
    ROOT,
)
