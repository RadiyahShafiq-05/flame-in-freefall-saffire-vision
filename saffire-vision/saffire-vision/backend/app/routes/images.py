from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from ..services import image_loader as L
from ..utils import file_handler as F, validators as V
router = APIRouter(prefix="/api", tags=["images"])

@router.get("/dataset")
def dataset(): return L.inventory()

@router.get("/images")
def images(): return L.inventory().images

@router.get("/images/{image_id}")
def image_info(image_id: str):
    try: return L.describe(F.resolve(image_id))
    except FileNotFoundError: raise HTTPException(404, f"Image '{image_id}' not found")

@router.get("/images/{image_id}/file")
def image_file(image_id: str):
    try: return FileResponse(F.resolve(image_id))
    except FileNotFoundError: raise HTTPException(404, f"Image '{image_id}' not found")

@router.post("/images/upload", status_code=201)
async def upload(file: UploadFile = File(...)):
    data = await file.read()
    V.validate_upload(file.filename or "", len(data))
    p = F.save_raw(file.filename, data)
    try: return L.describe(p)
    except L.InvalidImageError as e:
        p.unlink(missing_ok=True); raise HTTPException(422, str(e))
