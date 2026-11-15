from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

class PreprocessRequest(BaseModel):
    """One named operation, matching the analysis page, or `pipeline` for a configurable chain.

    The response body is a PNG, not JSON, because the frontend reads it as a blob.
    `X-Processed-File` is the saved copy under data/processed/. Originals are not written.
    """
    image_id: str
    operation: str = Field(pattern="^(grayscale|contrast|denoise|normalize|resize|pipeline)$")
    max_dim: int = Field(1024, ge=64, le=4096, description="Longest side used only by the resize operation")
    gaussian_ksize: int = Field(5, ge=1, le=31, description="Odd kernel size for denoise and pipeline")
    gaussian_sigma: float = Field(0, ge=0, le=20, description="0 lets OpenCV derive sigma from the kernel size")
    clahe_clip: float = Field(2.0, gt=0, le=20, description="CLAHE clip limit for contrast and pipeline")
    grayscale: bool = Field(True, description="Used only when operation is pipeline")
    apply_denoise: bool = Field(False, description="Used only when operation is pipeline")
    apply_contrast: bool = Field(False, description="Used only when operation is pipeline")
    response_format: str = Field(
        "image", pattern="^(image|json)$",
        description="`image` (default, existing behaviour) returns the PNG. `json` returns metadata and a URL for the saved copy.",
    )

    @field_validator("gaussian_ksize")
    @classmethod
    def kernel_must_be_odd(cls, value: int) -> int:
        if value % 2 == 0:
            raise ValueError("gaussian_ksize must be a positive odd integer")
        return value

class DetectRequest(BaseModel):
    image_id: str
    cols: int = Field(..., ge=3, le=60, description="Inner corners horizontally. Not inferred from the filename.")
    rows: int = Field(..., ge=3, le=60, description="Inner corners vertically. Not inferred from the filename.")
    square_size_mm: Optional[float] = Field(None, gt=0, description="Recorded only. Detection does not scale by this value.")
    use_sb: bool = True
    panel: Optional[int] = Field(
        None, ge=0,
        description="0-based panel of a side-by-side composite (see GET /api/images/{id}/panels). Omit to analyse the whole image.",
    )

class DistortionRequest(BaseModel):
    image_id: str
    cols: int = Field(..., ge=3, le=60)
    rows: int = Field(..., ge=3, le=60)
    panel: Optional[int] = Field(
        None, ge=0,
        description="0-based panel of a side-by-side composite (see GET /api/images/{id}/panels). Omit to analyse the whole image.",
    )

class CalibrationRequest(BaseModel):
    image_ids: list[str] = Field(..., min_length=1)
    cols: int = Field(..., ge=3, le=60)
    rows: int = Field(..., ge=3, le=60)
    square_size_mm: Optional[float] = Field(None, gt=0, description="Optional. Omitted results use square units, not millimetres.")
    min_views: int = Field(10, ge=3, le=200, description="Practical minimum, not a NASA requirement")

class SpacingPx(BaseModel):
    mean: float
    std: float
    min: float
    max: float

class HomographyResidual(BaseModel):
    rms_px: float
    mean_px: float
    median_px: float
    p95_px: float
    max_px: float
    alignment: str
    method: str

class GeometryResult(BaseModel):
    available: bool
    reason: Optional[str] = None
    kind: Optional[str] = None
    spacing_px: Optional[SpacingPx] = None
    spacing_cv: Optional[float] = None
    row_straightness_rms_px: Optional[float] = None
    homography_residual: Optional[HomographyResidual] = None
    per_corner_residual_px: Optional[list[float]] = None
    projected_corners: Optional[list[list[float]]] = None
    deviation_overlay: Optional[str] = None
    assumptions: list[str] = []
    limitations: list[str] = []
    note: Optional[str] = None

class DistortionResponse(BaseModel):
    image_id: str
    panel: Optional[int] = None
    detection_success: bool
    geometry: GeometryResult

class DetectionResponse(BaseModel):
    success: bool
    pattern: list[int]
    num_corners: int
    corners: list[list[float]]
    image_size: list[int]
    method: Optional[str] = None
    message: str
    image_id: str
    square_size_mm: Optional[float] = None
    overlay_file: Optional[str] = None
    panel: Optional[int] = Field(None, description="Panel analysed, or null for the whole image. Corners are in panel pixel coordinates.")
    panel_x_offset: Optional[int] = Field(None, description="Add to corner x to get coordinates in the full composite")

class PreprocessJsonResponse(BaseModel):
    image_id: str
    operation: str
    saved_file: str = Field(..., description="Repo-relative path of the saved copy")
    output_url: str = Field(..., description="Path served by the backend, e.g. /outputs/processed/x__contrast.png")
    width: int
    height: int
    channels: int

class SceneGroup(BaseModel):
    scene_key: str
    files: list[str]
    counted_as: int

class Feasibility(BaseModel):
    """File-set check only. This object never contains camera parameters."""
    estimates_parameters: bool
    sufficient_independent_views: bool
    independent_scene_count: int
    minimum_views: int
    scenes: list[SceneGroup]
    reasons: list[str]
    conclusion: str
    pixel_check: Optional[dict[str, Any]] = Field(None, description="Panel/duplicate analysis of combined images, measured from pixels. Never contains camera parameters.")

class CalibrationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: str
    problems: Optional[list[str]] = None
    views_supplied: Optional[int] = None
    min_views: Optional[int] = None
    views_used: Optional[list[str]] = None
    views_failed: Optional[list[str]] = None
    image_size: Optional[list[int]] = None
    rms_reprojection_error_px: Optional[float] = None
    camera_matrix: Optional[list[list[float]]] = None
    distortion_coefficients: Optional[list[float]] = None
    units: Optional[str] = None
    provenance: Optional[str] = None
    timestamp: Optional[str] = None
    feasibility: Optional[Feasibility] = None

class PreprocessComparisonRequest(BaseModel):
    image_id: str
    cols: int = Field(..., ge=3, le=60, description="Same inner-corner pattern used on the original and every saved copy.")
    rows: int = Field(..., ge=3, le=60)

class ReportDocument(BaseModel):
    report_id: str
    generated: str
    dataset: dict[str, Any]
    preprocessing: list[dict[str, Any]]
    detections: list[dict[str, Any]]
    distortion: list[dict[str, Any]]
    calibration: dict[str, Any]
    calibration_feasibility: Feasibility
    output_files: list[str]
    processing: str
    limitations: list[str]
    preprocess_comparison: Optional[dict[str, Any]] = None
