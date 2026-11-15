import json
import uuid
from pathlib import Path
import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response, JSONResponse
from ..config import METADATA, OUT_DETECTED, OUT_FLAME
from ..schemas.analysis import (
    PreprocessRequest, DetectRequest, DistortionRequest, DetectionResponse, DistortionResponse,
    PreprocessJsonResponse, PreprocessComparisonRequest,
)
from ..services import image_loader as L, preprocessing as P, checkerboard_detector as D, distortion_analyzer as A
from ..services import processing_log, panels as PN, preprocess_comparison as PC, flame_frame as FF
from ..utils import file_handler as F, imageio, validators as V

router = APIRouter(prefix="/api/analysis", tags=["analysis"])
HISTORY = METADATA / "history.json"
_GEOMETRY_OMIT = {"per_corner_residual_px", "projected_corners"}

def _img(image_id, panel=None):
    """Load an image; with `panel`, return only that panel of a side-by-side composite."""
    try:
        img = L.load_bgr(F.resolve(image_id))
    except FileNotFoundError:
        raise HTTPException(404, f"Image '{image_id}' not found")
    except L.InvalidImageError as e:
        raise HTTPException(422, str(e))
    if panel is None:
        return img, 0
    try:
        return PN.crop(img, panel)
    except IndexError as e:
        raise HTTPException(422, str(e))

def _suffix(panel):
    return "" if panel is None else f"_panel{panel}"

def _log(entry):
    h = json.loads(HISTORY.read_text(encoding="utf-8")) if HISTORY.exists() else []
    h.append(entry)
    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    HISTORY.write_text(json.dumps(h[-200:], indent=2), encoding="utf-8")

