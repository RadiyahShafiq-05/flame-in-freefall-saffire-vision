import pytest
from app import config
from app.services import image_loader as L
FILES = {"SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg": (1280, 920, "individual"),
         "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg": (1280, 920, "individual"),
         "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg": (2565, 920, "combined"),
         "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_mono.jpg": (2565, 920, "combined")}
@pytest.mark.skipif(not all((config.ROOT / "data/raw" / f).exists() for f in FILES), reason="NASA images not in data/raw")
def test_four_nasa_images_verified():
    for f, (w, h, kind) in FILES.items():
        info = L.describe(config.ROOT / "data/raw" / f)
        assert (info.width, info.height, info.kind) == (w, h, kind)
