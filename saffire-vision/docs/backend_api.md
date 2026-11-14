# SAFFIRE Vision API

Contract for the FastAPI backend (this file is `docs/backend_api.md`). The Next.js app proxies `/api/*` and `/outputs/*` to this service (`BACKEND_URL`, default `http://127.0.0.1:8000`). Swagger UI: `http://127.0.0.1:8000/docs`.

This API inspects distortion-grid images. It does not detect flames, estimate temperature, or classify fire risk. Responses never fill in a camera matrix or a residual that was not computed.

## Errors

Validation and domain errors use FastAPI's `{"detail": ...}` body.

| Status | When |
|---|---|
| 400 | Empty upload |
| 404 | Unknown `image_id` or report id |
| 413 | Upload larger than 50 MB |
| 415 | Extension not in jpg, jpeg, png, tif, tiff, bmp |
| 422 | Invalid JSON body, undecodable image, or bad download format |

`detail` is a string for the errors raised by this service. Request-body validation uses FastAPI's list form.

## CORS

Default origins: `http://localhost:3000` and `http://127.0.0.1:3000`. Override with `CORS_ORIGINS` (comma-separated). `X-Processed-File` is exposed to the browser.

## Dataset files

Expected names, copied unchanged into `data/raw/`:

- `SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg`
- `SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg`
- `SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg`
- `SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_mono.jpg`

`image_id` is the filename. Color and mono copies of one scene are one calibration view. Names containing `combined` are not calibration views.

The combined files are two 1280-px panels separated by a 5-px white divider (columns 1280-1284). See `GET /api/images/{image_id}/panels` and `docs/dataset.md`.

## `GET /api/health`

```json
{"status": "ok"}
```

## `GET /api/dataset`

```json
{
  "source": "NASA SAFFIRE-1 F1C1 distortion grids ...",
  "count": 0,
  "images": [],
  "notes": ["..."],
  "missing_expected_files": ["SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg"],
  "present_expected_files": []
}
```

Each image:

| Field | Meaning |
|---|---|
| `image_id`, `filename` | Filename in `data/raw/` |
| `width`, `height` | Pixels from the file header |
| `format` | Pillow format, e.g. `JPEG` |
| `color_mode` | Pillow mode, e.g. `RGB` or `L` |
| `channels` | Number of bands stored in the file |
| `file_size_bytes` | Size on disk |
| `kind` | `individual`, `combined`, or `unknown` (from the filename) |
| `variant` | `color`, `mono`, or `unknown` (from the filename) |

Also writes `data/metadata/inventory.json`. `GET /api/images` returns the `images` array only. `GET /api/images/{image_id}` returns one object. `GET /api/images/{image_id}/file` returns the original bytes.

## `GET /api/images/{image_id}/panels`

Measured layout of one image: finds a full-height bright divider, splits there, and checks whether each panel is pixel-near-identical to an individual file in `data/raw`. Software does not read the camera label burned into the NASA composites, so camera identity is not reported.

```json
{
  "image_id": "SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg",
  "width": 2565, "height": 920,
  "divider": [1280, 1285],
  "panels": [
    {"index": 0, "x_start": 0, "x_end": 1280, "width": 1280, "height": 920,
     "matches_individual": null, "closest_individual_mean_abs_diff": 84.4},
    {"index": 1, "x_start": 1285, "x_end": 2565, "width": 1280, "height": 920,
     "matches_individual": {"filename": "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920_mono.jpg", "mean_abs_diff": 0.9524},
     "closest_individual_mean_abs_diff": 0.9524}
  ],
  "method": "...", "notes": ["..."]
}
```

`mean_abs_diff` is a grey-level difference (0-255). The 3.0 match threshold is a heuristic. An image with no divider returns `divider: null` and one panel. `index` is what you send as `panel` to the analysis endpoints.

## `POST /api/images/upload`

Multipart field `file`. Does not overwrite an existing name (a numeric suffix is added). Response `201` is an image object. Undecodable content is deleted and returns `422`.

## `POST /api/analysis/preprocess`

JSON body. **Response body is `image/png`, not JSON**, so the current frontend can call `.blob()`.

```json
{"image_id": "grid.png", "operation": "contrast"}
```

