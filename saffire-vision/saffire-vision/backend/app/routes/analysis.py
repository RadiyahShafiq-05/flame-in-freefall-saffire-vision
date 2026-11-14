import json, cv2
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from ..config import METADATA, OUT_DETECTED
from ..schemas.analysis import PreprocessRequest, DetectRequest, DistortionRequest
from ..services import image_loader as L, preprocessing as P, checkerboard_detector as D, distortion_analyzer as A
from ..utils import file_handler as F
router = APIRouter(prefix="/api/analysis", tags=["analysis"])
HISTORY = METADATA / "history.json"

def _img(image_id):
    try: return L.load_bgr(F.resolve(image_id))
    except FileNotFoundError: raise HTTPException(404, f"Image '{image_id}' not found")
    except L.InvalidImageError as e: raise HTTPException(422, str(e))

def _log(entry):
    h = json.loads(HISTORY.read_text()) if HISTORY.exists() else []
    h.append(entry); HISTORY.write_text(json.dumps(h[-200:], indent=2))

@router.post("/preprocess")
def preprocess(req: PreprocessRequest):
    out = P.apply(req.operation, _img(req.image_id), req.max_dim)
    ok, buf = cv2.imencode(".png", out)
    return Response(buf.tobytes(), media_type="image/png")

@router.post("/detect-checkerboard")
def detect(req: DetectRequest):
    img = _img(req.image_id)
    r = D.detect(img, req.cols, req.rows, req.use_sb)
    r["image_id"] = req.image_id; r["square_size_mm"] = req.square_size_mm
    r["overlay_file"] = None
    if r["success"]:
        name = f"{req.image_id}_{req.cols}x{req.rows}.png"
        cv2.imwrite(str(OUT_DETECTED / name), D.draw(img, r)); r["overlay_file"] = name
    _log({k: r[k] for k in ("image_id", "success", "pattern", "num_corners", "message")})
    return r

@router.post("/distortion")
def distortion(req: DistortionRequest):
    r = D.detect(_img(req.image_id), req.cols, req.rows)
    return {"image_id": req.image_id, "detection_success": r["success"], "geometry": A.grid_geometry(r)}

@router.get("/history")
def history(): return json.loads(HISTORY.read_text()) if HISTORY.exists() else []
