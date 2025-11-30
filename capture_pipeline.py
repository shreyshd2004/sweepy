import os
import time

import sounddevice as sd

import backend_client as backend
import config
import device_calibration as calibration
import event_queue as msg
import feature_extractor as spec
import llm_client
import reasoning_engine as reasoning
from model_manager import load_best_model, predict_with_confidence
from scipy.io.wavfile import read

_, PLAYBACK_ARRAY = read(config.PLAYBACK_FILE)


def chirp():
    rec = sd.playrec(
        PLAYBACK_ARRAY, channels=1, blocking=True, samplerate=config.TARGET_SAMPLE_RATE
    )
    return rec[:, 0]


def main():
    model, model_path = load_best_model()
    client = backend.BackendClient()
    device_id = os.environ.get("DEVICE_ID", config.DEVICE_ID_DEFAULT)

    control = chirp()

    print("Press Enter to record sample chirp")
    input()
    sample = chirp()

    sample_proc, sample_snr = spec.preprocess_signal(sample, config.TARGET_SAMPLE_RATE)
    sample_db = spec.rms_db(sample_proc)
    if sample_db < config.SILENCE_DB_THRESHOLD:
        print("Capture too quiet; try again closer to the source.")
        return
    if sample_snr < config.MIN_SNR_DB:
        print("Capture too noisy; try again in a quieter spot.")
        return

    control_proc, _ = spec.preprocess_signal(control, config.TARGET_SAMPLE_RATE)

    calibration_profile = calibration.load_calibration(device_id)
    if calibration_profile:
        sample_proc = spec.apply_calibration(sample_proc, calibration_profile)
        control_proc = spec.apply_calibration(control_proc, calibration_profile)

    control_fft = spec.fft(control_proc, log_mag=True)
    sample_fft = spec.fft(sample_proc, log_mag=True)
    sample_fft = sample_fft - control_fft

    freqs, _, mag = spec.compute_spectrum(sample_proc, config.TARGET_SAMPLE_RATE)
    summary = spec.spectral_summary(freqs, mag, sample_proc, config.TARGET_SAMPLE_RATE)
    preds, confidence = predict_with_confidence(model, sample_fft)
    pred = preds[0]

    quality = {"snr_db": sample_snr, "calibrated": bool(calibration_profile)}
    quality.update(summary)
    print(reasoning.build_reasoning(pred, confidence, quality))

    event = {
        "type": "prediction",
        "timestamp": time.time(),
        "prediction": pred,
        "confidence": confidence,
        "snr_db": sample_snr,
        "device_id": device_id,
        "model_path": str(model_path),
    }
    published_keys = (
        "spectral_centroid",
        "spectral_energy",
        "spectral_entropy",
        "spectral_rolloff",
        "spectral_flux",
        "zero_crossing_rate",
        "spectral_bandwidth",
        "rms_db",
    )
    for key in published_keys:
        if key in summary:
            event[key] = summary[key]
    try:
        client.send_event(event)
    except RuntimeError as exc:
        print(exc)

    context_events = msg.tail_events(max(config.LLM_CONTEXT_SIZE - 1, 1))
    context_events.append(event)
    llm_api = llm_client.LLMClient()
    llm_response = llm_api.ask(config.LLM_DEFAULT_QUESTION, events=context_events)
    print("LLM insight:", llm_response["text"])


if __name__ == "__main__":
    main()
