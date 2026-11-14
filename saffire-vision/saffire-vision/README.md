# SAFFIRE Vision
Microgravity experiment image calibration & analysis platform: the first module of **Flame in Freefall** (NASA Space Apps 2026), our broader spacecraft fire-safety project. This distortion-grid module is an initial image-analysis component, not a fire-prediction system. Independent project, not endorsed by NASA.

## Overview & motivation
SAFFIRE experiments were imaged by cameras whose optics distort geometry. Quantitative analysis of flame imagery first needs a trustworthy understanding of that distortion. This platform processes SAFFIRE-1 distortion-grid images (not flame data) and is built so flame imagery can be added later.

## Dataset
See [docs/dataset.md](docs/dataset.md). Four SAFFIRE-1 F1C1 grid JPEGs (two 1280×920, two 2565×920 combined). SAFFIRE-II frames and the experiment table were also supplied but are not yet integrated.

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
- The four SAFFIRE-1 images unzipped into `data/raw/` (originals are never modified). They are not committed to git.

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

Run the tests (same activated environment): `python -m pytest`

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
`GET /api/health` · `GET /api/dataset` · `GET /api/images[/{id}]` · `POST /api/images/upload` · `POST /api/analysis/{preprocess,detect-checkerboard,distortion}` · `POST /api/calibration/run` · `GET /api/calibration/status` · `POST /api/reports` · `GET /api/reports/{id}[/download?format=html|json]`. Extras: `GET /api/images/{id}/file`, `GET /api/analysis/history`.

## Example workflow
1. Dataset Explorer: confirm 4 images. 2. Image Analysis: pick the 1280×920 image, try a pattern size, inspect the overlay. 3. Calibration: shows why 4 images can't calibrate; upload ≥10 independent board views to proceed. 4. `POST /api/reports` and download.

## Limitations
- The grid fills the frame; OpenCV needs the full pattern, so only sub-patterns (e.g. 6×4) detect. True grid size and square size are undocumented here and are never assumed.
- Color/mono copies and combined images are not independent views; calibration needs additional images.
- No flame, temperature, or fire-behaviour conclusions. The frontend builds, and its pages and API proxy were smoke-tested over HTTP, but not inspected visually in a browser.

## Future work
Panel separation for combined images; partial-grid (ChArUco/dot) methods; SAFFIRE-II flame frames; experiment-table ingestion; FLEX / BASS-II modules.

## License
MIT (code). NASA data is subject to NASA's terms.
