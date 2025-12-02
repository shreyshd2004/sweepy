"""
Simple FastAPI inference server for the Sweepy audio model.

Usage (from the project root):

    pip install -r requirements.txt
    uvicorn inference_server:app --reload --port 8000

Then configure the frontend with:

    NEXT_PUBLIC_MODEL_API_URL=http://localhost:8000

The /predict endpoint accepts a JSON body:
{
  "audioBase64": "<base64-encoded WAV>",
  "metadata": { ... optional extra info ... }
}

and returns:
{
  "label": "paper",
  "confidence": 0.92,
  "quality": { ... spectral/quality features ... }
}
"""

from __future__ import annotations

import base64
import io
import tempfile
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel
from scipy.io import wavfile

import config
import feature_extractor as feat
import model_manager


class PredictRequest(BaseModel):
  audioBase64: str
  metadata: Optional[Dict[str, Any]] = None


class PredictResponse(BaseModel):
  label: Optional[str]
  confidence: float
  quality: Dict[str, float]


app = FastAPI(title="Sweepy Audio Model API")


def _decode_wav_from_base64(audio_base64: str) -> bytes:
  try:
    return base64.b64decode(audio_base64)
  except Exception as exc:  # pragma: no cover - defensive
    raise ValueError("Invalid base64 audio payload") from exc


def _extract_features_from_bytes(wav_bytes: bytes) -> Dict[str, Any]:
  """
  Mirror the training pipeline as closely as possible:
  - Load WAV
  - Preprocess / quality checks
  - Compute spectrum
  - Build FFT vector
  - Compute spectral summary features
  """
  # Write to a temporary file so we can reuse load_wav
  with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
    tmp.write(wav_bytes)
    tmp.flush()
    samples, sr = feat.load_wav(tmp.name, target_sr=config.TARGET_SAMPLE_RATE)

  processed, snr = feat.preprocess_signal(samples, sr)
  if snr < config.MIN_SNR_DB:
    raise ValueError(f"Signal-to-noise ratio too low ({snr:.2f} dB)")

  level_db = feat.rms_db(processed)
  if level_db < config.SILENCE_DB_THRESHOLD:
    raise ValueError(f"Signal too quiet ({level_db:.2f} dB)")

  freqs, _, mag = feat.compute_spectrum(processed, sr)
  if mag.size == 0:
    raise ValueError("Empty spectrum from audio")

  # Single FFT vector (log magnitude, no thresholding)
  vector = feat.fft(
    processed,
    log_mag=True,
    thresh=0,
    precomputed=(freqs, mag),
  )

  # Add spectral summary features
  extra = feat.spectral_summary(freqs, mag, processed, sr)
  combined = pd.concat([vector.iloc[0], pd.Series(extra)])
  combined = combined.replace([np.inf, -np.inf], 0).fillna(0)

  # Return as a single-row DataFrame plus extra quality metrics
  X = pd.DataFrame([combined.values], columns=[str(c) for c in combined.index])
  return {"X": X, "quality": extra}


@app.on_event("startup")
def load_model() -> None:
  """
  Load the best available model once at startup.
  """
  global MODEL, MODEL_PATH
  MODEL, MODEL_PATH = model_manager.load_best_model()
  print(f"[inference] Loaded model from {MODEL_PATH}")


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
  """
  Run the audio classifier on a base64-encoded WAV recording.
  """
  try:
    if "MODEL" not in globals():
      load_model()

    wav_bytes = _decode_wav_from_base64(req.audioBase64)
    features = _extract_features_from_bytes(wav_bytes)
    X = features["X"]
    quality = features["quality"]

    preds, conf = model_manager.predict_with_confidence(MODEL, X)
    label = str(preds[0]) if len(preds) else None

    # Attach a few quality metrics we already computed
    quality = {
      "snr_db": float(quality.get("snr_db", 0.0)),
      "spectral_energy": float(quality.get("spectral_energy", 0.0)),
      "spectral_centroid": float(quality.get("spectral_centroid", 0.0)),
      "spectral_entropy": float(quality.get("spectral_entropy", 0.0)),
      "duration_s": float(quality.get("duration_s", 0.0)),
    }

    return PredictResponse(label=label, confidence=float(conf), quality=quality)
  except Exception as exc:
    # For now return a neutral result with confidence 0.0
    # The frontend will treat this as \"no prediction\".
    return PredictResponse(label=None, confidence=0.0, quality={})


if __name__ == "__main__":
  import uvicorn

  uvicorn.run("inference_server:app", host="0.0.0.0", port=8000, reload=True)


