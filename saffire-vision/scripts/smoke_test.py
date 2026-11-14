"""End-to-end smoke test against a RUNNING backend (real HTTP, real files in data/raw).

    python scripts/smoke_test.py [base_url]

Prints actual responses. Exit code 1 if a check fails. Unlike pytest it does not mock
anything, and it writes generated files (overlays, a report) under outputs/.
"""
import json, sys
import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
IND = "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg"
IND_MONO = "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg"
COMB = "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg"
fails = []

def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
    if not cond:
        fails.append(name)

c = httpx.Client(base_url=BASE, timeout=120)
r = c.get("/api/health"); check("GET /api/health", r.status_code == 200 and r.json() == {"status": "ok"})
r = c.get("/docs"); check("GET /docs (Swagger UI)", r.status_code == 200 and "swagger" in r.text.lower())
ds = c.get("/api/dataset").json()
check("GET /api/dataset", ds["count"] == 4 and not ds["missing_expected_files"], f"count={ds['count']} missing={ds['missing_expected_files']}")
imgs = c.get("/api/images").json(); check("GET /api/images", len(imgs) == 4)
r = c.get(f"/api/images/{IND}"); check("GET /api/images/{id}", r.status_code == 200 and (r.json()["width"], r.json()["height"]) == (1280, 920), r.text[:120])
check("GET /api/images/{missing} -> 404", c.get("/api/images/nope.jpg").status_code == 404)
r = c.get(f"/api/images/{IND}/file"); check("GET /api/images/{id}/file", r.status_code == 200 and r.headers["content-type"].startswith("image/"), f"{len(r.content)} bytes")

p = c.get(f"/api/images/{COMB}/panels").json()
check("GET panels (combined)", p["divider"] == [1280, 1285] and len(p["panels"]) == 2, f"divider={p['divider']}")
print("   panels:", [(q["x_start"], q["x_end"], q["matches_individual"]) for q in p["panels"]])

r = c.post("/api/analysis/detect-checkerboard", json={"image_id": IND, "cols": 21, "rows": 11})
d = r.json(); check("detect 21x11 on F1C1", r.status_code == 200 and d["success"] and d["num_corners"] == 231, f"{d['num_corners']} corners via {d['method']}")
check("overlay is downloadable", c.get(f"/outputs/detected/{d['overlay_file']}").status_code == 200, d["overlay_file"])
d2 = c.post("/api/analysis/detect-checkerboard", json={"image_id": IND, "cols": 40, "rows": 30}).json()
check("detect impossible pattern fails gracefully", d2["success"] is False and d2["corners"] == [] and d2["overlay_file"] is None)
d3 = c.post("/api/analysis/detect-checkerboard", json={"image_id": COMB, "cols": 20, "rows": 10, "panel": 0}).json()
check("detect 20x10 on combined panel 0", d3["success"] and d3["num_corners"] == 200, f"{d3['num_corners']} corners")
check("panel out of range -> 422", c.post("/api/analysis/detect-checkerboard", json={"image_id": COMB, "cols": 6, "rows": 4, "panel": 5}).status_code == 422)

g = c.post("/api/analysis/distortion", json={"image_id": IND, "cols": 21, "rows": 11}).json()["geometry"]
check("distortion 21x11", g["available"] and g["homography_residual"]["rms_px"] > 1, f"spacing_mean={g['spacing_px']['mean']:.2f}px homography_rms={g['homography_residual']['rms_px']:.2f}px straightness_rms={g['row_straightness_rms_px']:.2f}px")
check("deviation overlay is downloadable", c.get(f"/outputs/detected/{g['deviation_overlay']}").status_code == 200)
gf = c.post("/api/analysis/distortion", json={"image_id": IND, "cols": 40, "rows": 30}).json()["geometry"]
check("distortion on failed detection reports unavailable", gf["available"] is False and "homography_residual" not in gf)

before = open(f"data/raw/{IND}", "rb").read() if len(sys.argv) < 3 else None
r = c.post("/api/analysis/preprocess", json={"image_id": IND, "operation": "contrast"})
check("preprocess -> PNG (default)", r.status_code == 200 and r.headers["content-type"] == "image/png", r.headers.get("x-processed-file", ""))
r = c.post("/api/analysis/preprocess", json={"image_id": IND_MONO, "operation": "pipeline", "apply_denoise": True, "apply_contrast": True, "response_format": "json"})
j = r.json(); check("preprocess -> JSON", r.status_code == 200 and j["output_url"].startswith("/outputs/processed/"), json.dumps(j)[:160])
check("processed copy is downloadable", c.get(j["output_url"]).status_code == 200)
check("preprocess bad kernel -> 422", c.post("/api/analysis/preprocess", json={"image_id": IND, "operation": "denoise", "gaussian_ksize": 4}).status_code == 422)
if before is not None:
    check("raw original unchanged after processing", open(f"data/raw/{IND}", "rb").read() == before)

cal = c.get("/api/calibration/status").json()
check("GET /api/calibration/status", cal["status"] in ("not_run", "insufficient", "valid") and "camera_matrix" not in cal.get("feasibility", {}), f"status={cal['status']}")
print("   feasibility:", cal["feasibility"]["conclusion"][:140])
print("   pixel_check distinct views:", cal["feasibility"]["pixel_check"]["distinct_views_by_pixels"])
run = c.post("/api/calibration/run", json={"image_ids": [IND, IND_MONO], "cols": 21, "rows": 11}).json()
check("POST /api/calibration/run refuses (insufficient)", run["status"] == "insufficient" and "camera_matrix" not in run, "; ".join(run["problems"])[:160])
run2 = c.post("/api/calibration/run", json={"image_ids": [COMB], "cols": 21, "rows": 11, "min_views": 3}).json()
check("calibration refuses combined composite", run2["status"] == "insufficient" and any("combined" in x for x in run2["problems"]))

up = c.post("/api/images/upload", files={"file": ("smoke_bad.jpg", b"junk", "image/jpeg")})
check("upload garbage -> 422", up.status_code == 422)
check("upload wrong type -> 415", c.post("/api/images/upload", files={"file": ("x.txt", b"hi", "text/plain")}).status_code == 415)

rep = c.post("/api/reports"); rid = rep.json()["report_id"]
check("POST /api/reports", rep.status_code == 201, rid)
rj = c.get(f"/api/reports/{rid}").json()
check("GET /api/reports/{id}", rj["report_id"] == rid and rj["detections"] and rj["distortion"] and rj["calibration"]["status"] != "valid")
h = c.get(f"/api/reports/{rid}/download"); check("download html", h.status_code == 200 and "Limitations" in h.text)
check("download json", c.get(f"/api/reports/{rid}/download", params={"format": "json"}).status_code == 200)
check("report 404", c.get("/api/reports/zzz").status_code == 404)
cors = c.options("/api/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
check("CORS allows frontend origin", cors.headers.get("access-control-allow-origin") == "http://localhost:3000")
print("\n%d failure(s)" % len(fails)); sys.exit(1 if fails else 0)
