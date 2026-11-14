# Dataset

## Verified from the supplied files
**SAFFIRE-1 F1C1 distortion grids** (`SAFFIRE-1_F1C1_DistortionGrids_1280x920_originals.zip`, 4 JPEGs, RGB):

| File | Size (px) | Kind |
|---|---|---|
| `SAFFIRE-1_F1C1_DistortionGrid-30mmBlock_1280x920.jpg` | 1280×920 | individual, color |
| `..._1280x920_mono.jpg` | 1280×920 | individual, mono |
| `SAFFIRE-1_DistortionGrids-30mmBlock_Combined_1280x920_color.jpg` | 2565×920 | combined |
| `..._Combined_1280x920_mono.jpg` | 2565×920 | combined |

Green/black checkerboard filling the frame with strong visible curvature. These are camera-geometry images, **not** flame or temperature data.

## Also supplied (not yet integrated)
- SAFFIRE-II S2C2 (JPEG, 5000 frames, 676×157), S3C2 (TIFF, 1090 frames, 700×187), S4C1 (TIFF, 737 frames, 672×157): flame-experiment frames, per the SAFFIRE-II table.
- `PSI-99_Experimental_table_SAFFIRE-2.csv`: sample/test table (material, thickness, flow, O2, camera IDs). Parsing it is future work; the headers contain typos ("Samle", "visulation") and mixed-unit strings that need cleaning.

## Not known / not assumed
Camera model, lens, true grid dimensions, square size, and whether the two combined panels are independent views. Combined-image panels are unverified and are rejected as calibration inputs.

Cite NASA Physical Sciences Informatics as the source; this project is not endorsed by NASA.
