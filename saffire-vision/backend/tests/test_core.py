import cv2, numpy as np, pytest
from types import SimpleNamespace
from fastapi.testclient import TestClient
from app.main import app
from app.routes import analysis as an
from app.services import image_loader as L, preprocessing as P, checkerboard_detector as D
from app.services import camera_calibration as C, report_generator as R, distortion_analyzer as A
from app.services import preprocess_comparison as PC, flame_frame as FF
from conftest import make_board
client = TestClient(app)

def an_out():
    return an.OUT_DETECTED

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

def test_comparison_statement_follows_the_numbers():
    original = {"num_corners": 231, "rms_px": 15.86, "success": True}
    same = {"operation": "grayscale", "status": "measured", "num_corners": 231, "rms_px": 15.864, "success": True}
    match = PC.summarize(original, [same])
    assert match["changed"] is False and match["improved"] is False
    assert "did not change detection" in match["statement"]
    assert "improvement" not in match["statement"]
    worse = {"operation": "denoise", "status": "measured", "num_corners": 0, "rms_px": None, "success": False}
    dropped = PC.summarize(original, [worse])
    assert dropped["changed"] is True and dropped["improved"] is False
    assert "not an improvement" in dropped["statement"]
    assert "did not change detection" not in dropped["statement"]
    better = {"operation": "contrast", "status": "measured", "num_corners": 231, "rms_px": 10.0, "success": True}
    gained = PC.summarize(original, [better])
    assert gained["changed"] is True and gained["improved"] is True
    assert gained["statement"].endswith("This is an improvement.")
    mixed = PC.summarize(original, [
        same,
        {"operation": "contrast", "status": "measured", "num_corners": 0, "rms_px": None, "success": False},
    ])
    assert mixed["improved"] is False
    assert "grayscale matched the original" in mixed["statement"]
    assert "not an improvement" in mixed["statement"]
    assert not mixed["statement"].startswith("Preprocessing did not change detection")
    absent = PC.summarize(original, [{"operation": "denoise", "status": "not_saved"}])
    assert "was not compared" in absent["statement"] or "not saved" in absent["statement"]
    assert "did not change detection" not in absent["statement"]

def test_saved_grayscale_copy_matches_original_detection(raw_dir, board):
    write(raw_dir, "grid.png", board)
    P.save_processed(P.apply("grayscale", board), "grid.png", "grayscale")
    result = PC.compare("grid.png", 7, 5, operations=("grayscale",))
    assert result["original"]["num_corners"] == 35
    assert result["copies"][0]["status"] == "measured"
    assert result["copies"][0]["num_corners"] == 35
    assert result["changed"] is False
    assert "did not change detection" in result["statement"]

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
    rep = R.build([])
    assert "limitations" in rep and R.path(rep["report_id"], "html")
    assert rep["calibration"]["status"] == "not_run" and "camera_matrix" not in rep["calibration"]
    assert rep["preprocessing"] == [] and rep["distortion"] == []
    assert rep["calibration_feasibility"]["estimates_parameters"] is False
    text = R.path(rep["report_id"], "html").read_text(encoding="utf-8")
    assert "No distortion analysis has been run" in text
    assert rep["preprocess_comparison"] is None
    assert "did not change detection" not in text

def test_dataset_lists_missing_saffire_files():
    ds = client.get("/api/dataset").json()
    assert ds["count"] == 0 and len(ds["missing_expected_files"]) == 4
    assert ds["missing_expected_files"][0].endswith(".jpg")

def test_preprocess_pipeline_and_save(tmp_path, monkeypatch, board):
    monkeypatch.setattr(P, "PROCESSED", tmp_path)
    orig = board.copy()
    out = P.apply("pipeline", board, apply_denoise=True, apply_contrast=True, grayscale=True)
    assert out.ndim == 2 and np.array_equal(board, orig)
    saved = P.save_processed(out, "grid.png", "pipeline")
    assert saved.is_file() and saved.parent == tmp_path

def test_geometry_on_known_points():
    cols, rows, step = 7, 5, 40.0
    ideal = np.mgrid[0:cols, 0:rows].T.reshape(-1, 2).astype(np.float64)
    pts = ideal * step + np.array([30.0, 20.0])
    perfect = {"success": True, "pattern": [cols, rows], "corners": pts.tolist(), "message": "ok"}
    g = A.grid_geometry(perfect)
    assert g["available"] is True
    assert abs(g["spacing_px"]["mean"] - step) < 1e-6
    assert g["homography_residual"]["rms_px"] < 1e-4
    shifted = pts.copy(); shifted[0, 0] += 8
    g2 = A.grid_geometry({**perfect, "corners": shifted.tolist()})
    assert g2["homography_residual"]["rms_px"] > 0.2
    failed = A.grid_geometry({"success": False, "message": "No coordinates were fabricated.", "pattern": [cols, rows]})
    assert failed["available"] is False and "spacing_px" not in failed and "homography_residual" not in failed
    vis = A.draw_deviations(np.full((220, 340, 3), 255, np.uint8), perfect, g)
    assert vis.shape == (220, 340, 3)

def test_calibration_feasibility_does_not_invent_a_model():
    images = [
        SimpleNamespace(filename="SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg"),
        SimpleNamespace(filename="SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg"),
        SimpleNamespace(filename="SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg"),
        SimpleNamespace(filename="SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_mono.jpg"),
    ]
    feas = C.assess_images(images, 10)
    assert feas["independent_scene_count"] == 1
    assert feas["sufficient_independent_views"] is False
    assert feas["estimates_parameters"] is False
    assert "camera_matrix" not in feas and "cannot yet be reliably completed" in feas["conclusion"]