`operation`: `grayscale`, `contrast`, `denoise`, `normalize`, `resize`, or `pipeline`.

| Field | Default | Used by |
|---|---|---|
| `max_dim` | 1024 | `resize` only (longest side; images already smaller are unchanged) |
| `gaussian_ksize` | 5 | `denoise`, `pipeline`. Odd integer from 1 to 31 |
| `gaussian_sigma` | 0 | `denoise`, `pipeline`. `0` lets OpenCV derive sigma |
| `clahe_clip` | 2.0 | `contrast`, `pipeline` |
| `grayscale` | true | `pipeline` only |
| `apply_denoise` | false | `pipeline` only |
| `apply_contrast` | false | `pipeline` only |

Response header `X-Processed-File` is the repo-relative path, for example `data/processed/grid__contrast.png`. The same file is served at `/outputs/processed/grid__contrast.png`.

**JSON variant.** Add `"response_format": "json"` (default `"image"`) to get JSON instead of the PNG:

```json
{"image_id": "grid.png", "operation": "contrast",
 "saved_file": "data/processed/grid__contrast.png",
 "output_url": "/outputs/processed/grid__contrast.png",
 "width": 1280, "height": 920, "channels": 1}
```

The default is unchanged because the current frontend reads the response as a blob. The raw original is never written.

## `POST /api/analysis/detect-checkerboard`

```json
{"image_id": "SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg", "cols": 21, "rows": 11, "use_sb": true}
```

`cols` and `rows` are inner corners, each from 3 to 60. They are not read from the filename. Optional `square_size_mm` is echoed and is not applied. Optional `panel` (0-based) analyses one panel of a side-by-side composite; corners are then in panel coordinates and `panel_x_offset` is what to add to x to get composite coordinates. A `panel` that does not exist returns 422.

**Patterns measured on the supplied NASA images** (OpenCV 4.10 and 5.0 agree): F1C1 individual image, color and mono: **21x11** (231 corners). Composite panel 0: **20x10** (200 corners); panel 1: 21x11. These are the largest patterns that detected, i.e. the visible central region, not the full board. Smaller patterns are not reliable across OpenCV versions (for example 8x6 detected on 5.0 and not on 4.10).

```json
{
  "success": true,
  "pattern": [21, 11],
  "num_corners": 231,
  "corners": [[0.0, 0.0]],
  "image_size": [1280, 920],
  "method": "findChessboardCornersSB+cornerSubPix",
  "message": "Detected. ...",
  "image_id": "grid.png",
  "overlay_file": "grid_21x11.png",
  "panel": null,
  "panel_x_offset": null
}
```

On failure, `success` is false, `corners` is `[]`, and `overlay_file` is null. The overlay, when present, is at `/outputs/detected/{overlay_file}`. With `panel`, the name is `{stem}_panel{n}_{cols}x{rows}.png`. A failed detection takes about 1 s per call on the supplied images.

## `POST /api/analysis/distortion`

Same `image_id`, `cols`, `rows` and optional `panel`. Detects again, then measures geometry.

```json
{
  "image_id": "grid.png",
  "panel": null,
  "detection_success": true,
  "geometry": {
    "available": true,
    "kind": "observed_image_geometry",
    "spacing_px": {"mean": 40.0, "std": 0.0, "min": 40.0, "max": 40.0},
    "spacing_cv": 0.0,
    "row_straightness_rms_px": 0.0,
    "homography_residual": {
      "rms_px": 0.0,
      "mean_px": 0.0,
      "median_px": 0.0,
      "p95_px": 0.0,
      "max_px": 0.0,
      "alignment": "origin-first-corner",
      "method": "..."
    },
    "per_corner_residual_px": [0.0],
    "projected_corners": [[0.0, 0.0]],
    "deviation_overlay": "grid_6x4_deviation.png",
    "assumptions": ["..."],
    "limitations": ["..."],
    "note": "..."
  }
}
```

