"""
Lightweight LLM integration scaffolding intended for Perplexity Pro (or similar).
This module formats recent classification events into a prompt and optionally
POSTs to the configured endpoint, falling back to a local explanation when credentials
or connectivity are unavailable.
"""

import json
import os
from typing import Dict, Any, List, Optional

import requests

import config
import event_queue


STAT_FIELDS = (
    "spectral_centroid",
    "spectral_energy",
    "spectral_entropy",
    "spectral_rolloff",
    "spectral_flux",
    "zero_crossing_rate",
    "spectral_bandwidth",
)


def normalize_event(event: Dict[str, Any]) -> Dict[str, Any]:
    normalized = {
        "prediction": event.get("prediction"),
        "confidence": event.get("confidence"),
        "snr_db": event.get("snr_db"),
        "device_id": event.get("device_id"),
        "timestamp": event.get("timestamp"),
    }
    for key in STAT_FIELDS:
        value = event.get(key)
        if value is not None:
            normalized[key] = value
    return normalized


def build_prompt(events: List[Dict[str, Any]], question: str, system_prompt: str) -> str:
    lines = [system_prompt, "", "Recent classifications:"]
    if not events:
        lines.append("- None recorded yet")
    for evt in events:
        normalized = normalize_event(evt)
        conf = normalized.get("confidence")
        snr = normalized.get("snr_db")
        device = normalized.get("device_id") or "unknown"
        conf_str = f"{conf:.2f}" if isinstance(conf, (int, float)) else "n/a"
        snr_str = f"{snr:.1f}" if isinstance(snr, (int, float)) else "n/a"
        stat_vals = []
        for key in STAT_FIELDS:
            val = normalized.get(key)
            if isinstance(val, (int, float)):
                stat_vals.append(f"{key.replace('_', ' ')}={val:.1f}")
        stat_text = f" | {'; '.join(stat_vals[:3])}" if stat_vals else ""
        lines.append(
            f"- {normalized.get('prediction') or 'unknown'} (conf={conf_str}, "
            f"SNR={snr_str} dB, device={device}){stat_text}"
        )
    lines.append("")
    lines.append(f"Question: {question}")
    lines.append("Answer succinctly, mention confidence and any advice.")
    return "\n".join(lines)


class LLMClient:
    def __init__(
        self,
        endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = config.LLM_TIMEOUT,
    ):
        self.endpoint = endpoint or config.LLM_ENDPOINT
        self.api_key = api_key or os.environ.get(config.LLM_API_KEY_ENV)
        self.timeout = timeout
        self.system_prompt = config.LLM_SYSTEM_PROMPT

    def ask(self, question: str, events: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        events = events or event_queue.tail_events(config.LLM_CONTEXT_SIZE)
        prompt = build_prompt(events, question, self.system_prompt)
        if not self.endpoint or not self.api_key:
            return {"text": "LLM disabled (endpoint or API key missing).", "prompt": prompt}

        payload = {"query": prompt}
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        try:
            resp = requests.post(self.endpoint, json=payload, headers=headers, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            text = (
                data.get("answer")
                or data.get("response")
                or data.get("text")
                or data.get("output")
                or json.dumps(data)
            )
            return {"text": text, "prompt": prompt, "raw": data}
        except Exception as exc:
            return {
                "text": f"LLM request failed: {exc}",
                "prompt": prompt,
                "raw": {},
            }