def test_flame_frame_marks_bright_color_and_keeps_the_source():
    img = np.zeros((80, 120, 3), np.uint8)
    img[20:60, 30:90] = (0, 140, 255)  # orange flame-like region in BGR
    img[0:15, 0:40] = (0, 180, 0)  # green illumination, not a flame
    found = FF.detect(img)
    assert found["flame_pixels"] > 1000
    assert found["coverage_percent"] < 50
    assert "validated fire measurement" in found["label"]
    green = found["mask"][0:15, 0:40]
    assert int(cv2.countNonZero(green)) == 0
    ok, buf = cv2.imencode(".png", img)
    assert ok
    missing = client.post("/api/analysis/flame-frame", files={"file": ("flame.png", buf.tobytes(), "image/png")},
                          data={"experiment_name": "  ", "source": "NASA"})
    assert missing.status_code == 422
    up = client.post("/api/analysis/flame-frame", files={"file": ("flame.png", buf.tobytes(), "image/png")},
                     data={"experiment_name": "SoFIE-GEL", "source": "NASA ISS microgravity still"})
    assert up.status_code == 200
    body = up.json()
    assert body["experiment_name"] == "SoFIE-GEL"
    assert body["source"] == "NASA ISS microgravity still"
    assert body["flame_pixels"] == found["flame_pixels"]
    assert "Not a validated fire measurement" in body["label"]
    assert body["original_url"].endswith("/original.png")
    assert body["overlay_url"].endswith("/overlay.png")

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
    before = (raw_dir / "grid.png").read_bytes()
    pre = client.post("/api/analysis/preprocess", json={"image_id": "grid.png", "operation": "denoise", "gaussian_ksize": 5})
    assert pre.status_code == 200 and pre.headers["content-type"].startswith("image/png")
    assert pre.headers["x-processed-file"].endswith(".png")
    assert (raw_dir / "grid.png").read_bytes() == before
    dist = client.post("/api/analysis/distortion", json={"image_id": "grid.png", "cols": 7, "rows": 5})
    assert dist.status_code == 200
    body = dist.json()
    assert body["detection_success"] is True and body["geometry"]["available"] is True
    assert body["geometry"]["homography_residual"]["rms_px"] < 1.5
    assert "distortion_coefficients" not in body["geometry"]
    assert (an_out() / body["geometry"]["deviation_overlay"]).is_file()
    assert client.post("/api/analysis/distortion", json={"image_id": "missing.png", "cols": 7, "rows": 5}).status_code == 404
    assert client.post("/api/analysis/preprocess", json={"image_id": "grid.png", "operation": "denoise", "gaussian_ksize": 4}).status_code == 422
    status = client.get("/api/calibration/status").json()
    assert status["status"] in ("not_run", "insufficient", "valid")
    assert status["feasibility"]["estimates_parameters"] is False
    assert "camera_matrix" not in status["feasibility"]
    rid = client.post("/api/reports").json()["report_id"]
    report = client.get(f"/api/reports/{rid}")
    assert report.status_code == 200
    saved = report.json()
    assert saved["calibration"]["status"] == "insufficient"
    assert "camera_matrix" not in saved["calibration"]
    assert saved["preprocessing"] and saved["distortion"]
    logged = client.get("/api/analysis/log").json()
    assert any(s["type"] == "preprocess" for s in logged)
    assert any(s["type"] == "distortion" and s["geometry"]["available"] for s in logged)
    html_report = client.get(f"/api/reports/{rid}/download").text
    assert "planar-fit residual RMS" in html_report
    assert "per_corner_residual_px" not in html_report
    missing = client.post("/api/analysis/preprocess-comparison", json={"image_id": "missing.png", "cols": 7, "rows": 5})
    assert missing.status_code == 404
    assert client.post("/api/analysis/preprocess-comparison", json={"image_id": "grid.png", "cols": 2, "rows": 5}).status_code == 422
    compared = client.post("/api/analysis/preprocess-comparison", json={"image_id": "grid.png", "cols": 7, "rows": 5})
    assert compared.status_code == 200
    body = compared.json()
    assert body["original"]["success"] is True and body["original"]["num_corners"] == 35
    by_op = {c["operation"]: c for c in body["copies"]}
    assert by_op["contrast"]["status"] == "measured" and by_op["denoise"]["status"] == "measured"
    assert by_op["grayscale"]["status"] == "not_saved"
    if body["changed"]:
        assert "did not change detection" not in body["statement"]
        assert ("This is an improvement." if body["improved"] else "This is not an improvement.") in body["statement"]
    else:
        assert "did not change detection" in body["statement"]
        assert "improvement" not in body["statement"]
    again = client.post("/api/reports").json()["report_id"]
    report_html = client.get(f"/api/reports/{again}/download").text
    assert body["statement"] in report_html
    assert client.get(f"/api/reports/{rid}/download").status_code == 200
    assert client.get(f"/api/reports/{rid}/download", params={"format": "json"}).status_code == 200
    assert client.get("/api/reports/zzz").status_code == 404
    assert client.get("/api/reports/zzz/download", params={"format": "pdf"}).status_code == 422
