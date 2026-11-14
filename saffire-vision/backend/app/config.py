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
# Filenames from the SAFFIRE-1 F1C1 distortion-grid release. Presence is checked; pixels are never invented.
EXPECTED_RAW_FILES = (
    "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg",
    "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg",
    "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg",
    "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_mono.jpg",
)
for d in (RAW, PROCESSED, METADATA, OUT_DETECTED, OUT_UNDISTORTED, OUT_REPORTS):
    d.mkdir(parents=True, exist_ok=True)

import os
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
