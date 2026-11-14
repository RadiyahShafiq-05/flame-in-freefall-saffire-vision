import json, uuid, html
from datetime import datetime, timezone
from ..config import OUT_REPORTS
from . import image_loader, camera_calibration

def build(detections=None) -> dict:
    ds = image_loader.inventory(); rid = uuid.uuid4().hex[:12]
    rep = {"report_id": rid, "generated": datetime.now(timezone.utc).isoformat(),
           "dataset": ds.model_dump(), "detections": detections or [],
           "calibration": camera_calibration.load_status(),
           "processing": "OpenCV chessboard detection; originals never modified.",
           "limitations": ["Distortion-grid images contain no flame or temperature data.",
                           "Checkerboard detection says nothing about fire behaviour.",
                           "Not endorsed by NASA.",
                           "Calibration is reported only when enough independent views exist."]}
    (OUT_REPORTS / f"{rid}.json").write_text(json.dumps(rep, indent=2))
    (OUT_REPORTS / f"{rid}.html").write_text(to_html(rep))
    return rep

def to_html(r: dict) -> str:
    e = lambda x: html.escape(str(x))
    rows = "".join(f"<tr><td>{e(i['filename'])}</td><td>{i['width']}x{i['height']}</td><td>{e(i['color_mode'])}</td><td>{e(i['kind'])}</td></tr>" for i in r["dataset"]["images"])
    det = "".join(f"<li>{e(d.get('image_id'))}: {'success' if d['success'] else 'failed'} ({d['num_corners']} corners) - {e(d['message'])}</li>" for d in r["detections"]) or "<li>None run</li>"
    lim = "".join(f"<li>{e(x)}</li>" for x in r["limitations"])
    return f"""<!doctype html><meta charset=utf-8><title>SAFFIRE Vision report {e(r['report_id'])}</title>
<body style="font-family:sans-serif;background:#0b1220;color:#fff;padding:2rem"><h1>SAFFIRE Vision report</h1>
<p>Generated {e(r['generated'])}</p><h2>Dataset</h2><table border=1 cellpadding=6><tr><th>File</th><th>Size</th><th>Mode</th><th>Kind</th></tr>{rows}</table>
<h2>Detection</h2><ul>{det}</ul><h2>Calibration</h2><pre>{e(json.dumps(r['calibration'], indent=2))}</pre>
<h2>Processing</h2><p>{e(r['processing'])}</p><h2>Limitations</h2><ul>{lim}</ul></body>"""

def path(rid: str, ext="json"):
    p = OUT_REPORTS / f"{''.join(c for c in rid if c.isalnum())}.{ext}"
    return p if p.is_file() else None
