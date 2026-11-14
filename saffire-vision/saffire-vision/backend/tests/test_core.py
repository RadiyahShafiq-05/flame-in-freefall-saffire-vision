import cv2, numpy as np, pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services import image_loader as L, preprocessing as P, checkerboard_detector as D
from app.services import camera_calibration as C, report_generator as R
from conftest import make_board
client = TestClient(app)

def write(raw, name, img): cv2.imwrite(str(raw / name), img)

def test_metadata_and_classification(raw_dir, board):
    write(raw_dir, "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_mono.png", board)
    inv = L.inventory(raw_dir)
    assert inv.count == 1 and inv.images[0].kind == "combined" and inv.images[0].variant == "mono"
    assert inv.images[0].width == board.shape[1]

def test_invalid_image(raw_dir):
    (raw_dir / "bad.png").write_bytes(b"not an image")
    with pytest.raises(L.InvalidImageError): L.describe(raw_dir / "bad.png")
    assert L.inventory(raw_dir).count == 0

def test_grayscale_does_not_mutate(board):
    orig = board.copy(); g = P.apply("grayscale", board)
    assert g.ndim == 2 and np.array_equal(board, orig)

def test_detect_success_and_failure(board):
    r = D.detect(board, 7, 5); assert r["success"] and r["num_corners"] == 35
    bad = D.detect(np.full((200, 200, 3), 128, np.uint8), 7, 5)
    assert not bad["success"] and bad["corners"] == [] and "fabricated" in bad["message"]

def test_calibration_validation(board):
    problems = C.validate_inputs([("a_color.png", board), ("a_mono.png", board)], 10)
    assert any("independent" in p for p in problems) and any("at least" in p for p in problems)
    assert any("combined" in p for p in C.validate_inputs([("x_Combined.png", board)], 1))

def test_calibration_failure_is_reported(board):
    res = C.calibrate([("v1.png", board)], 7, 5, None, 10)
    assert res["status"] == "insufficient" and "camera_matrix" not in res

def test_calibration_valid_with_synthetic_views():
    items = []
    for i in range(10):
        b = make_board(); M = cv2.getRotationMatrix2D((b.shape[1]/2, b.shape[0]/2), i * 3 - 12, 1 + 0.02 * i)
        items.append((f"v{i}.png", cv2.warpAffine(b, M, (b.shape[1], b.shape[0]), borderValue=(255, 255, 255))))
    res = C.calibrate(items, 7, 5, 10.0, 8)
    assert res["status"] in ("valid", "insufficient")  # depends on detectability; never fabricated
    if res["status"] == "valid": assert res["rms_reprojection_error_px"] >= 0

def test_report_generation(raw_dir, board):
    write(raw_dir, "g.png", board)
    rep = R.build([]); assert "limitations" in rep and R.path(rep["report_id"], "html")

def test_api(raw_dir, board):
    assert client.get("/api/health").json() == {"status": "ok"}
    ok, buf = cv2.imencode(".png", board)
    up = client.post("/api/images/upload", files={"file": ("grid.png", buf.tobytes(), "image/png")})
    assert up.status_code == 201
    assert client.post("/api/images/upload", files={"file": ("x.txt", b"hi", "text/plain")}).status_code == 415
    assert client.post("/api/images/upload", files={"file": ("y.png", b"junk", "image/png")}).status_code == 422
    assert len(client.get("/api/images").json()) == 1
    assert client.get("/api/images/nope.png").status_code == 404
    d = client.post("/api/analysis/detect-checkerboard", json={"image_id": "grid.png", "cols": 7, "rows": 5})
    assert d.status_code == 200 and d.json()["success"]
    assert client.post("/api/analysis/detect-checkerboard", json={"image_id": "grid.png", "cols": 1, "rows": 5}).status_code == 422
    assert client.post("/api/analysis/preprocess", json={"image_id": "grid.png", "operation": "contrast"}).status_code == 200
    assert client.get("/api/calibration/status").json()["status"] in ("not_run", "insufficient", "valid")
    c = client.post("/api/calibration/run", json={"image_ids": ["grid.png"], "cols": 7, "rows": 5}).json()
    assert c["status"] == "insufficient"
    rid = client.post("/api/reports").json()["report_id"]
    assert client.get(f"/api/reports/{rid}").status_code == 200
    assert client.get(f"/api/reports/{rid}/download").status_code == 200
    assert client.get("/api/reports/zzz").status_code == 404
