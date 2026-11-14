import sys, pathlib, cv2, numpy as np, pytest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from app import config
@pytest.fixture(autouse=True)
def tmp_dirs(tmp_path, monkeypatch):
    import app.utils.file_handler as fh, app.services.image_loader as il
    import app.services.camera_calibration as cc, app.services.report_generator as rg
    import app.routes.analysis as an
    raw = tmp_path / "raw"; raw.mkdir(); meta = tmp_path / "meta"; meta.mkdir()
    rep = tmp_path / "rep"; rep.mkdir(); det = tmp_path / "det"; det.mkdir()
    monkeypatch.setattr(fh, "RAW", raw); monkeypatch.setattr(il, "RAW", raw)
    monkeypatch.setattr(cc, "CAL_FILE", meta / "cal.json"); monkeypatch.setattr(rg, "OUT_REPORTS", rep)
    monkeypatch.setattr(an, "HISTORY", meta / "h.json"); monkeypatch.setattr(an, "OUT_DETECTED", det)
    import app.routes.reports as rr; monkeypatch.setattr(rr, "OUT_REPORTS", rep)
    return raw
def make_board(cols=7, rows=5, sq=40, margin=60):
    w, h = (cols + 1) * sq + 2 * margin, (rows + 1) * sq + 2 * margin
    img = np.full((h, w), 255, np.uint8)
    for r in range(rows + 1):
        for c in range(cols + 1):
            if (r + c) % 2 == 0:
                y, x = margin + r * sq, margin + c * sq; img[y:y+sq, x:x+sq] = 0
    return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
@pytest.fixture
def board(): return make_board()
@pytest.fixture
def raw_dir(tmp_dirs): return tmp_dirs
