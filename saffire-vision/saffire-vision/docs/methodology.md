# Methodology
1. **Load**: Pillow reads metadata; OpenCV decodes pixels. Originals in `data/raw/` are never modified or overwritten (uploads get a numeric suffix).
2. **Preprocess** (grayscale, CLAHE contrast, Gaussian denoise, min-max normalize, resize) on copies only.
3. **Detect**: `findChessboardCornersSB` (exhaustive), falling back to `findChessboardCorners` + `cornerSubPix`. The user supplies the inner-corner pattern; OpenCV must see the **entire** pattern. Failure returns an explanation and no coordinates.
4. **Geometry** (`distortion_analyzer`): corner spacing statistics and row straightness in pixels. These are observations, not lens coefficients.
5. **Calibration**: `cv2.calibrateCamera`, only when at least `min_views` (default 10, configurable, a practical default rather than a NASA value) independent views detect. Rejected inputs: color/mono duplicates, combined composites, mixed resolutions. Reports RMS reprojection error and labels outputs as calculated. Square size is optional; without it, units are "square units".
6. **Undistort**: `camera_calibration.undistort` works only with a valid model.

## Observed on the supplied data
On the 1280×920 color grid, a full 20×14 pattern was not detected, and 6×4 was. The grid extends past the frame, so a small sub-pattern is detected rather than the whole board. A 6×4 hit is therefore a partial region and not evidence of the true grid size. With only these four images, calibration correctly reports "insufficient".
