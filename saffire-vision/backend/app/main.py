from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import OUT_DETECTED, PROCESSED, CORS_ORIGINS
from .routes import images, analysis, calibration, reports

app = FastAPI(
    title="SAFFIRE Vision API",
    version="0.2.0",
    description=(
        "Image inspection, checkerboard detection, pixel-geometry analysis, and camera-calibration "
        "feasibility for NASA SAFFIRE-1 distortion grids. This service does not detect flames or "
        "estimate temperature. It is not endorsed by NASA. "
        "Interactive request and response schemas are on this page; a narrative contract is in docs/backend_api.md."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Processed-File"],
)
for r in (images, analysis, calibration, reports):
    app.include_router(r.router)
app.mount("/outputs/detected", StaticFiles(directory=OUT_DETECTED), name="detected")
app.mount("/outputs/processed", StaticFiles(directory=PROCESSED), name="processed")

@app.get("/api/health", tags=["system"])
def health():
    """Liveness check. The body is exactly {\"status\": \"ok\"} and does not report analysis results."""
    return {"status": "ok"}
