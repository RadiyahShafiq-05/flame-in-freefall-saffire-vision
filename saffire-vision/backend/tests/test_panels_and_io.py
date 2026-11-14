"""Panel splitting, Windows-safe I/O, JSON preprocess, and composite-aware feasibility.

Synthetic images only, so these run without the NASA files.
"""
import cv2, numpy as np
from fastapi.testclient import TestClient
from app.main import app
from app.services import panels as PN, image_loader as L, camera_calibration as C
from app.utils import imageio
from conftest import make_board

client = TestClient(app)

def framed(board):
    """Board with a black frame so the only full-height bright run is the divider."""
    return cv2.copyMakeBorder(board, 10, 10, 10, 10, cv2.BORDER_CONSTANT, value=(0, 0, 0))

def composite(a, b, divider=5):
    bar = np.full((a.shape[0], divider, 3), 255, np.uint8)
    return np.hstack([a, bar, b])

def shifted_board():
    """Same size and same 7x5 pattern as make_board(), but a black block in the bottom-left margin
    (below the 40-row label band, large enough to exceed the duplicate threshold)."""
    img = make_board()
    h = img.shape[0]
    img[h - 60:h, 0:60] = 0
    return img

def test_imageio_roundtrip_with_non_ascii_directory(tmp_path):
    folder = tmp_path / "données_日本_ñ"
    folder.mkdir()
    img = make_board()
    assert imageio.imwrite(folder / "grid.png", img) is True
    back = imageio.imread(folder / "grid.png")
    assert back is not None and np.array_equal(back, img)
    assert L.load_bgr(folder / "grid.png").shape == img.shape

def test_imageio_unreadable_returns_none(tmp_path):
    (tmp_path / "bad.png").write_bytes(b"not an image")
    assert imageio.imread(tmp_path / "bad.png") is None
    assert imageio.imread(tmp_path / "missing.png") is None
    assert imageio.imwrite(tmp_path / "no_such_dir" / "x.png", make_board()) is False

def test_find_divider_exact_and_absent():
    a, b = framed(make_board()), framed(shifted_board())
    comp = composite(a, b)
    assert PN.find_divider(comp) == (a.shape[1], a.shape[1] + 5)
    assert PN.panel_bounds(comp) == [(0, a.shape[1]), (a.shape[1] + 5, comp.shape[1])]
    assert PN.find_divider(a) is None
    assert PN.panel_bounds(a) == [(0, a.shape[1])]

def test_analyze_detects_duplicate_and_new_panel():
    dup = framed(make_board())
    new = framed(shifted_board())
    # panel 1 is a copy of `dup`; panel 0 is new
    res = PN.analyze(composite(new, dup), [("copy.png", dup)])
    p0, p1 = res["panels"]
    assert p0["matches_individual"] is None
    assert p1["matches_individual"] == {"filename": "copy.png", "mean_abs_diff": 0.0}

def test_crop_out_of_range():
    comp = composite(framed(make_board()), framed(shifted_board()))
    sub, off = PN.crop(comp, 1)
    assert off > 0 and sub.shape[0] == comp.shape[0]
    try:
        PN.crop(comp, 2)
        assert False, "expected IndexError"
    except IndexError as e:
        assert "out of range" in str(e)

def _upload(name, img):
    ok, buf = cv2.imencode(".png", img)
    r = client.post("/api/images/upload", files={"file": (name, buf.tobytes(), "image/png")})
    assert r.status_code == 201, r.text

def test_api_panels_and_panel_detection(raw_dir):
    a, b = framed(make_board()), framed(shifted_board())
    _upload("comp.png", composite(a, b))
    p = client.get("/api/images/comp.png/panels")
    assert p.status_code == 200
    body = p.json()
    assert body["divider"] == [a.shape[1], a.shape[1] + 5] and len(body["panels"]) == 2
    assert body["panels"][0]["matches_individual"] is None
    for panel in (0, 1):
        d = client.post("/api/analysis/detect-checkerboard", json={"image_id": "comp.png", "cols": 7, "rows": 5, "panel": panel})
        assert d.status_code == 200, d.text
        j = d.json()
        assert j["success"] and j["num_corners"] == 35 and j["panel"] == panel
        assert j["overlay_file"].endswith(f"_panel{panel}_7x5.png")
    # x offsets let a client map panel coordinates to the composite
    assert client.post("/api/analysis/detect-checkerboard", json={"image_id": "comp.png", "cols": 7, "rows": 5, "panel": 1}).json()["panel_x_offset"] == a.shape[1] + 5
    g = client.post("/api/analysis/distortion", json={"image_id": "comp.png", "cols": 7, "rows": 5, "panel": 1}).json()
    assert g["panel"] == 1 and g["geometry"]["available"] is True
    assert client.post("/api/analysis/detect-checkerboard", json={"image_id": "comp.png", "cols": 7, "rows": 5, "panel": 9}).status_code == 422
    assert client.get("/api/images/missing.png/panels").status_code == 404

def test_preprocess_json_and_default_png(raw_dir, board):
    _upload("g.png", board)
    png = client.post("/api/analysis/preprocess", json={"image_id": "g.png", "operation": "contrast"})
    assert png.headers["content-type"] == "image/png"
    js = client.post("/api/analysis/preprocess", json={"image_id": "g.png", "operation": "contrast", "response_format": "json"})
    assert js.status_code == 200 and js.headers["content-type"].startswith("application/json")
    j = js.json()
    assert j["output_url"] == "/outputs/processed/g__contrast.png" and j["channels"] == 1
    assert (j["width"], j["height"]) == (board.shape[1], board.shape[0])
    assert client.post("/api/analysis/preprocess", json={"image_id": "g.png", "operation": "contrast", "response_format": "xml"}).status_code == 422

def test_preprocess_never_touches_raw(raw_dir, board):
    _upload("g.png", board)
    before = (raw_dir / "g.png").read_bytes()
    for op in ("grayscale", "contrast", "denoise", "normalize", "resize", "pipeline"):
        assert client.post("/api/analysis/preprocess", json={"image_id": "g.png", "operation": op}).status_code == 200
    assert (raw_dir / "g.png").read_bytes() == before

def test_feasibility_pixel_check_counts_new_panel_but_stays_infeasible(raw_dir):
    ind = framed(make_board())
    new = framed(shifted_board())
    imageio.imwrite(raw_dir / "SAFFIRE-1_F1C1_DistortionGrid-test.png", ind)
    imageio.imwrite(raw_dir / "SAFFIRE-1_DistortionGrids-test_Combined_color.png", composite(new, ind))
    st = client.get("/api/calibration/status").json()
    feas = st["feasibility"]
    pc = feas["pixel_check"]
    assert pc["new_panels_not_in_individual_files"] == 1
    assert pc["distinct_views_by_pixels"] == 2
    assert feas["sufficient_independent_views"] is False and feas["estimates_parameters"] is False
    assert "camera_matrix" not in feas and "camera_matrix" not in st
    assert any("different cameras" in n for n in pc["notes"])
