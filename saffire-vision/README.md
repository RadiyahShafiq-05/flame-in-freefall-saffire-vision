# SAFFIRE Vision

SAFFIRE Vision is the working app for **Flame in Freefall**, a NASA Space Apps Challenge 2026 project about spacecraft fire safety. It reads NASA Physical Sciences Informatics (PSI) combustion records and checks the SAFFIRE-1 camera grids that were actually supplied.

This is an independent project. It is not a NASA product and is not endorsed by NASA.

The app does not predict fire behaviour, estimate temperature, or invent a camera model. Every number on screen is either copied from a NASA file or calculated from one. When a value is missing, the screen says it is not available.

## What you can do

| Screen | What it shows |
|---|---|
| Overview | Whether the four grids, the latest preprocessing check, and calibration are usable |
| Dataset Explorer | The four SAFFIRE-1 distortion-grid images, including the combined composites |
| Image Analysis | Preprocessing, a before/after corner comparison, checkerboard detection, and pixel geometry |
| Camera Calibration | Why these images cannot calibrate a camera. No camera matrix is saved |
| Reports | HTML and JSON reports of the checks above |
| Combustion Investigations | 24 PSI combustion investigations, with test conditions and publications |
| Research Assistant | Evidence-grounded questions over indexed NASA sources, with citations and passage-only fallback |
| Fire Safety Insights | A reading of each PSI record for habitat fire safety. Written by the model, not yet reviewed, and not a measured burn result |
| Flame Frames | Flame-colored pixels in one uploaded color still. Pixel count and percent of the image only |
| About | How this module fits the challenge |

## What this dataset can support

The four files in `data/raw/` are SAFFIRE-1 distortion grids, not flame frames.

- F1C1 color and F1C1 mono are two copies of one scene. They count as one camera view.
- Each combined image is two panels. One panel matches F1C1. The other looks like F1C2. The camera name on that panel was read from the picture, not from a verified label file.
- The largest detected pattern is 21×11 (231 corners) on F1C1 and 20×10 on the other panel. The board continues outside the frame, so this is a partial region. The true grid size is not known.
- Square size in millimetres is not confirmed, so geometry stays in pixels. Residual RMS is a fit of that partial pattern, not a camera model.
- OpenCV calibration needs at least 10 independent views of one camera. These files do not provide that, so calibration stays blocked and no camera matrix is written.

Preprocessing is compared with the original on the same 21×11 pattern. A step counts as an improvement only when it finds more corners, or the same corners with residual RMS lower by more than 0.01 px. On the current F1C1 color image, grayscale matches the original. Contrast and denoise find no corners.

## Flame Frames

Flame Frames is a color rule on one uploaded still. It marks warm, red, and blue flame-colored pixels, and white-hot pixels only when they sit next to that color. Green illumination is left out. The result is flame pixels, image pixels, and coverage percent.

The label on the page is the limit of the tool: **approximate visual detection, not a validated fire measurement.** It does not report millimetres or temperature. A poster that contains many flames is one measurement of the whole file, not a time series. Dim flames, bright rooms, smoke, char, and objects of a similar color can be missed or marked by mistake.

## Fire Safety Insights

The investigation pages and the Fire Safety Insights page use `frontend/public/data/investigations.json` and `frontend/public/data/insights.json`.

The investigation catalogue is built from PSI combustion records: objectives, methods, test-condition tables, and publications. Oxygen in an inverse-flame burner stream is kept separate from the air around the sample.

Each insight restates those PSI aims and methods in fire-safety language. The file is marked not yet reviewed. It is not a measured result from a burn. Regenerating it needs a `GEMINI_API_KEY` in a local `.env` file, which is never committed:

```powershell
cd frontend
$env:GEMINI_API_KEY = "<your key>"
node scripts/generate-insights.mjs
```

The checked-in `insights.json` is enough to run the pages. You do not need a key unless you want to rewrite the insights.

## Research Assistant

The Research Assistant searches the indexed PSI investigation records, publication titles, NASA's 2015 Researcher's Guide entries, and the challenge background. Answers show numbered evidence citations and uncertainty notes. It does not index publication abstracts or full text, raw experiment files, images, or videos.

