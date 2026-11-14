import json, cv2, numpy as np
from datetime import datetime, timezone
from ..config import METADATA
from .checkerboard_detector import detect
CAL_FILE = METADATA / "calibration.json"

def _group_key(name: str) -> str:
    n = name.lower()
    for t in ("_mono", "_color", "-mono", "-color"): n = n.replace(t, "")
    return n

def validate_inputs(items, min_views: int) -> list[str]:
    problems = []
    if len({n for n, _ in items}) != len(items): problems.append("Duplicate image ids supplied.")
    keys = [_group_key(n) for n, _ in items]
    if len(set(keys)) != len(keys):
        problems.append("Color/mono variants of the same scene are not independent views.")
    for n, _ in items:
        if "combined" in n.lower():
            problems.append(f"'{n}' is a combined composite; separate and validate its panels first.")
    if len({im.shape[:2] for _, im in items}) > 1: problems.append("All calibration images must share the same resolution.")
    if len(items) < min_views:
        problems.append(f"{len(items)} view(s) supplied; at least {min_views} independent views required.")
    return problems

def calibrate(items, cols, rows, square_mm, min_views) -> dict:
    status = {"status": "insufficient", "min_views": min_views, "views_supplied": len(items)}
    status["problems"] = validate_inputs(items, min_views)
    if status["problems"]: return _save(status)
    objp = np.zeros((cols * rows, 3), np.float32)
    objp[:, :2] = np.mgrid[0:cols, 0:rows].T.reshape(-1, 2) * (square_mm or 1.0)
    objpts, imgpts, used, failed = [], [], [], []
    for n, im in items:
        r = detect(im, cols, rows)
        if r["success"]:
            objpts.append(objp); imgpts.append(np.array(r["corners"], np.float32).reshape(-1, 1, 2)); used.append(n)
        else: failed.append(n)
    status.update(views_used=used, views_failed=failed)
    if len(used) < min_views:
        status["problems"].append(f"Only {len(used)} views had detectable patterns (need {min_views}).")
        return _save(status)
    h, w = items[0][1].shape[:2]
    rms, K, dist, _, _ = cv2.calibrateCamera(objpts, imgpts, (w, h), None, None)
    status.update(status="valid", image_size=[w, h], rms_reprojection_error_px=float(rms),
                  camera_matrix=K.tolist(), distortion_coefficients=dist.ravel().tolist(),
                  units="mm" if square_mm else "square units (square size not provided)",
                  provenance="calculated by cv2.calibrateCamera from supplied images")
    return _save(status)

def _save(s):
    s["timestamp"] = datetime.now(timezone.utc).isoformat()
    CAL_FILE.write_text(json.dumps(s, indent=2)); return s
def load_status() -> dict:
    return json.loads(CAL_FILE.read_text()) if CAL_FILE.exists() else {"status": "not_run"}
def undistort(img, cal: dict):
    if cal.get("status") != "valid": raise ValueError("No valid calibration model.")
    return cv2.undistort(img, np.array(cal["camera_matrix"]), np.array(cal["distortion_coefficients"]))
