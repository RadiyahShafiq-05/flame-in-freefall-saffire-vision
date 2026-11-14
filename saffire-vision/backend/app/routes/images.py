from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from ..schemas.image import Dataset, ImageInfo, PanelsResponse
from ..services import image_loader as L, panels as PN
from ..utils import file_handler as F, validators as V

router = APIRouter(prefix="/api", tags=["images"])

@router.get("/dataset", response_model=Dataset)
def dataset():
    """Inventory data/raw and write data/metadata/inventory.json.

    Missing SAFFIRE-1 filenames are listed in `missing_expected_files`. The folder
    may be empty; count is then 0 and the API stays up. Original pixels are not modified.
    """
    ds = L.inventory()
    L.persist(ds)
    return ds

@router.get("/images", response_model=list[ImageInfo])
def images():
    """Image metadata only, without the dataset notes. Same records as `/api/dataset`."""
    return L.inventory().images

@router.get("/images/{image_id}", response_model=ImageInfo)
def image_info(image_id: str):
    """Metadata for one file in data/raw. `image_id` is the filename."""
    try:
        return L.describe(F.resolve(image_id))
    except FileNotFoundError:
        raise HTTPException(404, f"Image '{image_id}' not found")
    except L.InvalidImageError as e:
        raise HTTPException(422, str(e))

@router.get("/images/{image_id}/panels", response_model=PanelsResponse)
def image_panels(image_id: str):
    """Measured panel layout of one image.

    Finds a full-height bright divider, splits the image there, and checks whether each
    panel is pixel-near-identical to an individual file in data/raw. Software does not read
    the camera label burned into the NASA composites, so camera identity is not reported.
    """
    try:
        img = L.load_bgr(F.resolve(image_id))
    except FileNotFoundError:
        raise HTTPException(404, f"Image '{image_id}' not found")
    except L.InvalidImageError as e:
        raise HTTPException(422, str(e))
    individuals = []
    for info in L.inventory().images:
        if info.kind == "individual" and info.filename != image_id:
            try:
                individuals.append((info.filename, L.load_bgr(F.resolve(info.filename))))
            except (FileNotFoundError, L.InvalidImageError):
                continue
    res = PN.analyze(img, individuals)
    notes = ["A panel with no match is a different picture from every individual file present."]
    if res["divider"] is None:
        notes.append("No divider found: the image is treated as one panel.")
    return {"image_id": image_id, "width": img.shape[1], "height": img.shape[0], "notes": notes, **res}

@router.get("/images/{image_id}/file")
def image_file(image_id: str):
    """Bytes of the original file. The response is the image, not JSON."""
    try:
        return FileResponse(F.resolve(image_id))
    except FileNotFoundError:
        raise HTTPException(404, f"Image '{image_id}' not found")

@router.post("/images/upload", status_code=201, response_model=ImageInfo)
async def upload(file: UploadFile = File(...)):
    """Save a new file under data/raw without overwriting an existing name.

    Allowed extensions: jpg, jpeg, png, tif, tiff, bmp. Empty files and files over
    the configured size limit are rejected. An undecodable upload is deleted.
    """
    data = await file.read()
    V.validate_upload(file.filename or "", len(data))
    p = F.save_raw(file.filename, data)
    try:
        return L.describe(p)
    except L.InvalidImageError as e:
        p.unlink(missing_ok=True)
        raise HTTPException(422, str(e))
