"""
Lightweight configuration for desktop testing of the audio pipeline.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Audio defaults
TARGET_SAMPLE_RATE = 44100
N_FFT = 32768
FMIN = 1000
FMAX = 20000
HOP_LENGTH = 1024
WINDOW = "hann"

# Dataset roots
DATA_ROOT = BASE_DIR / "datasets"
DATA_AUDIO_DIR = DATA_ROOT / "raw"
DATA_FEATURE_DIR = DATA_ROOT / "processed"
LEGACY_SUMMARY_DIR = DATA_FEATURE_DIR
BASELINE_CACHE_DIR = BASE_DIR / "cache" / "baseline"

# Quality thresholds
SILENCE_DB_THRESHOLD = -45.0  # reject if average level below this
MIN_SNR_DB = 8.0              # reject if SNR below this

# Paths
PLAYBACK_FILE = BASE_DIR / "playback" / "audiocheck.net_sweep_10Hz_22000Hz_-3dBFS_1s_nm.wav"

# Message queue (no network for desktop)
OFFLINE_QUEUE_PATH = BASE_DIR / "message_queue.jsonl"

# Model candidates (tries in order)
MODEL_CANDIDATES = ["robust_model.joblib", "combined_all_model.joblib"]
MODEL_DIR = BASE_DIR

# Calibration storage
CALIBRATION_DIR = BASE_DIR / "calibration"
DEVICE_ID_DEFAULT = "desktop_default"

# Backend stub
BACKEND_ENDPOINT = None
BACKEND_TIMEOUT = 5

# LLM integration (Perplexity Pro)
LLM_ENDPOINT = os.environ.get("PERPLEXITY_PRO_ENDPOINT")
LLM_API_KEY_ENV = "PERPLEXITY_PRO_API_KEY"
LLM_TIMEOUT = 10
LLM_CONTEXT_SIZE = 6
LLM_SYSTEM_PROMPT = (
    "You summarize short acoustic classifiers and offer advice for a mobile sustainability app."
)
LLM_DEFAULT_QUESTION = (
    "Explain the material classification and suggest whether a user should retry or accept it."
)
