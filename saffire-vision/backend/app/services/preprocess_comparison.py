"""Compare one detection on the original image and on saved preprocessing copies.

The copies are read from data/processed/. This module does not create them and
does not modify data/raw. A match is corner count plus planar-fit RMS within
0.01 px. "Improvement" is used only when one of those numbers changes in the
favorable direction.
"""
from pathlib import Path

from ..utils import file_handler as F, imageio
from ..utils.imageio import imread
from . import checkerboard_detector as D, distortion_analyzer as A, preprocessing as P

OPERATIONS = ("grayscale", "contrast", "denoise")
RMS_MATCH_PX = 0.01

def measure(img, cols: int, rows: int) -> dict:
    """Corner count and residual RMS for one image. RMS is omitted when detection fails."""
    detected = D.detect(img, cols, rows)
    geometry = A.grid_geometry(detected)
    residual = (geometry.get("homography_residual") or {}).get("rms_px") if geometry.get("available") else None
    return {
        "success": bool(detected["success"]),
        "num_corners": int(detected["num_corners"]),
        "rms_px": None if residual is None else float(residual),
    }

def _same_rms(left, right) -> bool:
    if left is None and right is None:
        return True
    if left is None or right is None:
        return False
    return abs(left - right) <= RMS_MATCH_PX

def changed(original: dict, copy: dict) -> bool:
    return original["num_corners"] != copy["num_corners"] or not _same_rms(original.get("rms_px"), copy.get("rms_px"))

def improved(original: dict, copy: dict) -> bool:
    """True only when a recorded number moved in the favorable direction."""
    if not changed(original, copy):
        return False
    if copy["num_corners"] > original["num_corners"]:
        return True
    if copy["num_corners"] < original["num_corners"]:
        return False
    original_rms, copy_rms = original.get("rms_px"), copy.get("rms_px")
    if original_rms is None or copy_rms is None:
        return False
    return copy_rms < original_rms - RMS_MATCH_PX

def _px(value) -> str:
    return "not computed" if value is None else f"{value:.2f} px"

def _join(names: list[str]) -> str:
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + ", and " + names[-1]

def summarize(original: dict, copies: list[dict]) -> dict:
    """One sentence for the report. Unchanged copies never get the word improvement."""
    measured = [c for c in copies if c.get("status") == "measured"]
    missing = [c["operation"] for c in copies if c.get("status") != "measured"]
    if not measured:
        return {
            "changed": False,
            "improved": False,
            "statement": (
                "No saved grayscale, contrast, or denoise copy was found, so preprocessing "
                "was not compared with detection."
            ),
        }
    moves = [c for c in measured if changed(original, c)]
    names = _join([c["operation"] for c in measured])
    if not moves:
        missing_note = ""
        if missing:
            verb = "was" if len(missing) == 1 else "were"
            pronoun = "it was" if len(missing) == 1 else "they were"
            missing_note = f" {_join(missing)} {verb} not saved, so {pronoun} left out of the comparison."
        return {
            "changed": False,
            "improved": False,
            "statement": (
                f"Preprocessing did not change detection. The original and the {names} "
                f"{'copy' if len(measured) == 1 else 'copies'} each have {original['num_corners']} corners "
                f"and a planar-fit residual RMS of {_px(original.get('rms_px'))}.{missing_note}"
            ),
        }
    held = [c["operation"] for c in measured if not changed(original, c)]
    parts = []
    if held:
        parts.append(f"{_join(held)} matched the original")
    any_improved = False
    any_worse = False
    for copy in moves:
        better = improved(original, copy)
        any_improved = any_improved or better
        any_worse = any_worse or not better
        parts.append(
            f"{copy['operation']} has {copy['num_corners']} corners and residual RMS {_px(copy.get('rms_px'))} "
            f"against {original['num_corners']} corners and {_px(original.get('rms_px'))} on the original"
        )
    closing = (
        "This is an improvement."
        if any_improved and not any_worse
        else "This is not an improvement."
    )
    return {
        "changed": True,
        "improved": any_improved and not any_worse,
        "statement": "Preprocessing changed a measurement. " + "; ".join(parts) + ". " + closing,
    }

def _processed_path(image_id: str, operation: str) -> Path:
    stem = Path(F.safe_name(image_id)).stem or "image"
    op = "".join(c for c in operation if c.isalnum() or c in "-_") or "processed"
    return P.PROCESSED / f"{stem}__{op}.png"

def compare(image_id: str, cols: int, rows: int, operations=OPERATIONS) -> dict:
    """Measure the original and each saved copy. Missing copies are reported, not invented."""
    original_img = imageio.imread(F.resolve(image_id))
    if original_img is None:
        raise ValueError(f"Cannot decode image: {image_id}")
    original = measure(original_img, cols, rows)
    original["source"] = "original"
    copies = []
    for operation in operations:
        path = _processed_path(image_id, operation)
        if not path.is_file():
            copies.append({"operation": operation, "status": "not_saved", "saved_file": None})
            continue
        img = imread(path)
        if img is None:
            copies.append({
                "operation": operation, "status": "unreadable", "saved_file": P.relative_output(path),
            })
            continue
        row = measure(img, cols, rows)
        row.update({
            "operation": operation,
            "status": "measured",
            "saved_file": P.relative_output(path),
            "changed": changed(original, row),
            "improved": improved(original, row),
        })
        copies.append(row)
    summary = summarize(original, copies)
    return {
        "image_id": image_id,
        "pattern": [cols, rows],
        "match_tolerance_px": RMS_MATCH_PX,
        "original": original,
        "copies": copies,
        **summary,
    }