Without a Gemini key, the assistant returns matching passages only. With `GEMINI_API_KEY`, it uses Gemini `gemini-2.5-flash`; the model receives only the retrieved passages, and unsupported citations or numeric claims are removed before the answer is shown.

Set the optional key in the same PowerShell window used to start the backend:

```powershell
$env:GEMINI_API_KEY = "<your key>"
$env:ASSISTANT_MODEL = "gemini-2.5-flash"
python run.py
```

The backend does not load `.env` automatically. Keep real keys in the local, gitignored `.env` file or process environment; never commit them. The research endpoints are `POST /api/research/ask`, `GET /api/research/documents`, and `POST /api/research/summarize`.

## Stack

Python 3.11 or newer, FastAPI, OpenCV (headless), NumPy, Pillow, Pandas, Pydantic, Pytest, httpx. Next.js 14, React 18, TypeScript, Tailwind, Recharts. No GPU.

## Run locally on Windows

You need Python 3.11+ and Node.js 18+. Use two PowerShell windows. Commands below start in this `saffire-vision` folder.

### Backend

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

If activation is blocked, run `Set-ExecutionPolicy -Scope Process Bypass` in that window, then activate again.

The API is at http://127.0.0.1:8000. Swagger is at http://127.0.0.1:8000/docs. http://127.0.0.1:8000/api/health should return `{"status":"ok"}`.

From `backend/` with the virtual environment active:

```powershell
python -m pytest
```

From this folder, with the API already running:

```powershell
python scripts/smoke_test.py
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:3000. The browser talks only to Next.js. `/api` and `/outputs` are proxied to `BACKEND_URL` (default `http://127.0.0.1:8000`).

Copy `.env.example` to `.env` only when you need to change a port or add a model key. `.env` is gitignored.

## API

- `GET /api/health`
- `GET /api/dataset`
- `GET /api/images`, `GET /api/images/{id}`, `GET /api/images/{id}/file`, `GET /api/images/{id}/panels`
- `POST /api/images/upload`
- `POST /api/analysis/preprocess`
- `POST /api/analysis/preprocess-comparison`
- `POST /api/analysis/detect-checkerboard`
- `POST /api/analysis/distortion`
- `POST /api/analysis/flame-frame`
- `GET /api/analysis/history`, `GET /api/analysis/log`
- `POST /api/calibration/run`, `GET /api/calibration/status`
- `POST /api/reports`, `GET /api/reports`, `GET /api/reports/{id}`, `GET /api/reports/{id}/download?format=html|json`

Field notes are in [docs/backend_api.md](docs/backend_api.md). Dataset measurements are in [docs/dataset.md](docs/dataset.md).

## What is not in git

`.env`, the Python virtual environment, `node_modules`, `.next`, generated `outputs/`, `data/processed/`, `data/metadata/`, and the downloaded `Nasa_Space_Data/` text dump. The app serves the built catalogue in `frontend/public/data/` instead of that dump.

The four SAFFIRE-1 grid JPEGs are included under `data/raw/` so the app runs after clone. Do not edit their pixels. Other originals stay out of git.

## Use of SI tools

- **Fire Safety Insights text:** written by Google Gemini models (`gemini-4-hydrogen` for 21 investigations, `gemini-3.8-flash` for 3) through the Gemini API in Google AI Studio, from PSI record text only. `scripts/generate-insights.mjs` removes any statement that cites no source passage, or uses a number its cited passages do not contain. One more statement was removed by hand as unsupported. The team has not yet reviewed the rest, and the app labels every insight as written by SI.
- **Frontend code:** written with Claude (Anthropic) in Claude Code, including the insight generator script. The team directed the work and reviewed each change before merging.
- **Research Assistant answers:** when `GEMINI_API_KEY` is set, the backend sends the retrieved passages to Google Gemini (`gemini-2.5-flash`), and unsupported citations or numbers are removed before an answer is shown. Without a key it returns the passages only.
- **Backend code:** the Research Assistant was written with GitHub Copilot, and the flame-frame check with Cursor, as their commits record.
- **Not SI:** the Moon-base test counts, test-condition ranges, grid checks and flame-pixel marking are computed directly from NASA data, with no SI model involved.

## License

Code is MIT. See [LICENSE](LICENSE). NASA data follows NASA's terms. SAFFIRE-I on PSI is CC0-1.0, DOI [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43).
