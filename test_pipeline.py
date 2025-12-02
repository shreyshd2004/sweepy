import json
import os
from pathlib import Path

import baseline_cache
import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.dummy import DummyClassifier

import backend_client
import config
import device_calibration as calibration
import event_queue
import feature_extractor as feat
import llm_client
import model_manager
import reasoning_engine as reasoning


def test_preprocess_signal_returns_values():
    sr = config.TARGET_SAMPLE_RATE
    t = np.linspace(0, 1, sr, endpoint=False)
    sine = np.sin(2 * np.pi * 1000 * t).astype(np.float32)
    processed, snr = feat.preprocess_signal(sine, sr)
    assert processed.shape == sine.shape
    assert snr > 0


def test_fft_log_magnitude():
    sr = config.TARGET_SAMPLE_RATE
    t = np.linspace(0, 0.1, int(sr * 0.1), endpoint=False)
    x = np.sin(2 * np.pi * 1500 * t).astype(np.float32)
    df = feat.fft(x, log_mag=True, sr=sr)
    assert not df.isnull().values.any()
    assert df.shape[1] > 0


def test_spectral_summary_basic_stats():
    sr = config.TARGET_SAMPLE_RATE
    t = np.linspace(0, 0.2, int(sr * 0.2), endpoint=False)
    x = np.sin(2 * np.pi * 1500 * t).astype(np.float32)
    processed, _ = feat.preprocess_signal(x, sr)
    freqs, _, mag = feat.compute_spectrum(processed, sr)
    stats = feat.spectral_summary(freqs, mag, processed, sr)
    assert "spectral_centroid" in stats
    assert stats["spectral_centroid"] >= 0
    assert "mfcc_mean_0" in stats


def test_calibration_save_load(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "CALIBRATION_DIR", tmp_path)
    payload = {"gain_scale": 0.8, "sample_rate": config.TARGET_SAMPLE_RATE}
    path = calibration.save_calibration("test-device", payload)
    assert path.exists()
    loaded = calibration.load_calibration("test-device")
    assert loaded == payload


def test_event_queue_roundtrip(monkeypatch, tmp_path):
    path = tmp_path / "queue.jsonl"
    monkeypatch.setattr(config, "OFFLINE_QUEUE_PATH", path)
    event = {"type": "prediction", "timestamp": 1.0, "prediction": "glass"}
    event_queue.enqueue(event)
    assert event in event_queue.tail_events(5)


def test_backend_client_fallback(monkeypatch):
    seen = []

    def fake_enqueue(msg):
        seen.append(msg)

    monkeypatch.setattr(event_queue, "enqueue", fake_enqueue)
    client = backend_client.BackendClient(endpoint=None)
    payload = {"type": "prediction", "timestamp": 2.0}
    client.send_event(payload)
    assert seen and seen[0] == payload


def test_model_manager_load_best(monkeypatch, tmp_path):
    model = DummyClassifier(strategy="most_frequent")
    data = np.array([[0], [1]])
    target = np.array([0, 0])
    model.fit(data, target)
    candidate = tmp_path / "test_model.joblib"
    joblib.dump(model, candidate)
    monkeypatch.setattr(config, "MODEL_CANDIDATES", ["test_model.joblib"])
    monkeypatch.setattr(config, "MODEL_DIR", tmp_path)
    loaded, path = model_manager.load_best_model()
    assert isinstance(path, Path)
    assert path.name == "test_model.joblib"
    preds, conf = model_manager.predict_with_confidence(loaded, data)
    assert preds.shape[0] == data.shape[0]
    assert conf == 1.0


def test_baseline_cache_populates(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "LEGACY_SUMMARY_DIR", config.BASE_DIR / "data")
    monkeypatch.setattr(config, "BASELINE_CACHE_DIR", tmp_path / "cache")
    baseline = baseline_cache.get_baseline(config.DATA_AUDIO_DIR / "dataset_1")
    assert isinstance(baseline, pd.Series)
    assert (tmp_path / "cache" / "dataset_1_baseline.joblib").exists()


def test_reasoning_low_snr():
    message = reasoning.build_reasoning("metal", 0.9, {"snr_db": 2.0, "calibrated": False})
    assert "noisy" in message.lower()


def test_llm_client_prompt_building(monkeypatch):
    sample_events = [
        {"type": "prediction", "timestamp": 1.0, "prediction": "metal", "confidence": 0.8, "snr_db": 12.0}
    ]
    monkeypatch.setattr(event_queue, "tail_events", lambda limit: sample_events)
    client = llm_client.LLMClient(endpoint=None, api_key=None)
    response = client.ask("What should the user do?")
    assert "LLM disabled" in response["text"]
    assert "Recent classifications" in response["prompt"]
