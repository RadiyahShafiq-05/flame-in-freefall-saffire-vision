from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
METADATA = ROOT / "data" / "metadata"
OUT_DETECTED = ROOT / "outputs" / "detected"
OUT_UNDISTORTED = ROOT / "outputs" / "undistorted"
OUT_REPORTS = ROOT / "outputs" / "reports"
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}
MAX_UPLOAD_MB = 50
MIN_CALIBRATION_VIEWS = 10  # configurable per request; a common practical minimum, not a NASA value
DATASET_SOURCE = "NASA SAFFIRE-1 F1C1 distortion grids (source metadata not bundled; cite NASA Physical Sciences Informatics)"
for d in (RAW, PROCESSED, METADATA, OUT_DETECTED, OUT_UNDISTORTED, OUT_REPORTS):
    d.mkdir(parents=True, exist_ok=True)

import os
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
