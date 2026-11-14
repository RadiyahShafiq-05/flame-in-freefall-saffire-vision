import re, shutil
from pathlib import Path
from ..config import RAW
def safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(name).name)
def save_raw(filename: str, data: bytes) -> Path:
    """Saves under data/raw without ever overwriting an existing file."""
    base = RAW / safe_name(filename)
    p, i = base, 1
    while p.exists():
        p = RAW / f"{base.stem}__{i}{base.suffix}"; i += 1
    p.write_bytes(data)
    return p
def resolve(image_id: str) -> Path:
    p = RAW / safe_name(image_id)
    if not p.is_file():
        raise FileNotFoundError(image_id)
    return p
def copy_into_raw(src: Path) -> Path:
    dst = RAW / src.name
    if not dst.exists():
        shutil.copy2(src, dst)
    return dst
