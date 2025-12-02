import numpy as np
from scipy.signal import stft, resample_poly, butter, filtfilt
from scipy.fftpack import dct
import pandas as pd
from scipy.io import wavfile

import config

EPSILON = 1e-9


def load_wav(path, target_sr=None):
    sr, x = wavfile.read(path)
    if x.ndim > 1:
        x = x[:, 0]
    x = to_float32(x)
    if target_sr and sr != target_sr:
        x = resample_audio(x, sr, target_sr)
        sr = target_sr
    return x, sr


def ensure_min_length(x, min_length):
    if len(x) >= min_length or min_length <= 0:
        return x
    pad = min_length - len(x)
    return np.pad(x, (0, pad), mode="reflect")


def compute_spectrum(
    x,
    sr,
    n_fft=None,
    window=None,
    padded=True,
    fmin=None,
    fmax=None,
):
    n_fft = n_fft or config.N_FFT
    window = window or config.WINDOW
    fmin = config.FMIN if fmin is None else fmin
    fmax = config.FMAX if fmax is None else fmax

    x = ensure_min_length(x, n_fft)
    freqs, times, stft_matrix = stft(
        x,
        nfft=n_fft,
        fs=sr,
        window=window,
        padded=padded,
    )
    mag = np.abs(stft_matrix) + EPSILON
    mask = np.logical_and(freqs >= fmin, freqs <= fmax)
    if not mask.any():
        mask = slice(None)
    freqs = freqs[mask]
    mag = mag[mask, :]
    return freqs, times, mag


def fft(
    x,
    n_fft=config.N_FFT,
    sr=config.TARGET_SAMPLE_RATE,
    thresh=1e-5,
    window=config.WINDOW,
    padded=None,
    fmin=config.FMIN,
    fmax=config.FMAX,
    log_mag=False,
    precomputed=None,
):
    if precomputed is None:
        freqs, _, mag = compute_spectrum(
            x, sr, n_fft=n_fft, window=window, padded=padded, fmin=fmin, fmax=fmax
        )
    else:
        freqs, mag = precomputed

    if log_mag:
        mag = np.log10(mag)

    avg = avg_thresh(mag, thresh=thresh)
    freqs_int = freqs.astype(np.int32)
    df = pd.DataFrame(columns=freqs_int)
    df.loc[0] = avg
    return df


def avg_thresh(fft, thresh=0.0001):
    fft = fft.copy()
    fft[fft < thresh] = np.nan
    valid = ~np.isnan(fft)
    counts = np.sum(valid, axis=1)
    sums = np.nansum(fft, axis=1)
    result = np.zeros_like(sums)
    mask = counts > 0
    result[mask] = sums[mask] / counts[mask]
    return result


def to_float32(x):
    if np.issubdtype(x.dtype, np.integer):
        max_val = np.iinfo(x.dtype).max
        x = x.astype(np.float32) / max_val
    else:
        x = x.astype(np.float32)
    return x


def resample_audio(x, sr, target_sr):
    gcd = np.gcd(sr, target_sr)
    up = target_sr // gcd
    down = sr // gcd
    return resample_poly(x, up, down)


def highpass_dc(x, sr, cutoff=20.0):
    b, a = butter(2, cutoff / (0.5 * sr), btype="highpass")
    return filtfilt(b, a, x)


def rms_db(x, eps=1e-9):
    rms = np.sqrt(np.mean(np.square(x)) + eps)
    return 20.0 * np.log10(rms + eps)


def noise_floor_db(x):
    mad = np.median(np.abs(x - np.median(x)))
    return 20.0 * np.log10(mad + 1e-9)


def estimate_snr_db(x):
    avg = rms_db(x)
    noise = noise_floor_db(x)
    return avg - noise


def preprocess_signal(x, sr):
    x = to_float32(x)
    x = highpass_dc(x, sr)
    snr = estimate_snr_db(x)
    return x, snr


def apply_calibration(x, calibration):
    if not calibration:
        return x
    gain = calibration.get("gain_scale", 1.0)
    return x * gain


def freq_to_mel(freq):
    return 2595.0 * np.log10(1.0 + freq / 700.0)


