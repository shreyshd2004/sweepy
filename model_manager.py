"""
Utility to load the most robust available model.
"""

from pathlib import Path
from typing import Tuple, Any

import joblib

import config


def load_best_model() -> Tuple[Any, Path]:
    for candidate in config.MODEL_CANDIDATES:
        path = Path(config.MODEL_DIR) / candidate
        if path.exists():
            model = joblib.load(path)
            return model, path
    raise FileNotFoundError(f"no model found in {config.MODEL_CANDIDATES}")


def predict_with_confidence(model, X):
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)
        preds = model.predict(X)
        conf = float(probs.max())
        return preds, conf
    preds = model.predict(X)
    return preds, 1.0
