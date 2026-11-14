"""Observed grid geometry.

The numbers here are pixel measurements on detected corners. They are not
OpenCV distortion coefficients and they are not a calibrated camera model.
"""
import cv2
import numpy as np

_ASSUMPTIONS = [
    "Pattern size is the caller-supplied inner-corner count, not a value measured from NASA documentation.",
    "The detected corner array is row-major with the caller-supplied column count. Its starting corner is unknown and does not affect the residual (a homography absorbs reflections and flips).",
    "The ideal grid uses unit spacing because the physical square size is not known.",
    "A homography absorbs perspective and global scale. It does not estimate k1, k2, p1, p2, or k3.",
]
def _unit_grid(cols: int, rows: int):
    """Unit-square coordinates in detected-array order (row-major, origin at the first corner).

    OpenCV does not say which board corner comes first. This does not matter for the residual:
    a homography can represent reflections and 180-degree flips, so all four possible labellings
    fit identically (verified on the SAFFIRE-1 images: equal to 6 decimal places).
    """
    cc, rr = np.meshgrid(np.arange(cols, dtype=np.float32), np.arange(rows, dtype=np.float32))
    return np.stack([cc, rr], axis=-1).reshape(-1, 2)

_LIMITATIONS = [
    "One view cannot separate lens distortion, a non-planar board, and corner localisation error.",
    "A pattern smaller than the visible board describes only that region.",
    "Color and monochrome copies are not additional geometry measurements.",
    "Residuals are in pixels. Physical millimetre error is not reported.",
]

def grid_geometry(result: dict) -> dict:
    """Compare detected corners with an ideal planar grid, when detection succeeded."""
    if not result.get("success"):
        return {
            "available": False,
            "reason": result.get("message", "Checkerboard was not detected."),
            "assumptions": list(_ASSUMPTIONS),
            "limitations": list(_LIMITATIONS),
            "note": "No spacing or residual was computed because detection failed.",
        }
    cols, rows = (int(v) for v in result["pattern"])
    pts = np.asarray(result["corners"], dtype=np.float64).reshape(-1, 2)
    if pts.shape != (cols * rows, 2):
        return {
            "available": False,
            "reason": "Corner count does not match the requested pattern, so geometry was not computed.",
            "assumptions": list(_ASSUMPTIONS),
            "limitations": list(_LIMITATIONS),
        }
    grid = pts.reshape(rows, cols, 2)
    horiz = np.linalg.norm(np.diff(grid, axis=1), axis=2).ravel()
    vert = np.linalg.norm(np.diff(grid, axis=0), axis=2).ravel()
    spacing = np.concatenate([horiz, vert]) if horiz.size or vert.size else np.array([])
    if spacing.size == 0 or not np.isfinite(spacing).all() or float(np.mean(spacing)) == 0.0:
        return {
            "available": False,
            "reason": "Corner spacing could not be measured.",
            "assumptions": list(_ASSUMPTIONS),
            "limitations": list(_LIMITATIONS),
        }
    line_offsets = []
    for r in range(rows):
        centered = grid[r] - grid[r].mean(axis=0)
        _, _, vt = np.linalg.svd(centered, full_matrices=False)
        normal = np.array([-vt[0, 1], vt[0, 0]])
        line_offsets.append(np.abs(centered @ normal))
    straight = np.concatenate(line_offsets)

    observed = pts.astype(np.float32)
    homography, projected, per_corner = None, None, None
    limitations = list(_LIMITATIONS)
    ideal = _unit_grid(cols, rows)
    H, _mask = cv2.findHomography(ideal, observed, 0)
    if H is None:
        limitations.append("The homography fit failed, so no residual distances were produced.")
    else:
        proj = cv2.perspectiveTransform(ideal.reshape(-1, 1, 2), H).reshape(-1, 2)
        resid = np.linalg.norm(observed - proj, axis=1)
        homography = {
            "rms_px": float(np.sqrt(np.mean(resid ** 2))),
            "mean_px": float(np.mean(resid)),
            "median_px": float(np.median(resid)),
            "p95_px": float(np.percentile(resid, 95)),
            "max_px": float(np.max(resid)),
            "alignment": "origin-first-corner",
            "method": (
                "Least-squares cv2.findHomography from a unit planar grid onto all detected corners. "
                "`alignment` is fixed: the corner labelling does not change the residual."
            ),
        }
        projected = proj.astype(float).tolist()
        per_corner = [float(v) for v in resid]
    return {
        "available": True,
        "kind": "observed_image_geometry",
        "spacing_px": {
            "mean": float(np.mean(spacing)),
            "std": float(np.std(spacing)),
            "min": float(np.min(spacing)),
            "max": float(np.max(spacing)),
        },
        "spacing_cv": float(np.std(spacing) / np.mean(spacing)),
        "row_straightness_rms_px": float(np.sqrt(np.mean(straight ** 2))),
        "homography_residual": homography,
        "per_corner_residual_px": per_corner,
        "projected_corners": projected,
        "assumptions": list(_ASSUMPTIONS),
        "limitations": limitations,
        "note": (
            "spacing_px and row_straightness_rms_px are measured on detected corners. "
            "homography_residual is the pixel distance remaining after a planar homography. "
            "Neither value is a lens-distortion coefficient. "
            "Camera parameters are produced only by calibration when the inputs qualify."
        ),
    }

def draw_deviations(img, result: dict, geometry: dict):
    """Draw detected corners and, when a homography exists, the residual segment.

    Green means a small residual relative to the largest residual in this image.
    The caption states the computed RMS. It is not a lens coefficient.
    """
    out = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    observed = np.asarray(result["corners"], dtype=np.float64).reshape(-1, 2)
    projected = geometry.get("projected_corners")
    resid = geometry.get("per_corner_residual_px") or []
    peak = max(resid) if resid else 0.0
    for i, (x, y) in enumerate(observed):
        magnitude = resid[i] if i < len(resid) else 0.0
        t = 0.0 if peak <= 1e-6 else min(1.0, magnitude / peak)
        color = (0, int(round(255 * (1.0 - t))), int(round(255 * t)))
        cv2.circle(out, (int(round(x)), int(round(y))), 4, color, -1, lineType=cv2.LINE_AA)
        if projected is not None and i < len(projected):
            px, py = projected[i]
            cv2.line(out, (int(round(px)), int(round(py))), (int(round(x)), int(round(y))), color, 1, cv2.LINE_AA)
    residual = geometry.get("homography_residual") or {}
    if "rms_px" in residual:
        label = f"homography RMS {residual['rms_px']:.3f} px; not a lens coefficient"
    else:
        label = "homography residual unavailable"
    cv2.rectangle(out, (0, 0), (out.shape[1], 28), (0, 0, 0), -1)
    cv2.putText(out, label, (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
    return out
