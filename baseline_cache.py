"""
Helpers for caching dataset baselines (from legacy CSVs or control WAVs).
"""

from pathlib import Path
from typing import Optional

import joblib
import pandas as pd

import config
import feature_extractor as feat


def _cache_path(dataset_name: str) -> Path:
    target = Path(config.BASELINE_CACHE_DIR)
    target.mkdir(parents=True, exist_ok=True)
    return target / f"{dataset_name}_baseline.joblib"


def _load_from_summary(dataset_dir: Path) -> Optional[pd.Series]:
    summary_dir = Path(config.LEGACY_SUMMARY_DIR) / dataset_dir.name
    control_csv = summary_dir / "control.csv"
    mean_csv = summary_dir / "control_mean.csv"
    if not control_csv.exists() or not mean_csv.exists():
        return None

    try:
        freq_df = pd.read_csv(control_csv, header=None, nrows=1)
        freq_series = freq_df.iloc[0].dropna()
        freq_index = freq_series.astype(np.int32)
        mean_df = pd.read_csv(mean_csv, header=None)
        mean_values = mean_df.iloc[:, 0]
    except Exception:
        return None

    min_len = min(len(freq_index), len(mean_values))
    freq_index = freq_index.iloc[:min_len]
    mean_values = mean_values.iloc[:min_len]
    baseline = pd.Series(mean_values.values, index=freq_index.astype(np.int32))
    return baseline


def _compute_from_controls(dataset_dir: Path) -> Optional[pd.Series]:
    frames = []
    for control in sorted(dataset_dir.glob("control*.wav")):
        samples, sr = feat.load_wav(control, target_sr=config.TARGET_SAMPLE_RATE)
        proc, _ = feat.preprocess_signal(samples, sr)
        frames.append(feat.fft(proc, log_mag=True, thresh=0))
    if not frames:
        return None
    baseline = pd.concat(frames).mean()
    return baseline


def get_baseline(dataset_dir: Path) -> Optional[pd.Series]:
    cache_file = _cache_path(dataset_dir.name)
    if cache_file.exists():
        try:
            baseline = joblib.load(cache_file)
            if isinstance(baseline, pd.Series):
                return baseline
        except Exception:
            pass

    baseline = _load_from_summary(dataset_dir)
    if baseline is None:
        baseline = _compute_from_controls(dataset_dir)

    if baseline is not None:
        joblib.dump(baseline, cache_file)
    return baseline
