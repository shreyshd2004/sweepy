"""
Inspect engineered features for a few WAV samples and (optionally) run the saved model.
"""

import argparse
from pathlib import Path

import pandas as pd

import config
import feature_extractor as feat
from baseline_cache import get_baseline
from model_manager import load_best_model, predict_with_confidence


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


def derive_label(filename: str):
    low = filename.lower()
    for key, label in LABEL_KEYWORDS:
        if key in low:
            return label
    return None


def build_feature_series(wav_path: Path, baseline: pd.Series):
    samples, sr = feat.load_wav(wav_path, target_sr=config.TARGET_SAMPLE_RATE)
    proc, snr = feat.preprocess_signal(samples, sr)
    freqs, _, mag = feat.compute_spectrum(proc, sr)
    if mag.size == 0:
        raise RuntimeError(f"No spectrum for {wav_path}")

    vector = feat.fft(proc, log_mag=True, thresh=0, precomputed=(freqs, mag))
    if baseline is not None:
        baseline_aligned = baseline.reindex(vector.columns, fill_value=0)
        vector = vector.subtract(baseline_aligned, axis=1)

    extra = feat.spectral_summary(freqs, mag, proc, sr)
    combined = pd.concat([vector.iloc[0], pd.Series(extra)])
    combined = combined.replace([pd.NA, pd.NaT], 0)
    combined = combined.replace([float("inf"), float("-inf")], 0).fillna(0)
    combined.index = combined.index.astype(str)
    return combined, {"snr_db": snr, **extra}


def select_samples(dataset: str, num: int):
    base = config.DATA_AUDIO_DIR / dataset
    candidates = sorted([p for p in base.glob("*.wav") if "control" not in p.name.lower()])
    selected = []
    for wav in candidates:
        if len(selected) >= num:
            break
        if wav.name.lower().startswith("silence"):
            continue
        selected.append(wav)
    return selected


def describe(args):
    baseline = get_baseline(config.DATA_AUDIO_DIR / args.dataset)
    model = None
    model_path = None
    if args.predict:
        model, model_path = load_best_model()

    samples = select_samples(args.dataset, args.num)
    if not samples:
        print("No samples found.")
        return

    for wav in samples:
        features, quality = build_feature_series(wav, baseline)
        label = derive_label(wav.name) or "unknown"
        print(f"\nSample: {wav.name} (expected label: {label})")
        stat_line = ", ".join(
            f"{key}={quality.get(key):.2f}"
            for key in ("spectral_centroid", "spectral_energy", "spectral_entropy")
            if key in quality and isinstance(quality[key], (float, int))
        )
        if stat_line:
            print("  stats:", stat_line)
        print("  snr_db:", quality.get("snr_db"))
        if args.predict and model is not None:
            frame = pd.DataFrame([features])
            preds, conf = predict_with_confidence(model, frame)
            print("  model prediction:", preds[0], f"(conf={conf:.2f})")

    if args.predict and model_path:
        print(f"\nModel file used: {model_path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default="dataset_1", help="Dataset directory to sample.")
    parser.add_argument("--num", type=int, default=3, help="Number of WAVs to describe.")
    parser.add_argument(
        "--predict", action="store_true", help="Run the saved model on each derived feature vector."
    )
    args = parser.parse_args()
    describe(args)


if __name__ == "__main__":
    main()
