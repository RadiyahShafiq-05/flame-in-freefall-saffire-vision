"""Preprocessing on copies. Callers never pass a path inside data/raw for writing."""
from pathlib import Path
import cv2
from ..config import PROCESSED, ROOT
from ..utils import imageio

def to_gray(img):
    return img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

def resize_for_display(img, max_dim=1024):
    h, w = img.shape[:2]
    scale = max_dim / max(h, w)
    if scale >= 1:
        return img
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

def enhance_contrast(img, clip=2.0):
    """CLAHE on a grayscale copy. clip is the contrast limit, not a physical unit."""
    gray = to_gray(img)
    return cv2.createCLAHE(clipLimit=float(clip), tileGridSize=(8, 8)).apply(gray)

def denoise(img, ksize=5, sigma=0.0):
    """Gaussian blur. sigma 0 asks OpenCV to derive sigma from ksize."""
    ksize = int(ksize)
    if ksize < 1 or ksize % 2 == 0:
        raise ValueError("gaussian_ksize must be a positive odd integer")
    return cv2.GaussianBlur(img, (ksize, ksize), float(sigma))

def normalize(img):
    return cv2.normalize(to_gray(img), None, 0, 255, cv2.NORM_MINMAX)

def run_pipeline(img, *, grayscale=True, denoise_enabled=False, contrast=False, ksize=5, sigma=0.0, clip=2.0):
    """Optional chain: Gaussian denoise, grayscale, then CLAHE. Steps default off except grayscale."""
    out = img.copy()
    if denoise_enabled:
        out = denoise(out, ksize, sigma)
    if grayscale or contrast:
        out = to_gray(out)
    if contrast:
        out = enhance_contrast(out, clip)
    return out

def apply(op: str, img, max_dim=1024, *, gaussian_ksize=5, gaussian_sigma=0.0, clahe_clip=2.0,
          grayscale=True, apply_denoise=False, apply_contrast=False):
    """Return a new image. `img` is not modified."""
    src = img.copy()
    if op == "grayscale":
        return to_gray(src)
    if op == "contrast":
        return enhance_contrast(src, clahe_clip)
    if op == "denoise":
        return denoise(src, gaussian_ksize, gaussian_sigma)
    if op == "normalize":
        return normalize(src)
    if op == "resize":
        return resize_for_display(src, max_dim)
    if op == "pipeline":
        return run_pipeline(src, grayscale=grayscale, denoise_enabled=apply_denoise, contrast=apply_contrast,
                            ksize=gaussian_ksize, sigma=gaussian_sigma, clip=clahe_clip)
    raise ValueError(f"Unknown preprocessing operation: {op}")

def save_processed(img, image_id: str, operation: str) -> Path:
    """Write a derived PNG under data/processed/. Existing raw files are never the destination."""
    from ..utils.file_handler import safe_name
    stem = Path(safe_name(image_id)).stem or "image"
    op = "".join(c for c in operation if c.isalnum() or c in "-_") or "processed"
    PROCESSED.mkdir(parents=True, exist_ok=True)
    dest = PROCESSED / f"{stem}__{op}.png"
    if not imageio.imwrite(dest, img):
        raise RuntimeError(f"Could not write processed image: {dest.name}")
    return dest

def relative_output(path: Path) -> str:
    """Repo-relative path when possible, otherwise the file name (used by tests)."""
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return path.name
