from pathlib import Path
import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError
from ..config import RAW, METADATA, ALLOWED_EXT, DATASET_SOURCE, EXPECTED_RAW_FILES
from ..schemas.image import ImageInfo, Dataset
from ..utils import imageio

class InvalidImageError(ValueError):
    """Raised when a file cannot be decoded. The file is left unchanged."""

INVENTORY_PATH = METADATA / "inventory.json"

def classify(name: str) -> tuple[str, str]:
    """Classify from the filename only. This does not inspect pixel content."""
    n = name.lower()
    kind = "combined" if "combined" in n else ("individual" if "distortiongrid" in n else "unknown")
    # Unmarked SAFFIRE grid files are the color JPEGs. "mono" in the name is the monochrome copy.
    variant = "mono" if "mono" in n else ("color" if kind != "unknown" else "unknown")
    return kind, variant

def load_bgr(path: Path) -> np.ndarray:
    img = imageio.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise InvalidImageError(f"Cannot decode image: {path.name}")
    return img

def describe(path: Path) -> ImageInfo:
    try:
        with Image.open(path) as im:
            w, h = im.size
            fmt = im.format
            mode = im.mode
            channels = len(im.getbands())
    except (UnidentifiedImageError, OSError) as e:
        raise InvalidImageError(f"Not a valid image: {path.name}") from e
    kind, variant = classify(path.name)
    return ImageInfo(
        image_id=path.name, filename=path.name, width=w, height=h, format=fmt,
        color_mode=mode, channels=channels, file_size_bytes=path.stat().st_size,
        kind=kind, variant=variant,
    )

def inventory(folder: Path | None = None) -> Dataset:
    """Read supported images. Unsupported or undecodable files are skipped, not deleted."""
    folder = folder or RAW
    imgs = []
    skipped = []
    if folder.exists():
        for p in sorted(folder.iterdir()):
            if not p.is_file() or p.name == ".gitkeep":
                continue
            if p.suffix.lower() not in ALLOWED_EXT:
                skipped.append(p.name)
                continue
            try:
                imgs.append(describe(p))
            except InvalidImageError:
                skipped.append(p.name)
    missing = [name for name in EXPECTED_RAW_FILES if not (folder / name).is_file()]
    present = [name for name in EXPECTED_RAW_FILES if (folder / name).is_file()]
    notes = [
        "These files are checkerboard distortion grids, not flame images or temperature measurements.",
        "Color and monochrome copies of one scene are not independent calibration views.",
        "Combined images are side-by-side composites and are not calibration views until panels are separated and checked.",
        "Inner-corner pattern size and physical square size are not measured from the filename. Pass them explicitly.",
        "A monochrome filename may still be stored as a 3-channel JPEG. `channels` is the file's band count.",
    ]
    if missing:
        notes.append(
            "Missing expected SAFFIRE-1 file(s): " + ", ".join(missing) + ". "
            "Unzip SAFFIRE-1_F1C1_DistortionGrids_1280x920_originals.zip and copy those JPEGs into data/raw/. "
            "Do not rename them and do not edit the pixels. The API runs without them; analysis of a missing id returns 404."
        )
    else:
        notes.append("All four expected SAFFIRE-1 filenames are present. Inventory does not modify them.")
    if skipped:
        notes.append("Skipped unsupported or undecodable file(s): " + ", ".join(skipped) + ".")
    return Dataset(
        source=DATASET_SOURCE, count=len(imgs), images=imgs, notes=notes,
        missing_expected_files=missing, present_expected_files=present,
    )

def persist(dataset: Dataset) -> None:
    """Write generated metadata. This file is derived and is safe to delete."""
    INVENTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    INVENTORY_PATH.write_text(dataset.model_dump_json(indent=2), encoding="utf-8")
