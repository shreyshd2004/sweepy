"""
Basic backend client stub.
"""

import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

import config
import event_queue


class BackendClient:
    def __init__(self, endpoint: Optional[str] = None, timeout: int = config.BACKEND_TIMEOUT):
        self.endpoint = endpoint or config.BACKEND_ENDPOINT
        self.timeout = timeout

    def send_event(self, event: Dict[str, Any]) -> None:
        if not self.endpoint:
            event_queue.enqueue(event)
            return
        payload = json.dumps(event).encode("utf-8")
        req = urllib.request.Request(
            self.endpoint,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                if resp.status >= 400:
                    raise urllib.error.HTTPError(
                        req.full_url, resp.status, "server error", resp.headers, None
                    )
        except Exception as exc:
            event_queue.enqueue(event)
            raise RuntimeError(f"failed to POST event: {exc}") from exc
