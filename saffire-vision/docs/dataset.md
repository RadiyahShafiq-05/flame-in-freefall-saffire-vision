# Dataset

## If the JPEGs are not in the folder
The four files below are not committed (see `.gitignore`). The API still starts. `GET /api/dataset` then returns `count: 0` and lists every missing name in `missing_expected_files`.

1. Unzip `SAFFIRE-1_F1C1_DistortionGrids_1280x920_originals.zip`.
2. Copy the four JPEGs into `data/raw/`.
3. Keep the original filenames and do not edit the pixels.
4. Restart is unnecessary; the next `GET /api/dataset` reads the folder again.

Do not replace them with unrelated images if the goal is to analyse this SAFFIRE-1 release. Other images can be added through `POST /api/images/upload`; uploads never overwrite an existing filename.

## Verified from the supplied files
**SAFFIRE-1 F1C1 distortion grids** (`SAFFIRE-1_F1C1_DistortionGrids_1280x920_originals.zip`, 4 JPEGs). Measured with Pillow:

| File | Size (px) | Mode | Bytes | Kind |
|---|---|---|---|---|
| `SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg` | 1280×920 | RGB (3 ch) | 88,026 | individual, color |
| `..._1280x920_mono.jpg` | 1280×920 | L (1 ch) | 81,509 | individual, mono |
| `SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg` | 2565×920 | RGB (3 ch) | 230,603 | combined |
| `..._Combined_1280x920_mono.jpg` | 2565×920 | L (1 ch) | 170,099 | combined |

The mono files are single-channel; the color files are RGB. (An earlier version of this page said all four were RGB; that was wrong.)

Green/black checkerboard filling the frame with strong visible curvature. These are camera-geometry images, **not** flame or temperature data.

### What the combined images contain (measured)
- Each combined image is **two 1280-px panels separated by a 5-px white divider** (columns 1280-1284): 1280 + 5 + 1280 = 2565. Found by `GET /api/images/{id}/panels`.
- **Right panel (x 1285-2564) is the F1C1 image.** Mean absolute grey difference to the individual F1C1 file is about 0.95 on a 0-255 scale (JPEG re-compression noise). It adds no new view.
- **Left panel (x 0-1279) is a different picture** (difference ≈ 84 to the F1C1 file). The text burned into the top-left of each panel reads `SAFFIRE-1_F1C1_DistortionGrid_1280x920.tif` (right) and `SAFFIRE-1_F1C2_DistortionGrid_1280x920.tif` (left). **That label was read by eye; no software reads it.** It suggests the left panel is a second camera, F1C2, whose grid shows visibly different distortion. Treat the camera attribution as an observation, not a verified fact.
- The burned-in text occupies roughly the top 25 rows of the combined images, which is why panel comparisons skip the top 40 rows.

### Checkerboard patterns that detect (inner corners, measured)
OpenCV needs the whole requested pattern inside the frame, and the grid extends past the frame, so only the central region is detectable. Largest patterns found:

| Image | Pattern (cols×rows) | Corners | Notes |
|---|---|---|---|
| F1C1 individual, color and mono | **21×11** | 231 | Same on OpenCV 4.10 and 5.0 |
| Combined, panel 1 (F1C1) | 21×11 | 231 | |
| Combined, panel 0 (F1C2) | **20×10** | 200 | 21×11 does not detect |

These are **partial** regions: 21×11 inner corners is not the board's true size. Smaller patterns are unreliable across OpenCV versions (for example 8×6 detected on 5.0 but not on 4.10), so use the values above. The scan covered cols 12-21, rows 8-15 on the individual images only. On F1C2 it covered cols 12-21, rows 7-11. Larger or other sizes were not tried.

## Also supplied (not yet integrated; carried over from earlier notes and not re-checked in this review: those files were not in the uploads)
- SAFFIRE-II S2C2 (JPEG, 5000 frames, 676×157), S3C2 (TIFF, 1090 frames, 700×187), S4C1 (TIFF, 737 frames, 672×157): flame-experiment frames, per the SAFFIRE-II table.
- `PSI-99_Experimental_table_SAFFIRE-2.csv`: sample/test table (material, thickness, flow, O2, camera IDs). Parsing it is future work; the headers contain typos ("Samle", "visulation") and mixed-unit strings that need cleaning.

## Not known / not assumed
Camera model, lens, true grid dimensions, and square size (the `30mmBlock` in the filenames is not confirmed to be the square size). Combined images are rejected as calibration inputs; use `panel` to analyse a single panel.

Cite NASA Physical Sciences Informatics as the source; this project is not endorsed by NASA.
