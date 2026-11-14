# Architecture
```
Next.js (3000) --REST--> FastAPI (8000) --> services/ --> data/raw (read-only originals)
                                                     --> data/processed (derived copies)
                                                     --> data/metadata (JSON: inventory, calibration, history, processing log)
                                                     --> outputs/detected (corner overlays, deviation drawings)
                                                     --> outputs/reports (JSON and HTML)
```
Routes are thin; logic lives in `services/`. To add a module (e.g. flame segmentation for SAFFIRE-II, FLEX, BASS-II): add `services/<name>.py`, a schema, and a router registered in `main.py`. No flame prediction is implemented.
