"""Checks against the real NASA files. Skipped when they are not in data/raw.

Detection counts were measured with OpenCV 4.10.0 and 5.0.0 (identical on both).
Smaller patterns (for example 8x6) differ between those versions and are not asserted.
"""
import pytest
from app import config
from app.services import image_loader as L, checkerboard_detector as D, distortion_analyzer as A, panels as PN
from app.services import camera_calibration as C

RAW = config.ROOT / "data/raw"
FILES = {"SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg": (1280, 920, "individual", "RGB"),
         "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg": (1280, 920, "individual", "L"),
         "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg": (2565, 920, "combined", "RGB"),
         "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_mono.jpg": (2565, 920, "combined", "L")}
IND, IND_MONO, COMB, COMB_MONO = FILES
needs_data = pytest.mark.skipif(not all((RAW / f).exists() for f in FILES), reason="NASA images not in data/raw")

@needs_data
def test_four_nasa_images_verified():
    for f, (w, h, kind, mode) in FILES.items():
        info = L.describe(RAW / f)
        assert (info.width, info.height, info.kind, info.color_mode) == (w, h, kind, mode)

@needs_data
@pytest.mark.parametrize("name", [IND, IND_MONO])
def test_largest_pattern_21x11_detected(name):
    r = D.detect(L.load_bgr(RAW / name), 21, 11)
    assert r["success"] and r["num_corners"] == 231

@needs_data
def test_real_geometry_is_measured_and_is_not_a_lens_model():
    r = D.detect(L.load_bgr(RAW / IND), 21, 11)
    g = A.grid_geometry(r)
    assert g["available"]
    # The grid is visibly curved: a planar homography must leave a clearly non-zero residual.
    assert g["homography_residual"]["rms_px"] > 1.0
    assert g["row_straightness_rms_px"] > 1.0
    assert "distortion_coefficients" not in g and "camera_matrix" not in g

@needs_data
def test_combined_panels_are_two_1280_panels_and_right_one_is_f1c1():
    comb = L.load_bgr(RAW / COMB)
    assert PN.find_divider(comb) == (1280, 1285)
    individuals = [(IND, L.load_bgr(RAW / IND)), (IND_MONO, L.load_bgr(RAW / IND_MONO))]
    left, right = PN.analyze(comb, individuals)["panels"]
    assert (left["width"], right["width"]) == (1280, 1280)
    assert left["matches_individual"] is None          # a picture not present as an individual file
    assert right["matches_individual"] is not None      # duplicate of the F1C1 image

@needs_data
def test_second_panel_detects_20x10():
    comb = L.load_bgr(RAW / COMB)
    sub, _ = PN.crop(comb, 0)
    r = D.detect(sub, 20, 10)
    assert r["success"] and r["num_corners"] == 200

@needs_data
def test_real_dataset_cannot_be_calibrated():
    images = L.inventory(RAW).images
    feas = C.assess_images(images, 10)
    assert feas["sufficient_independent_views"] is False and feas["estimates_parameters"] is False
    items = [(IND, L.load_bgr(RAW / IND)), (IND_MONO, L.load_bgr(RAW / IND_MONO))]
    res = C.calibrate(items, 21, 11, None, 10)
    assert res["status"] == "insufficient" and "camera_matrix" not in res
