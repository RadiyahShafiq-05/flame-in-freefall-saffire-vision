import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from ..config import OUT_REPORTS
from ..services import report_generator as R
from .analysis import history
router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.post("", status_code=201)
def create(): return R.build(history()[-20:])

@router.get("")
def list_reports(): return sorted(p.stem for p in OUT_REPORTS.glob("*.json"))

@router.get("/{report_id}")
def get(report_id: str):
    p = R.path(report_id)
    if not p: raise HTTPException(404, "Report not found")
    return json.loads(p.read_text())

@router.get("/{report_id}/download")
def download(report_id: str, format: str = "html"):
    if format not in ("html", "json"): raise HTTPException(422, "format must be html or json")
    p = R.path(report_id, format)
    if not p: raise HTTPException(404, "Report not found")
    return FileResponse(p, filename=f"saffire-report-{report_id}.{format}")
