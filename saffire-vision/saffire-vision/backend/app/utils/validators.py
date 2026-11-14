from pathlib import Path
from fastapi import HTTPException
from ..config import ALLOWED_EXT, MAX_UPLOAD_MB
def validate_upload(filename: str, size: int):
    if Path(filename).suffix.lower() not in ALLOWED_EXT:
        raise HTTPException(415, f"Unsupported format. Allowed: {sorted(ALLOWED_EXT)}")
    if size > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB")
    if size == 0:
        raise HTTPException(400, "Empty file")
