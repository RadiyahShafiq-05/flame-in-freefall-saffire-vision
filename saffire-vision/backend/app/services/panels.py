"""Split side-by-side composite images and check what each panel actually is.

Everything here is measured from pixels. The camera label burned into the NASA
composites is NOT read by software; docs/dataset.md records it from visual
inspection only.
"""
import cv2
import numpy as np

# Rows at the top hold burned-in label text, so they are excluded from comparisons.
LABEL_BAND_PX = 40
# A divider is a column whose darkest pixel (below the label band) is still this bright.
DIVIDER_MIN_LEVEL = 200
MIN_DIVIDER_WIDTH = 2
# Mean absolute grey-level difference below which two images are called the same picture.
# Heuristic: JPEG re-compression of one scene gave about 1 on the supplied files.
DUPLICATE_MAX_MEAN_DIFF = 3.0


def _gray(img):
    return img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def find_divider(img):
    """Return (start, end_exclusive) of a full-height bright vertical divider, else None.

    Only runs that do not touch the image border count. If several exist, the widest wins.
    """
    gray = _gray(img)
    h, w = gray.shape[:2]
    band = gray[LABEL_BAND_PX:] if h > 2 * LABEL_BAND_PX else gray
    bright = band.min(axis=0) >= DIVIDER_MIN_LEVEL
    runs, start = [], None
    for x in range(w + 1):
        on = x < w and bool(bright[x])
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append((start, x))
            start = None
    runs = [(a, b) for a, b in runs if b - a >= MIN_DIVIDER_WIDTH and a > 0 and b < w]
    return max(runs, key=lambda r: r[1] - r[0]) if runs else None


def panel_bounds(img):
    """List of (x_start, x_end_exclusive). One panel spanning the image when no divider exists."""
    w = img.shape[1]
    div = find_divider(img)
    if div is None:
        return [(0, w)]
    bounds = [(0, div[0]), (div[1], w)]
    return [(a, b) for a, b in bounds if b - a > 0]


def crop(img, panel: int):
    """Copy of one panel. Raises IndexError for an unknown panel number."""
    bounds = panel_bounds(img)
    if panel < 0 or panel >= len(bounds):
        raise IndexError(f"panel {panel} out of range; this image has {len(bounds)} panel(s) (0-based)")
    a, b = bounds[panel]
    return img[:, a:b].copy(), a


def mean_abs_diff(a, b):
    """Mean absolute grey difference below the label band, or None if sizes differ."""
    ga, gb = _gray(a), _gray(b)
    if ga.shape != gb.shape:
        return None
    return float(cv2.absdiff(ga[LABEL_BAND_PX:], gb[LABEL_BAND_PX:]).mean())


def analyze(img, individuals):
    """Describe the panels of `img`. `individuals` is a list of (filename, image)."""
    bounds = panel_bounds(img)
    div = find_divider(img)
    panels = []
    for i, (a, b) in enumerate(bounds):
        sub = img[:, a:b]
        best = None
        for name, other in individuals:
            d = mean_abs_diff(sub, other)
            if d is not None and (best is None or d < best[1]):
                best = (name, d)
        match = None
        if best is not None and best[1] <= DUPLICATE_MAX_MEAN_DIFF:
            match = {"filename": best[0], "mean_abs_diff": round(best[1], 4)}
        panels.append({
            "index": i, "x_start": a, "x_end": b, "width": b - a, "height": int(img.shape[0]),
            "matches_individual": match,
            "closest_individual_mean_abs_diff": None if best is None else round(best[1], 4),
        })
    return {
        "divider": None if div is None else [div[0], div[1]],
        "panels": panels,
        "method": (
            f"Full-height columns with every pixel below row {LABEL_BAND_PX} >= {DIVIDER_MIN_LEVEL} "
            f"are a divider. A panel 'matches' an individual file when the mean absolute grey difference "
            f"(label band excluded) is <= {DUPLICATE_MAX_MEAN_DIFF}; that threshold is a heuristic."
        ),
    }
