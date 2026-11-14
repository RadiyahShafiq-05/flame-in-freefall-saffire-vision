"""Image file I/O that also works for non-ASCII paths on Windows.

cv2.imread / cv2.imwrite use the ANSI code page on Windows and fail silently when
the path holds characters outside it (for example a user folder with accents or
CJK characters). Reading bytes with NumPy/pathlib and decoding in memory avoids that.
"""
from pathlib import Path
import cv2
import numpy as np


def imread(path, flags: int = cv2.IMREAD_COLOR):
    """Return the decoded image, or None when the file is unreadable or not an image."""
    try:
        data = np.fromfile(str(path), dtype=np.uint8)
    except OSError:
        return None
    if data.size == 0:
        return None
    return cv2.imdecode(data, flags)


def imwrite(path, img) -> bool:
    """Encode by file extension and write the bytes. Returns False on any failure."""
    p = Path(path)
    ok, buf = cv2.imencode(p.suffix or ".png", img)
    if not ok:
        return False
    try:
        p.write_bytes(buf.tobytes())
    except OSError:
        return False
    return True
