"""
Minimal offline message queue for desktop testing.
"""

import json
from pathlib import Path
from typing import Dict, Any, List

import config


REQUIRED_FIELDS = {"type", "timestamp"}


def validate_message(msg: Dict[str, Any]) -> None:
    missing = REQUIRED_FIELDS - set(msg.keys())
    if missing:
        raise ValueError(f"Missing required fields: {missing}")


def enqueue(msg: Dict[str, Any]) -> None:
    validate_message(msg)
    path = Path(config.OFFLINE_QUEUE_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(msg) + "\n")


def tail_events(limit: int = 10) -> List[Dict[str, Any]]:
    path = Path(config.OFFLINE_QUEUE_PATH)
    if not path.exists():
        return []
    events = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return events[-limit:]
