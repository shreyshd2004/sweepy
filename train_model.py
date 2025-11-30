"""
Train a stronger classification pipeline using the restored datasets.
"""

from collections import Counter, defaultdict
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

import config
from baseline_cache import get_baseline
from feature_extractor import (
    compute_spectrum,
    fft,
    load_wav,
    preprocess_signal,
    rms_db,
    spectral_summary,
)


LABEL_KEYWORDS = [
    ("metal", "metal"),
    ("glass", "glass"),
    ("plastic", "plastic"),
    ("cardboard", "paper"),
    ("paper", "paper"),
    ("apple", "organic"),
    ("banana", "organic"),
    ("onion", "organic"),
    ("orange", "organic"),
    ("pear", "organic"),
]


def derive_label(filename: str) -> Optional[str]:
    name = filename.lower()
    for key, label in LABEL_KEYWORDS:
        if key in name:
            return label
    return None



MAX_SAMPLES_PER_LABEL = {
    "metal": 400,
    "plastic": 400,
    "paper": 250,
    "organic": 250,
    "glass": 200,
}


INCLUDED_DATASETS = ["dataset_1", "dataset_2"]


def collect_features() -> pd.DataFrame:
    base = config.DATA_AUDIO_DIR
    rows = []
    freq_index = None
    counts = defaultdict(int)

    for dataset_dir in sorted(base.glob("dataset_*")):
        if dataset_dir.name not in INCLUDED_DATASETS:
            continue

        baseline = get_baseline(dataset_dir)

        for wav in sorted(dataset_dir.glob("*.wav")):
            lower = wav.name.lower()
            if "control" in lower or "silence" in lower:
                continue
            label = derive_label(lower)
            if not label:
                continue

            samples, sr = load_wav(wav, target_sr=config.TARGET_SAMPLE_RATE)
            proc, snr = preprocess_signal(samples, sr)
            if snr < config.MIN_SNR_DB:
                continue
            level_db = rms_db(proc)
            if level_db < config.SILENCE_DB_THRESHOLD:
                continue

            freqs, _, mag = compute_spectrum(proc, sr)
            if mag.size == 0:
                continue

            vector = fft(
                proc,
                log_mag=True,
                thresh=0,
                precomputed=(freqs, mag),
            )
            if baseline is not None:
                baseline_aligned = baseline.reindex(vector.columns, fill_value=0)
                vector = vector.subtract(baseline_aligned, axis=1)

            if counts[label] >= MAX_SAMPLES_PER_LABEL.get(label, 200):
                continue
            counts[label] += 1
            if vector.isnull().any().any():
                continue
            if freq_index is None:
                freq_index = vector.columns
            vector = vector.reindex(columns=freq_index, fill_value=0)
            vector = vector.fillna(0)

            extra = spectral_summary(freqs, mag, proc, sr)
            combined = pd.concat([vector.iloc[0], pd.Series(extra)])
            combined = combined.replace([np.inf, -np.inf], 0).fillna(0)
            rows.append({"features": combined, "label": label})

    if not rows:
        raise RuntimeError("No training examples found.")

    print("Collected training counts:", Counter(counts))

    feature_df = pd.DataFrame([r["features"] for r in rows], index=range(len(rows)))
    feature_df.columns = feature_df.columns.astype(str)
    labels = [r["label"] for r in rows]
    feature_df["label"] = labels
    return feature_df


def main():
    print("Collecting features from audio datasets…")
    df = collect_features()
    X = df.drop(columns="label")
    y = df["label"]

    print("Splitting data…")
    splitter = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y))
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    max_pca_components = min(X_train.shape[1], X_train.shape[0])
    n_components = min(60, max_pca_components)
    if n_components < 1:
        n_components = 1

    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("pca", PCA(n_components=n_components)),
            (
                "hgb",
                HistGradientBoostingClassifier(
                    max_iter=250,
                    random_state=42,
                    early_stopping=True,
                    max_depth=12,
                    learning_rate=0.1,
                    class_weight="balanced",
                ),
            ),
        ]
    )

    print("Training robust model…")
    pipeline.fit(X_train, y_train)

    accuracy = pipeline.score(X_test, y_test)
    print(f"Test accuracy: {accuracy:.3f}")
    print("Classification report:")
    print(classification_report(y_test, pipeline.predict(X_test)))

    target = Path(config.BASE_DIR) / "robust_model.joblib"
    joblib.dump(pipeline, target)
    print(f"Saved robust model to {target}")


if __name__ == "__main__":
    main()
