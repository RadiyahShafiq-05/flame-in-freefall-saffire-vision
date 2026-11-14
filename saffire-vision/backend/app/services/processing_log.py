"""Append-only log of preprocessing and distortion runs.

Detection history stays in its own file so the dashboard can keep reading
{image_id, success, pattern, num_corners, message}.
"""
import json
from datetime import datetime, timezone
from ..config import METADATA

PATH = METADATA / "processing_log.json"

def read() -> list:
    if not PATH.is_file():
        return []
    return json.loads(PATH.read_text(encoding="utf-8"))

def append(entry: dict) -> None:
    items = read()
    stored = dict(entry)
    stored["timestamp"] = datetime.now(timezone.utc).isoformat()
    items.append(stored)
    PATH.parent.mkdir(parents=True, exist_ok=True)
    PATH.write_text(json.dumps(items[-200:], indent=2), encoding="utf-8")
