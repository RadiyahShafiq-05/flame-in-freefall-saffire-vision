import cv2, numpy as np
from .preprocessing import to_gray

def detect(img, cols: int, rows: int, use_sb: bool = True) -> dict:
    """Detects an exact (cols x rows) INNER-corner pattern. Returns no coordinates on failure."""
    gray = to_gray(img); pat = (cols, rows)
    corners, method = None, None
    if use_sb:
        try:
            ok, c = cv2.findChessboardCornersSB(gray, pat, cv2.CALIB_CB_EXHAUSTIVE | cv2.CALIB_CB_ACCURACY)
            if ok: corners, method = c, "findChessboardCornersSB"
        except cv2.error: pass
    if corners is None:
        ok, c = cv2.findChessboardCorners(gray, pat, cv2.CALIB_CB_ADAPTIVE_THRESH | cv2.CALIB_CB_NORMALIZE_IMAGE)
        if ok:
            c = cv2.cornerSubPix(gray, c, (11, 11), (-1, -1),
                                 (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001))
            corners, method = c, "findChessboardCorners+cornerSubPix"
    h, w = gray.shape
    if corners is None:
        return {"success": False, "pattern": [cols, rows], "num_corners": 0, "corners": [],
                "image_size": [w, h], "method": None,
                "message": (f"Pattern {cols}x{rows} inner corners not found. Possible causes: wrong pattern size, "
                            "pattern extends beyond the frame (OpenCV needs the whole board visible), or strong "
                            "lens distortion. No coordinates were fabricated.")}
    pts = corners.reshape(-1, 2)
    return {"success": True, "pattern": [cols, rows], "num_corners": int(len(pts)), "corners": pts.tolist(),
            "image_size": [w, h], "method": method,
            "message": "Detected. Verify visually that the pattern covers the intended squares."}

def draw(img, result: dict):
    out = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if result["success"]:
        c = np.array(result["corners"], np.float32).reshape(-1, 1, 2)
        cv2.drawChessboardCorners(out, tuple(result["pattern"]), c, True)
    return out
