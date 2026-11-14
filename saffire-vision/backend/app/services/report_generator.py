"""Reports contain only values produced by a real run, plus stated limitations."""
import json, uuid, html
from datetime import datetime, timezone
from ..config import OUT_REPORTS
from . import image_loader, camera_calibration, processing_log

_LIMITATIONS = [
    "Distortion-grid images contain no flame or temperature data.",
    "Checkerboard detection and grid geometry say nothing about fire behaviour.",
    "Homography residuals are not camera distortion coefficients.",
    "Pattern size is supplied by the caller and is not a NASA specification stored in this repository.",
    "Calibration parameters appear only when a run actually produced a valid model.",
    "Not endorsed by NASA.",
]

def build(detections=None) -> dict:
    ds = image_loader.inventory()
    rid = uuid.uuid4().hex[:12]
    steps = processing_log.read()[-50:]
    detections = detections or []
    outputs = []
    for det in detections:
        if det.get("overlay_file"):
            outputs.append(f"outputs/detected/{det['overlay_file']}")
    for step in steps:
        if step.get("saved_file"):
            outputs.append(step["saved_file"])
        if step.get("deviation_overlay"):
            outputs.append(f"outputs/detected/{step['deviation_overlay']}")
    rep = {
        "report_id": rid,
        "generated": datetime.now(timezone.utc).isoformat(),
        "dataset": ds.model_dump(),
        "preprocessing": [s for s in steps if s.get("type") == "preprocess"],
        "detections": detections,
        "distortion": [s for s in steps if s.get("type") == "distortion"],
        "calibration": camera_calibration.load_status(),
        "calibration_feasibility": camera_calibration.assess_current_dataset(),
        "output_files": outputs,
        "processing": "OpenCV chessboard detection and pixel geometry on copies. Originals in data/raw are not modified.",
        "limitations": list(_LIMITATIONS),
    }
    OUT_REPORTS.mkdir(parents=True, exist_ok=True)
    (OUT_REPORTS / f"{rid}.json").write_text(json.dumps(rep, indent=2), encoding="utf-8")
    (OUT_REPORTS / f"{rid}.html").write_text(to_html(rep), encoding="utf-8")
    return rep

def to_html(r: dict) -> str:
    e = lambda x: html.escape(str(x))
    rows = "".join(
        f"<tr><td>{e(i['filename'])}</td><td>{i['width']}x{i['height']}</td>"
        f"<td>{e(i.get('color_mode'))}</td><td>{i.get('channels')}</td><td>{e(i.get('kind'))}</td></tr>"
        for i in r["dataset"].get("images", [])
    ) or "<tr><td colspan=5>No images loaded</td></tr>"
    missing = ", ".join(r["dataset"].get("missing_expected_files") or []) or "None"
    prep = "".join(
        f"<li>{e(s.get('image_id'))}: {e(s.get('operation'))} → {e(s.get('saved_file'))}</li>"
        for s in r["preprocessing"]
    ) or "<li>No preprocessing has been run.</li>"
    det = "".join(
        f"<li>{e(d.get('image_id'))}: {'detected' if d.get('success') else 'not detected'}"
        f" ({d.get('num_corners')} corners) — {e(d.get('message'))}</li>"
        for d in r["detections"]
    ) or "<li>No detection has been run.</li>"
    dist = "".join(
        f"<li>{e(s.get('image_id'))} {s.get('cols')}x{s.get('rows')}: "
        f"{e(json.dumps(s.get('geometry'), indent=2))}</li>"
        for s in r["distortion"]
    ) or "<li>No distortion analysis has been run. No residual was inserted.</li>"
    outputs = "".join(f"<li>{e(p)}</li>" for p in r["output_files"]) or "<li>None</li>"
    lim = "".join(f"<li>{e(x)}</li>" for x in r["limitations"])
    feas = r["calibration_feasibility"]
    return f"""<!doctype html><meta charset="utf-8"><title>SAFFIRE Vision report {e(r['report_id'])}</title>
<body style="font-family:sans-serif;background:#0b1220;color:#fff;padding:2rem">
<h1>SAFFIRE Vision report</h1>
<p>Generated {e(r['generated'])}. This report lists operations that were actually run.</p>
<h2>Dataset</h2>
<p>{e(r['dataset'].get('source'))}. Images: {r['dataset'].get('count')}. Missing expected files: {e(missing)}</p>
<table border="1" cellpadding="6"><tr><th>File</th><th>Size</th><th>Mode</th><th>Channels</th><th>Kind</th></tr>{rows}</table>
<h2>Preprocessing</h2><ul>{prep}</ul>
<h2>Checkerboard detection</h2><ul>{det}</ul>
<h2>Grid geometry</h2><ul>{dist}</ul>
<h2>Calibration feasibility</h2>
<p>{e(feas.get('conclusion'))}</p>
<pre>{e(json.dumps(feas, indent=2))}</pre>
<h2>Last calibration run</h2>
<pre>{e(json.dumps(r['calibration'], indent=2))}</pre>
<h2>Output files</h2><ul>{outputs}</ul>
<h2>Processing</h2><p>{e(r['processing'])}</p>
<h2>Limitations</h2><ul>{lim}</ul>
</body>"""

def path(rid: str, ext="json"):
    p = OUT_REPORTS / f"{''.join(c for c in rid if c.isalnum())}.{ext}"
    return p if p.is_file() else None
