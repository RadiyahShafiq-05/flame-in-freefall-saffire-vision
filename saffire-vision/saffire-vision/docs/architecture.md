# Architecture
```
Next.js (3000) --REST--> FastAPI (8000) --> services/ --> data/raw (read-only originals)
                                                     --> data/metadata (JSON: calibration, history)
                                                     --> outputs/ (overlays, reports)
```
Routes are thin; logic lives in `services/`. To add a module (e.g. flame segmentation for SAFFIRE-II, FLEX, BASS-II): add `services/<name>.py`, a schema, and a router registered in `main.py`. No flame prediction is implemented.
