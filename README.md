# Flame in Freefall · SAFFIRE Vision

SAFFIRE Vision explores NASA SAFFIRE and PSI microgravity combustion data for the Flame in Freefall Space Apps challenge. The app lives in [`saffire-vision`](saffire-vision/).

It checks the four SAFFIRE-1 distortion grids, lists 24 PSI combustion investigations, shows an unreviewed fire-safety reading of each record, and can mark flame-colored pixels in one uploaded still. It does not predict fire, estimate temperature, or publish a camera matrix from this dataset. The grids are not flame frames, and calibration stays blocked until one camera has at least 10 independent views.

Setup, the API, and the data limits are in [saffire-vision/README.md](saffire-vision/README.md).

```powershell
cd saffire-vision\backend
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

```powershell
cd saffire-vision\frontend
npm install
npm run dev
```

Open http://127.0.0.1:3000. The API is http://127.0.0.1:8000.

Do not commit `.env`. NASA data follows NASA's terms. The code is MIT.
