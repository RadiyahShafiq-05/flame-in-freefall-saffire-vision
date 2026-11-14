from fastapi import APIRouter, HTTPException
from ..schemas.analysis import CalibrationRequest, CalibrationResponse
from ..services import camera_calibration as C, image_loader as L
from ..utils import file_handler as F

router = APIRouter(prefix="/api/calibration", tags=["calibration"])

@router.post("/run", response_model=CalibrationResponse, response_model_exclude_none=True)
def run(req: CalibrationRequest):
    """Calibrate only when the request has enough qualifying, detectable views.

    Color/mono pairs, combined composites, mixed resolutions, and too few views
    return status `insufficient` and no camera matrix. A `valid` result is produced
    by cv2.calibrateCamera and includes the RMS reprojection error.
    `feasibility` is a filename check and never contains parameters.
    """
    items = []
    for image_id in req.image_ids:
        try:
            items.append((image_id, L.load_bgr(F.resolve(image_id))))
        except FileNotFoundError:
            raise HTTPException(404, f"Image '{image_id}' not found")
        except L.InvalidImageError as e:
            raise HTTPException(422, str(e))
    result = C.calibrate(items, req.cols, req.rows, req.square_size_mm, req.min_views)
    result["feasibility"] = C.assess_current_dataset(req.min_views)
    return result

@router.get("/status", response_model=CalibrationResponse, response_model_exclude_none=True)
def status():
    """Last saved calibration run, or status `not_run`, plus the current feasibility check.

    Feasibility looks at files in data/raw. It does not create a camera matrix.
    Parameter fields are present only when a previous run stored a valid model.
    """
    saved = C.load_status()
    saved["feasibility"] = C.assess_current_dataset()
    return saved