@router.post(
    "/preprocess",
    responses={200: {
        "content": {"image/png": {}, "application/json": {"schema": PreprocessJsonResponse.model_json_schema()}},
        "description": "Default: PNG of the processed copy (header X-Processed-File = saved path). "
                       "With response_format=json: JSON with output_url.",
    }},
)
def preprocess(req: PreprocessRequest):
    """Run one preprocessing operation and save the copy under data/processed/.

    The body is image/png by default so the existing frontend can read it as a blob.
    Send `response_format: "json"` to get metadata and an `output_url` instead.
    `operation=pipeline` uses `grayscale`, `apply_denoise`, and `apply_contrast`.
    The other operations ignore those three flags and keep their previous behaviour.
    """
    try:
        out = P.apply(
            req.operation, _img(req.image_id)[0], req.max_dim,
            gaussian_ksize=req.gaussian_ksize, gaussian_sigma=req.gaussian_sigma, clahe_clip=req.clahe_clip,
            grayscale=req.grayscale, apply_denoise=req.apply_denoise, apply_contrast=req.apply_contrast,
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    ok, buf = cv2.imencode(".png", out)
    if not ok:
        raise HTTPException(500, "Could not encode the processed image")
    saved = P.save_processed(out, req.image_id, req.operation)
    rel = P.relative_output(saved)
    processing_log.append({
        "type": "preprocess",
        "image_id": req.image_id,
        "operation": req.operation,
        "parameters": req.model_dump(exclude={"image_id"}),
        "saved_file": rel,
    })
    if req.response_format == "json":
        h, w = out.shape[:2]
        return JSONResponse(PreprocessJsonResponse(
            image_id=req.image_id, operation=req.operation, saved_file=rel,
            output_url=f"/outputs/processed/{saved.name}", width=w, height=h,
            channels=1 if out.ndim == 2 else out.shape[2],
        ).model_dump())
    return Response(buf.tobytes(), media_type="image/png", headers={"X-Processed-File": rel})

@router.post("/detect-checkerboard", response_model=DetectionResponse)
def detect(req: DetectRequest):
    """Detect a caller-supplied inner-corner pattern and save an overlay when it succeeds.

    `square_size_mm` is stored on the response and is not used to scale the image.
    A miss returns success=false and an empty corner list.
    """
    img, x_off = _img(req.image_id, req.panel)
    r = D.detect(img, req.cols, req.rows, req.use_sb)
    r["image_id"] = req.image_id
    r["square_size_mm"] = req.square_size_mm
    r["overlay_file"] = None
    r["panel"] = req.panel
    r["panel_x_offset"] = None if req.panel is None else x_off
    if r["success"]:
        name = f"{Path(req.image_id).stem}{_suffix(req.panel)}_{req.cols}x{req.rows}.png"
        if imageio.imwrite(OUT_DETECTED / name, D.draw(img, r)):
            r["overlay_file"] = name
    if req.square_size_mm is not None:
        r["message"] += " square_size_mm was recorded and was not applied."
    _log({k: r[k] for k in ("image_id", "success", "pattern", "num_corners", "message", "overlay_file", "panel")})
    return r

@router.post("/distortion", response_model=DistortionResponse, response_model_exclude_none=True)
def distortion(req: DistortionRequest):
    """Measure pixel geometry of a detected grid and compare it with an ideal planar grid.

    When detection fails, geometry.available is false and no residual is returned.
    The overlay is a drawing of the computed residuals, saved under outputs/detected/.
    """
    img, _ = _img(req.image_id, req.panel)
    det = D.detect(img, req.cols, req.rows)
    geo = A.grid_geometry(det)
    overlay_name = None
    if geo.get("available") and geo.get("projected_corners") is not None:
        vis = A.draw_deviations(img, det, geo)
        candidate = f"{Path(req.image_id).stem}{_suffix(req.panel)}_{req.cols}x{req.rows}_deviation.png"
        if imageio.imwrite(OUT_DETECTED / candidate, vis):
            overlay_name = candidate
            geo["deviation_overlay"] = candidate
    summary = {k: v for k, v in geo.items() if k not in _GEOMETRY_OMIT}
    processing_log.append({
        "type": "distortion",
        "image_id": req.image_id,
        "panel": req.panel,
        "cols": req.cols,
        "rows": req.rows,
        "detection_success": det["success"],
        "geometry": summary,
        "deviation_overlay": overlay_name,
    })
    return {"image_id": req.image_id, "panel": req.panel, "detection_success": det["success"], "geometry": geo}

@router.post("/preprocess-comparison")
def preprocess_comparison(req: PreprocessComparisonRequest):
    """Compare one pattern on the original and on saved grayscale, contrast, and denoise copies.

    Missing copies are reported and are not created by this request. The statement says
    preprocessing did not change detection only when corner count and residual
    RMS match. It uses the word improvement only when a number changes in the
    favorable direction.
    """
    try:
        F.resolve(req.image_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Image '{req.image_id}' not found")
    try:
        result = PC.compare(req.image_id, req.cols, req.rows)
    except L.InvalidImageError as e:
        raise HTTPException(422, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    processing_log.append({"type": "preprocess_comparison", **result})
    return result

@router.post("/flame-frame")
async def flame_frame(
    file: UploadFile = File(...),
    experiment_name: str = Form(...),
    source: str = Form(...),
):
    """Mark flame-colored pixels in one uploaded still and report their area.

    The numbers are an approximate visual detection. They are not a validated
    fire measurement, a temperature, or a size in millimetres. A poster that
    already contains several flames is measured as that one file.
    """
    experiment_name = experiment_name.strip()
    source = source.strip()
    if not experiment_name or not source:
        raise HTTPException(422, "Experiment name and source are required")
    if len(experiment_name) > 200 or len(source) > 500:
        raise HTTPException(422, "Experiment name or source is too long")
    data = await file.read()
    V.validate_upload(file.filename or "", len(data))
    bgr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(422, "The file is not a readable color image")
    try:
        found = FF.detect(bgr)
    except ValueError as e:
        raise HTTPException(422, str(e))
    folder = OUT_FLAME / uuid.uuid4().hex[:12]
    folder.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(folder / "original.png"), bgr)
    cv2.imwrite(str(folder / "overlay.png"), FF.overlay_bgra(found["mask"]))
    cv2.imwrite(str(folder / "processed.png"), FF.composite(bgr, found["mask"]))
    result = {
        "experiment_name": experiment_name,
        "source": source,
        "filename": Path(file.filename or "upload").name,
        "width": found["width"],
        "height": found["height"],
        "flame_pixels": found["flame_pixels"],
        "image_pixels": found["image_pixels"],
        "coverage_percent": found["coverage_percent"],
        "label": found["label"],
        "original_url": f"/outputs/flame/{folder.name}/original.png",
        "overlay_url": f"/outputs/flame/{folder.name}/overlay.png",
        "processed_url": f"/outputs/flame/{folder.name}/processed.png",
    }
    processing_log.append({"type": "flame_frame", "image_id": result["filename"], **result})
    return result

@router.get("/history")
def history():
    """Detection runs only. Each item has image_id, success, pattern, num_corners, and message."""
    if not HISTORY.exists():
        return []
    return json.loads(HISTORY.read_text(encoding="utf-8"))

@router.get("/log")
def log():
    """Preprocessing and distortion runs, oldest first. Detection stays on /history."""
    return processing_log.read()
