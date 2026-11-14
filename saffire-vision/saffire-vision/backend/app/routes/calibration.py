from fastapi import APIRouter, HTTPException
from ..schemas.analysis import CalibrationRequest
from ..services import camera_calibration as C, image_loader as L
from ..utils import file_handler as F
router = APIRouter(prefix="/api/calibration", tags=["calibration"])

@router.post("/run")
def run(req: CalibrationRequest):
    items = []
    for i in req.image_ids:
        try: items.append((i, L.load_bgr(F.resolve(i))))
        except FileNotFoundError: raise HTTPException(404, f"Image '{i}' not found")
        except L.InvalidImageError as e: raise HTTPException(422, str(e))
    if not items: raise HTTPException(422, "No images supplied")
    return C.calibrate(items, req.cols, req.rows, req.square_size_mm, req.min_views)

@router.get("/status")
def status(): return C.load_status()
