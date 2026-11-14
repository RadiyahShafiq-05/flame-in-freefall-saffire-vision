from pathlib import Path
import cv2, numpy as np
from PIL import Image, UnidentifiedImageError
from ..config import RAW, ALLOWED_EXT, DATASET_SOURCE
from ..schemas.image import ImageInfo, Dataset

class InvalidImageError(ValueError): ...

def classify(name: str) -> tuple[str, str]:
    n = name.lower()
    kind = "combined" if "combined" in n else ("individual" if "distortiongrid" in n else "unknown")
    variant = "mono" if "mono" in n else ("color" if kind != "unknown" else "unknown")  # unmarked grid files are RGB color JPEGs
    return kind, variant

def load_bgr(path: Path) -> np.ndarray:
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise InvalidImageError(f"Cannot decode image: {path.name}")
    return img

def describe(path: Path) -> ImageInfo:
    try:
        with Image.open(path) as im:
            w, h = im.size; fmt = im.format; mode = im.mode
    except (UnidentifiedImageError, OSError) as e:
        raise InvalidImageError(f"Not a valid image: {path.name}") from e
    kind, variant = classify(path.name)
    return ImageInfo(image_id=path.name, filename=path.name, width=w, height=h, format=fmt,
                     color_mode=mode, file_size_bytes=path.stat().st_size, kind=kind, variant=variant)

def inventory(folder: Path | None = None) -> Dataset:
    folder = folder or RAW
    imgs = []
    for p in sorted(folder.iterdir()) if folder.exists() else []:
        if p.suffix.lower() in ALLOWED_EXT:
            try: imgs.append(describe(p))
            except InvalidImageError: continue
    notes = ["'color'/'mono' versions of one scene are NOT independent calibration views.",
             "Combined images are side-by-side composites; panels must be separated and validated before use."]
    return Dataset(source=DATASET_SOURCE, count=len(imgs), images=imgs, notes=notes)
