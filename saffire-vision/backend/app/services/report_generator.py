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
    logged = processing_log.read()
    steps = logged[-50:]
    comparison = next((s for s in reversed(logged) if s.get("type") == "preprocess_comparison"), None)
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
        "preprocess_comparison": comparison,
    }
    OUT_REPORTS.mkdir(parents=True, exist_ok=True)
    (OUT_REPORTS / f"{rid}.json").write_text(json.dumps(rep, indent=2), encoding="utf-8")
    (OUT_REPORTS / f"{rid}.html").write_text(to_html(rep), encoding="utf-8")
    return rep

def _num(value, digits=2):
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return None

def _distortion_item(step: dict) -> str:
    """One measured grid, in words. Omits corner arrays and does not invent a residual."""
    e = lambda x: html.escape(str(x))
    geometry = step.get("geometry") or {}
    panel = step.get("panel")
    where = f"{e(step.get('image_id'))} {e(step.get('cols'))}x{e(step.get('rows'))}"
    if panel is not None:
        where += f", panel {e(panel)}"
    if not geometry.get("available"):
        reason = geometry.get("reason") or geometry.get("note") or "No residual was computed."
        return f"<li>{where}: not measured. {e(reason)}</li>"
    spacing = geometry.get("spacing_px") or {}
    residual = geometry.get("homography_residual") or {}
    parts = []
    mean, std, lo, hi = (_num(spacing.get(k)) for k in ("mean", "std", "min", "max"))
    if mean:
        parts.append(f"mean neighbour spacing {mean} px (std {std}, min {lo}, max {hi})")
    straight = _num(geometry.get("row_straightness_rms_px"))
    if straight:
        parts.append(f"row-straightness RMS {straight} px")
    rms, median, peak = (_num(residual.get(k)) for k in ("rms_px", "median_px", "max_px"))
    if rms:
        parts.append(f"planar-fit residual RMS {rms} px (median {median}, max {peak})")
    sentence = "; ".join(parts) or "Geometry was marked available but no summary numbers were stored."
    note = geometry.get("note") or "These are pixel measurements on a partial grid, not lens coefficients and not a fire measurement."
    return f"<li>{where}: {e(sentence)}. {e(note)}</li>"

def _comparison_html(comparison) -> str:
    """The detection comparison, or nothing when that run has not been made."""
    if not comparison:
        return ""
    e = lambda x: html.escape(str(x))
    def rms_text(value) -> str:
        shown = _num(value)
        return f"{shown} px" if shown else "not computed"

    original = comparison.get("original") or {}
    rows = [
        f"<li>original: {e(original.get('num_corners'))} corners, residual RMS {rms_text(original.get('rms_px'))}</li>"
    ]
    for copy in comparison.get("copies") or []:
        if copy.get("status") != "measured":
            rows.append(f"<li>{e(copy.get('operation'))}: {e(copy.get('status'))}</li>")
            continue
        rows.append(
            f"<li>{e(copy.get('operation'))}: {e(copy.get('num_corners'))} corners, "
            f"residual RMS {rms_text(copy.get('rms_px'))}</li>"
        )
    return (
        "<h2>Preprocessing compared with detection</h2>"
        f"<p>{e(comparison.get('statement'))}</p><ul>{''.join(rows)}</ul>"
    )

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
    comparison = _comparison_html(r.get("preprocess_comparison"))
    det = "".join(
        f"<li>{e(d.get('image_id'))}: {'detected' if d.get('success') else 'not detected'}"
        f" ({d.get('num_corners')} corners) — {e(d.get('message'))}</li>"
        for d in r["detections"]
    ) or "<li>No detection has been run.</li>"
    dist = "".join(_distortion_item(s) for s in r["distortion"]) or (
        "<li>No distortion analysis has been run. No residual was inserted.</li>"
    )
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
{comparison}
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
