# SAFFIRE Vision
Microgravity experiment image calibration & analysis platform: the first module of **Flame in Freefall** (NASA Space Apps 2026), our broader spacecraft fire-safety project. This distortion-grid module is an initial image-analysis component, not a fire-prediction system. Independent project, not endorsed by NASA.

## Overview & motivation
SAFFIRE experiments were imaged by cameras whose optics distort geometry. Quantitative analysis of flame imagery first needs a trustworthy understanding of that distortion. This platform processes SAFFIRE-1 distortion-grid images (not flame data) and is built so flame imagery can be added later.

## Dataset
See [docs/dataset.md](docs/dataset.md). Four SAFFIRE-1 F1C1 grid JPEGs (two 1280×920, two 2565×920 combined). Each combined image holds two 1280-px panels; one is the F1C1 image again, the other appears to be camera F1C2 (label read by eye). SAFFIRE-II frames and the experiment table were also supplied but are not yet integrated.

## Objectives
Inspect images; detect checkerboard corners; report observable grid geometry; calibrate and undistort **only** when valid; produce honest reports.

## Features
Dataset inventory · preprocessing · configurable chessboard detection with subpixel refinement · geometry stats · OpenCV calibration with input validation · JSON/HTML reports · dashboard UI.

## Stack
Python 3.11+, FastAPI, OpenCV, NumPy, Pillow, Pandas, Pydantic · Next.js, React, TypeScript, Tailwind, Recharts · Pytest. No GPU.

## Research gap
Stated as a hypothesis to validate, not a finding; see [docs/research_gap.md](docs/research_gap.md).

## Setup and run locally (Windows 10/11)

### Prerequisites
- **Python 3.11+** ([python.org](https://www.python.org/downloads/); tick "Add python.exe to PATH"). Check: `py -3.11 --version`
- **Node.js 18+** with npm ([nodejs.org](https://nodejs.org/)). Check: `node --version`
- The four SAFFIRE-1 images unzipped into `data/raw/` (originals are never modified). They are not committed to git. Unzip `SAFFIRE-1_F1C1_DistortionGrids_1280x920_originals.zip` and copy the four `.jpg` files into `data/raw/` with their names unchanged. If they are missing the API still starts: `GET /api/dataset` returns `count: 0` and lists the missing names, and the real-data tests are skipped.

You will need **two PowerShell windows**: one for the backend, one for the frontend.

### 1. Backend (FastAPI), terminal 1
```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```
If activation is blocked, run `Set-ExecutionPolicy -Scope Process Bypass` first, then activate again.

The API runs at http://127.0.0.1:8000, with interactive Swagger docs at http://127.0.0.1:8000/docs. Check it with http://127.0.0.1:8000/api/health, which should return `{"status":"ok"}`.

Run the tests (same activated environment, from `backend/`): `python -m pytest`. Tests that need the NASA images are skipped when they are not in `data/raw/`.

With the backend running and the images in `data/raw/`, an end-to-end check over real HTTP (from the project root): `python scripts/smoke_test.py`. It prints each endpoint's result and writes overlays and a report under `outputs/`.

### 2. Frontend (Next.js), terminal 2
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:3000. For a production build instead: `npm run build`, then `npm start`.

### How the two connect
The browser only talks to Next.js. Requests to `/api/*` and `/outputs/*` are proxied to the backend at `BACKEND_URL` (default `http://127.0.0.1:8000`), so no extra configuration is needed when both run on their default ports. If the frontend shows "Backend unreachable", confirm terminal 1 is running.

### Optional configuration
Defaults work out of the box. To override, set environment variables in the terminal before starting each process (see `.env.example` for all names), for example:
```powershell
$env:BACKEND_PORT = "8001"      # backend terminal, before python run.py
$env:BACKEND_URL = "http://127.0.0.1:8001"   # frontend terminal, before npm run dev
```
`CORS_ORIGINS` (backend) is only needed if a browser calls the backend directly rather than through the Next.js proxy.

## API
`GET /api/health` · `GET /api/dataset` · `GET /api/images[/{id}]` · `GET /api/images/{id}/panels` · `POST /api/images/upload` · `POST /api/analysis/{preprocess,detect-checkerboard,distortion}` · `POST /api/calibration/run` · `GET /api/calibration/status` · `POST /api/reports` · `GET /api/reports/{id}[/download?format=html|json]`. Extras: `GET /api/images/{id}/file`, `GET /api/images/{id}/panels`, `GET /api/analysis/history`. Detection and distortion accept an optional `panel`; preprocess accepts `response_format: "json"`.

Request and response fields, error bodies, and the PNG preprocess contract are in [docs/backend_api.md](docs/api.md). `POST /api/analysis/preprocess` returns `image/png` (header `X-Processed-File`) by default because the frontend reads a blob; `response_format: "json"` returns metadata and an `output_url`. Other analysis endpoints return JSON. Additive fields (`channels`, `missing_expected_files`, `homography_residual`, `feasibility`) do not remove the fields the current frontend reads.

## Example workflow
1. Dataset Explorer: confirm 4 images. 2. Image Analysis: pick the 1280×920 image, use pattern 21×11 (20×10 for the left panel of a combined image), inspect the overlay. 3. Calibration: shows why 4 images can't calibrate; upload ≥10 independent board views to proceed. 4. `POST /api/reports` and download.

## Limitations
- The grid fills the frame; OpenCV needs the whole pattern, so only the central region detects (21×11 on F1C1, 20×10 on the left panel of the combined images). The true board size and square size are undocumented here and are never assumed. A homography residual on a partial pattern is not a camera model.
- Color/mono copies and the right panel of the combined images are duplicates of the F1C1 image. The left panel appears to be a different camera (F1C2). Calibration is not possible with this data: no camera has more than one view.
- No flame, temperature, or fire-behaviour conclusions. The backend was tested on Linux; the Windows start-up has not been run on Windows by the author of this change. The frontend was not touched or run.

## Future work
Panel separation for combined images; partial-grid (ChArUco/dot) methods; SAFFIRE-II flame frames; experiment-table ingestion; FLEX / BASS-II modules.

## License
MIT (code). NASA data is subject to NASA's terms.
