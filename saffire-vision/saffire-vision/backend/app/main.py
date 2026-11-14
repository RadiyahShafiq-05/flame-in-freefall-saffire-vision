from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import OUT_DETECTED, CORS_ORIGINS
from .routes import images, analysis, calibration, reports
app = FastAPI(title="SAFFIRE Vision API", version="0.1.0",
              description="Image calibration & analysis for NASA SAFFIRE data. Not endorsed by NASA.")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
for r in (images, analysis, calibration, reports): app.include_router(r.router)
app.mount("/outputs/detected", StaticFiles(directory=OUT_DETECTED), name="detected")
@app.get("/api/health", tags=["system"])
def health(): return {"status": "ok"}