The numbers above are the shape of the JSON, not a measurement. For reference, **measured** on `SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg` with a 21x11 pattern: mean neighbour spacing 58.67 px (std 6.07, min 40.38, max 66.38), row-straightness RMS 8.05 px, homography residual RMS 15.86 px (median 13.57, p95 26.95, max 45.14). `spacing_px` is what the analysis page charts. `homography_residual` is the pixel distance left after a least-squares planar homography from a unit grid; because a homography absorbs reflections and flips, the corner labelling does not change it, so `alignment` is a fixed label and carries no information. It is not `k1`/`k2` and it is not a millimetre error. If detection fails, `available` is false, `reason` explains why, and the residual fields are omitted.

The deviation image is at `/outputs/detected/{deviation_overlay}`.

## `POST /api/calibration/run`

```json
{"image_ids": ["view01.png", "view02.png"], "cols": 7, "rows": 5, "min_views": 10}
```

Optional `square_size_mm`. Without it, a valid model is in square units.

`status` is `insufficient` or `valid`.

- `insufficient`: `problems` explains why. No `camera_matrix` and no `distortion_coefficients`.
- `valid`: those arrays are present, with `rms_reprojection_error_px`, `units`, and `provenance`. They come from `cv2.calibrateCamera` on the views that detected.

Rejected before any fit: duplicate ids, color/mono pairs, combined filenames, mixed resolutions, fewer than `min_views` images, or fewer than `min_views` successful detections.

`feasibility` on this response is only a filename check (`estimates_parameters` is always false).

## `GET /api/calibration/status`

Last saved run, or `{"status": "not_run", "feasibility": {...}}` if calibration has not been run. `feasibility.conclusion` states whether the files currently in `data/raw` are enough to attempt a fit. It does not itself fit one.

`feasibility.independent_scene_count` counts color/mono copies once and skips combined composites (a filename check).

`feasibility.pixel_check` looks inside combined images (measured from pixels): `distinct_views_by_pixels`, `new_panels_not_in_individual_files`, and per-file panel results. On the supplied data it reports 2 distinct pictures (the F1C1 image, and one extra panel in the composites). That does **not** make calibration feasible: the extra panel is from a different camera (per the burned-in label, read visually), and each camera still has one view. `sufficient_independent_views` stays false.

## `GET /api/analysis/history`

Detection runs only, oldest first, capped at 200:

```json
[{"image_id": "grid.png", "success": true, "pattern": [7, 5], "num_corners": 35, "message": "...", "overlay_file": "grid_7x5.png"}]
```

The dashboard joins `pattern` with `×`. Do not expect preprocessing rows in this array.

## Reports

`POST /api/reports` creates a report from the current dataset, the detection history, and the preprocessing/distortion log. Response `201` is the document and includes `report_id`.

`GET /api/reports` returns a JSON array of ids.

`GET /api/reports/{report_id}` returns the document.

`GET /api/reports/{report_id}/download?format=html` or `format=json` returns the file. The default format is HTML.

Empty sections say that the step has not been run. A calibration block contains a camera matrix only when the last run was `valid`.

## What the frontend already calls

| Client (`frontend/lib/api.ts`) | Endpoint | Body / result |
|---|---|---|
| `api.dataset()` | `GET /api/dataset` | Dataset object |
| `api.history()` | `GET /api/analysis/history` | Detection array |
| `api.detect` | `POST /api/analysis/detect-checkerboard` | `{image_id, cols, rows}` |
| `api.distortion` | `POST /api/analysis/distortion` | reads `geometry.spacing_px` and `geometry.note` |
| `api.calibrate` | `POST /api/calibration/run` | `{image_ids, cols, rows, min_views, square_size_mm?}` |
| `api.calStatus` | `GET /api/calibration/status` | `status`, optional `problems` |
| `api.upload` | `POST /api/images/upload` | multipart `file` |
| `api.preprocessUrl` | `POST /api/analysis/preprocess` | **PNG blob** |
| `api.createReport` | `POST /api/reports` | `{report_id}` |
| `api.imageUrl` | `GET /api/images/{id}/file` | image bytes |
| `api.overlayUrl` | `GET /outputs/detected/{file}` | image bytes |
| `api.reportDownload` | `GET /api/reports/{id}/download?format=` | html or json file |

New fields are additive. Existing pages keep working if those paths and the `spacing_px` object (mean, std, min, max) stay in place.
