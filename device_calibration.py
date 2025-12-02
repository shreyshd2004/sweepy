"""
Calibration helpers for measuring per-device gain/noise characteristics.
"""

import argparse
import json
from pathlib import Path
from typing import Optional, Dict, Any

import config
import feature_extractor as feat


def calibration_path(device_id: str) -> Path:
    path = config.CALIBRATION_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path / f"{device_id}.json"


def save_calibration(device_id: str, payload: Dict[str, Any]) -> Path:
    path = calibration_path(device_id)
    with path.open("w") as f:
        json.dump(payload, f, indent=2)
    return path


def load_calibration(device_id: str) -> Optional[Dict[str, Any]]:
    path = calibration_path(device_id)
    if not path.exists():
        return None
    with path.open() as f:
        return json.load(f)


def analyze_waveform(samples, sr):
    processed, snr = feat.preprocess_signal(samples, sr)
    return {
        "snr_db": snr,
        "avg_db": feat.rms_db(processed),
        "noise_floor_db": feat.noise_floor_db(processed),
    }


def main():
    parser = argparse.ArgumentParser(description="Capture a calibration profile.")
    parser.add_argument("device_id", help="Unique device identifier")
    parser.add_argument("--gain", type=float, default=1.0, help="Gain scale to apply")
    parser.add_argument("--sample-rate", type=int, default=config.TARGET_SAMPLE_RATE)
    parser.add_argument("--wave-file", type=str, help="Optional WAV to analyze")
    args = parser.parse_args()

    payload = {
        "gain_scale": args.gain,
        "sample_rate": args.sample_rate,
    }
    if args.wave_file:
        samples, sr = feat.load_wav(args.wave_file, target_sr=args.sample_rate)
        metrics = analyze_waveform(samples, sr)
        payload.update(metrics)
        print("Calibration metrics:", metrics)
    path = save_calibration(args.device_id, payload)
    print(f"Saved calibration profile at {path}")


if __name__ == "__main__":
    main()
