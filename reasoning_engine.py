"""
Minimal reasoning helper for desktop testing.
"""

from typing import Dict, Any


def build_reasoning(prediction: Any, confidence: float, quality: Dict[str, float]) -> str:
    notes = []
    snr = quality.get("snr_db")
    if snr is not None:
        if snr < 5:
            notes.append("very noisy; try again closer to the surface")
        elif snr < 10:
            notes.append("noisy; result may be unstable")
    if quality.get("calibrated") is False:
        notes.append("no calibration applied")
    energy = quality.get("spectral_energy")
    if energy is not None:
        if energy < 0.05:
            notes.append("low-energy sweep; tap harder or closer")
        elif energy > 0.3:
            notes.append("strong impact energy")
    centroid = quality.get("spectral_centroid")
    if centroid is not None and centroid > 12000:
        notes.append("high-frequency emphasis; metallic or sharp tap likely")
    entropy = quality.get("spectral_entropy")
    if entropy is not None and entropy > 8:
        notes.append("complex frequency mix; double-check the material")

    head = f"Detected {prediction} (conf {confidence:.2f})"
    return head + (". Notes: " + "; ".join(notes) if notes else "")