def mel_to_freq(mel):
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def build_mel_filterbank(freqs, n_mels=24, fmin=None, fmax=None):
    if freqs.size == 0:
        return np.zeros((n_mels, 0))
    fmin = freqs[0] if fmin is None else fmin
    fmax = freqs[-1] if fmax is None else fmax
    mel_min = freq_to_mel(fmin)
    mel_max = freq_to_mel(fmax)
    mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
    hz_points = mel_to_freq(mel_points)

    filter_bank = np.zeros((n_mels, freqs.size))
    for i in range(n_mels):
        left = hz_points[i]
        center = hz_points[i + 1]
        right = hz_points[i + 2]
        if center <= left or right <= center:
            continue
        left_mask = np.logical_and(freqs >= left, freqs <= center)
        right_mask = np.logical_and(freqs >= center, freqs <= right)
        if np.any(left_mask):
            filter_bank[i, left_mask] = (freqs[left_mask] - left) / (center - left)
        if np.any(right_mask):
            filter_bank[i, right_mask] = (right - freqs[right_mask]) / (right - center)
    return filter_bank


def zero_crossing_rate(x):
    if len(x) < 2:
        return 0.0
    signs = np.sign(x)
    crossings = np.sum(np.abs(np.diff(signs))) / 2
    return crossings / max(len(x) - 1, 1)


def spectral_summary(
    freqs,
    mag,
    x,
    sr,
    n_mels=24,
    n_mfcc=6,
    rolloff_pct=0.85,
):
    features = {}
    if freqs.size == 0 or mag.size == 0:
        features.update(
            {
                "spectral_centroid": 0.0,
                "spectral_bandwidth": 0.0,
                "spectral_rolloff": 0.0,
                "spectral_flatness": 0.0,
                "spectral_flux": 0.0,
                "spectral_energy": 0.0,
            }
        )
        return features

    mean_mag = mag.mean(axis=1) if mag.shape[1] > 0 else np.zeros_like(freqs)
    energy = mean_mag.sum()
    features["spectral_energy"] = energy
    features["spectral_energy_std"] = mean_mag.std()

    if energy > 0:
        centroid = np.sum(freqs * mean_mag) / energy
    else:
        centroid = 0.0
    features["spectral_centroid"] = centroid

    bandwidth = np.sqrt(np.sum((freqs - centroid) ** 2 * mean_mag) / (energy + EPSILON))
    features["spectral_bandwidth"] = bandwidth

    cumsum = np.cumsum(mean_mag)
    rolloff_level = rolloff_pct * energy
    idx = np.searchsorted(cumsum, rolloff_level)
    if idx >= len(freqs):
        rolloff_freq = freqs[-1]
    else:
        rolloff_freq = freqs[idx]
    features["spectral_rolloff"] = rolloff_freq

    arith = np.mean(mean_mag + EPSILON)
    geom = np.exp(np.mean(np.log(mean_mag + EPSILON)))
    features["spectral_flatness"] = geom / (arith + EPSILON)

    if mag.shape[1] > 1:
        diff = np.diff(mag, axis=1)
        flux = np.mean(np.sqrt(np.sum(diff ** 2, axis=0)))
    else:
        flux = 0.0
    features["spectral_flux"] = flux

    entropy_prob = mean_mag / (energy + EPSILON)
    entropy = -np.sum(entropy_prob * np.log2(entropy_prob + EPSILON))
    features["spectral_entropy"] = entropy

    mel_filters = build_mel_filterbank(freqs, n_mels=n_mels, fmin=freqs[0], fmax=freqs[-1])
    if mel_filters.size:
        mel_energy = mel_filters.dot(mag + EPSILON)
        mel_mean = np.mean(mel_energy, axis=1)
        mel_std = np.std(mel_energy, axis=1)
        features["mel_mean"] = np.mean(mel_mean)
        features["mel_std"] = np.mean(mel_std)
        log_mel = np.log10(mel_energy + EPSILON)
        mfcc = dct(log_mel, type=2, axis=0, norm="ortho")
        mfcc = mfcc[: min(n_mfcc, mfcc.shape[0]), :]
        mfcc_mean = np.mean(mfcc, axis=1)
        mfcc_std = np.std(mfcc, axis=1)
        for idx, coef in enumerate(mfcc_mean):
            features[f"mfcc_mean_{idx}"] = coef
        for idx, coef in enumerate(mfcc_std):
            features[f"mfcc_std_{idx}"] = coef
    else:
        for idx in range(n_mfcc):
            features[f"mfcc_mean_{idx}"] = 0.0
            features[f"mfcc_std_{idx}"] = 0.0

    features["snr_db"] = estimate_snr_db(x)
    features["noise_floor_db"] = noise_floor_db(x)
    features["rms_db"] = rms_db(x)
    features["zero_crossing_rate"] = zero_crossing_rate(x)
    features["peak_db"] = 20.0 * np.log10(np.max(np.abs(x)) + EPSILON)
    features["crest_factor"] = (
        (np.max(np.abs(x)) + EPSILON) / (np.sqrt(np.mean(np.square(x))) + EPSILON)
    )
    features["duration_s"] = len(x) / sr
    return features
