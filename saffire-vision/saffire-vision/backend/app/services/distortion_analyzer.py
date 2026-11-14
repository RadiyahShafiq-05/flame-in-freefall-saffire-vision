import numpy as np
def grid_geometry(result: dict) -> dict:
    """Observable geometry only. NOT lens-distortion coefficients."""
    if not result["success"]:
        return {"available": False, "reason": result["message"]}
    cols, rows = result["pattern"]; p = np.array(result["corners"]).reshape(rows, cols, 2)
    horiz = np.linalg.norm(np.diff(p, axis=1), axis=2).ravel()
    vert = np.linalg.norm(np.diff(p, axis=0), axis=2).ravel()
    s = np.concatenate([horiz, vert])
    dev = []
    for r in range(rows):  # RMS deviation of each corner row from its best-fit line
        d = p[r] - p[r].mean(0)
        _, _, vt = np.linalg.svd(d); n = np.array([-vt[0][1], vt[0][0]])
        dev.append(np.abs(d @ n))
    return {"available": True, "kind": "observed_image_geometry",
            "spacing_px": {"mean": float(s.mean()), "std": float(s.std()), "min": float(s.min()), "max": float(s.max())},
            "spacing_cv": float(s.std() / s.mean()),
            "row_straightness_rms_px": float(np.sqrt(np.mean(np.concatenate(dev) ** 2))),
            "note": "Computed from detected corners in pixel units. These are not lens-distortion coefficients; "
                    "radial distortion requires a valid calibration model (see /api/calibration)."}
