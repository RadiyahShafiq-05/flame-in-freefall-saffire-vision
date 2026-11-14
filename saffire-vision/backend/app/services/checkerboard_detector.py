"""Checkerboard detection. Pattern size is always supplied by the caller."""
import cv2
import numpy as np
from .preprocessing import to_gray

_CRITERIA = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)

def _refine(gray, corners):
    """Sub-pixel refinement. If the window would leave the image, keep the detected corners."""
    try:
        return cv2.cornerSubPix(gray, np.float32(corners), (11, 11), (-1, -1), _CRITERIA)
    except cv2.error:
        return np.float32(corners)

def _sb(gray, pattern, flags):
    try:
        ok, corners = cv2.findChessboardCornersSB(gray, pattern, flags)
    except cv2.error:
        return None
    return corners if ok else None

def detect(img, cols: int, rows: int, use_sb: bool = True) -> dict:
    """Find an exact cols-by-rows inner-corner pattern.

    OpenCV must see the whole requested pattern. A grid that continues past the
    frame will not match a pattern larger than the visible interior. Failure
    returns an empty corner list; coordinates are never filled in.
    """
    gray = to_gray(img)
    pattern = (int(cols), int(rows))
    corners, method = None, None
    if use_sb:
        corners = _sb(gray, pattern, cv2.CALIB_CB_ACCURACY)
        method = "findChessboardCornersSB+cornerSubPix" if corners is not None else None
        if corners is None:
            corners = _sb(gray, pattern, cv2.CALIB_CB_EXHAUSTIVE | cv2.CALIB_CB_ACCURACY)
            method = "findChessboardCornersSB+exhaustive+cornerSubPix" if corners is not None else None
    if corners is None:
        ok, classic = cv2.findChessboardCorners(
            gray, pattern, cv2.CALIB_CB_ADAPTIVE_THRESH | cv2.CALIB_CB_NORMALIZE_IMAGE)
        if ok:
            corners, method = classic, "findChessboardCorners+cornerSubPix"
    h, w = gray.shape[:2]
    if corners is None:
        return {
            "success": False, "pattern": [cols, rows], "num_corners": 0, "corners": [],
            "image_size": [w, h], "method": None,
            "message": (
                f"Pattern {cols}x{rows} inner corners not found. Possible causes: wrong pattern size, "
                "pattern extends beyond the frame (OpenCV needs the whole board visible), or the image "
                "is not a checkerboard. No coordinates were fabricated."
            ),
        }
    refined = _refine(gray, corners)
    pts = np.asarray(refined, dtype=np.float64).reshape(-1, 2)
    return {
        "success": True, "pattern": [cols, rows], "num_corners": int(len(pts)), "corners": pts.tolist(),
        "image_size": [w, h], "method": method,
        "message": "Detected. Confirm visually that the overlay covers the intended squares. Pattern size was supplied by the caller.",
    }

def draw(img, result: dict):
    """Draw corners on a copy. The input image is not modified."""
    out = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if result.get("success") and result.get("corners"):
        pts = np.array(result["corners"], np.float32).reshape(-1, 1, 2)
        cv2.drawChessboardCorners(out, tuple(result["pattern"]), pts, True)
    return out
