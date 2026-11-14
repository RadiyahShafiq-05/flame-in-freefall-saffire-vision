import json, cv2, numpy as np
from datetime import datetime, timezone
from ..config import METADATA, MIN_CALIBRATION_VIEWS
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
    if not CAL_FILE.exists():
        return {"status": "not_run"}
    return json.loads(CAL_FILE.read_text(encoding="utf-8"))

def assess_images(images, min_views: int | None = None) -> dict:
    """Decide whether the current filenames could support calibration.

    Color/mono copies count once. Combined composites are excluded. This function
    does not detect corners and does not estimate a camera matrix.
    """
    minimum = MIN_CALIBRATION_VIEWS if min_views is None else int(min_views)
    groups: dict[str, list[str]] = {}
    combined = []
    for im in images:
        name = im.filename if hasattr(im, "filename") else im["filename"]
        groups.setdefault(_group_key(name), []).append(name)
        if "combined" in name.lower():
            combined.append(name)
    scenes = []
    for key, names in groups.items():
        usable = [n for n in names if "combined" not in n.lower()]
        if usable:
            scenes.append({"scene_key": key, "files": usable, "counted_as": 1})
    reasons = []
    if not images:
        reasons.append("data/raw contains no supported images.")
    if combined:
        reasons.append("Combined images are composites and are not counted as calibration views: " + ", ".join(combined) + ".")
    for scene in scenes:
        if len(scene["files"]) > 1:
            reasons.append("These files are one scene, not separate views: " + ", ".join(scene["files"]) + ".")
    count = len(scenes)
    reasons.append(f"{count} independent scene(s) counted; the minimum used for this check is {minimum}.")
    reasons.append("This assessment does not estimate a camera matrix or distortion coefficients.")
    enough = count >= minimum
    if enough:
        conclusion = (
            "Enough distinct files are present to attempt calibration, but this check does not fit a model. "
            "Call POST /api/calibration/run. Parameters are returned only if detection succeeds on enough qualifying views."
        )
    else:
        conclusion = (
            "Calibration cannot yet be reliably completed: there are not enough independent views. "
            "Add further images of the same camera and board from different positions, then call POST /api/calibration/run. "
            "Color/mono copies and combined composites do not qualify. No camera matrix was estimated."
        )
    return {
        "estimates_parameters": False,
        "sufficient_independent_views": enough,
        "independent_scene_count": count,
        "minimum_views": minimum,
        "scenes": scenes,
        "reasons": reasons,
        "conclusion": conclusion,
    }

def pixel_check(images) -> dict:
    """Look inside combined images: how many panels, and are any new relative to individual files?

    Measured from pixels only. Software does not read camera labels, so this never says which
    camera a panel came from.
    """
    from . import image_loader, panels
    from ..utils import file_handler as F
    individuals, combined = [], []
    for im in images:
        (individuals if im.kind == "individual" else combined if im.kind == "combined" else []).append(im)
    loaded = []
    for im in individuals:
        try:
            loaded.append((im.filename, image_loader.load_bgr(F.resolve(im.filename))))
        except (FileNotFoundError, image_loader.InvalidImageError):
            continue
    files, new_panels = [], set()
    for im in combined:
        try:
            analysis = panels.analyze(image_loader.load_bgr(F.resolve(im.filename)), loaded)
        except (FileNotFoundError, image_loader.InvalidImageError):
            continue
        files.append({"filename": im.filename, "divider": analysis["divider"], "panels": analysis["panels"]})
        for p in analysis["panels"]:
            if p["matches_individual"] is None:
                new_panels.add((_group_key(im.filename), p["index"]))
    scene_keys = {_group_key(im.filename) for im in individuals}
    notes = [
        "Panels that duplicate an individual file add no new view.",
        "Views from different cameras cannot be pooled to fit one camera model. "
        "Extra panels do not make calibration feasible unless several independent views of the SAME camera exist.",
        "Which camera a panel came from is not determined here; the composites carry burned-in text "
        "that was read visually (docs/dataset.md).",
    ]
    return {
        "combined_files": files,
        "distinct_views_by_pixels": len(scene_keys) + len(new_panels),
        "new_panels_not_in_individual_files": len(new_panels),
        "notes": notes,
    }

def assess_current_dataset(min_views: int | None = None) -> dict:
    from . import image_loader
    images = image_loader.inventory().images
    result = assess_images(images, min_views)
    try:
        result["pixel_check"] = pixel_check(images)
    except Exception as exc:  # the filename-based result must still be returned
        result["pixel_check"] = {"error": f"pixel check failed: {exc}"}
    return result
def undistort(img, cal: dict):
    if cal.get("status") != "valid": raise ValueError("No valid calibration model.")
    return cv2.undistort(img, np.array(cal["camera_matrix"]), np.array(cal["distortion_coefficients"]))
