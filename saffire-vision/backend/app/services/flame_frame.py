"""Approximate visual flame-region detection for a single still image.

Color thresholds on a dark background. This is not a trained model and it is
not a validated fire measurement: bright orange, yellow, white-hot, and blue
regions are marked because those colors appear in the NASA stills. Green
illumination is left out. A poster that contains many flames is measured as
one picture, not as separate moments.
"""
import cv2
import numpy as np

LABEL = "Approximate visual detection. Not a validated fire measurement."


def detect(bgr: np.ndarray) -> dict:
    if bgr is None or bgr.ndim != 3 or bgr.shape[2] != 3:
        raise ValueError("A color image is required")
    height, width = bgr.shape[:2]
    if height < 2 or width < 2:
        raise ValueError("Image is too small")
    mask = _mask(bgr)
    flame_pixels = int(cv2.countNonZero(mask))
    image_pixels = int(height * width)
    coverage = 100.0 * flame_pixels / image_pixels
    return {
        "mask": mask,
        "width": width,
        "height": height,
        "flame_pixels": flame_pixels,
        "image_pixels": image_pixels,
        "coverage_percent": round(coverage, 2),
        "label": LABEL,
    }


def overlay_bgra(mask: np.ndarray) -> np.ndarray:
    """Transparent cyan fill on the detected region. Everywhere else is clear."""
    h, w = mask.shape[:2]
    layer = np.zeros((h, w, 4), np.uint8)
    layer[mask > 0] = (255, 210, 0, 150)  # BGRA
    return layer


def composite(bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Original with the segmentation tint painted on the detected pixels."""
    tint = np.zeros_like(bgr)
    tint[mask > 0] = (255, 210, 0)
    blended = cv2.addWeighted(bgr, 0.62, tint, 0.38, 0)
    out = bgr.copy()
    out[mask > 0] = blended[mask > 0]
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(out, [c for c in contours if cv2.contourArea(c) >= 20], -1, (255, 230, 80), 1)
    return out


def _mask(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    warm = cv2.inRange(hsv, (0, 60, 70), (35, 255, 255))
    red = cv2.inRange(hsv, (165, 60, 70), (180, 255, 255))
    blue = cv2.inRange(hsv, (90, 50, 35), (135, 255, 255))
    colored = cv2.bitwise_or(warm, cv2.bitwise_or(red, blue))
    # White-hot cores sit inside the colored flame. Keep them only next to that color
    # so a bright background or a green lamp is not marked.
    white = cv2.inRange(hsv, (0, 0, 185), (180, 80, 255))
    near = cv2.dilate(colored, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    white = cv2.bitwise_and(white, near)
    mask = cv2.bitwise_or(colored, white)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask
