from pydantic import BaseModel, Field
from typing import Optional
class PreprocessRequest(BaseModel):
    image_id: str
    operation: str = Field(pattern="^(grayscale|contrast|denoise|normalize|resize)$")
    max_dim: int = Field(1024, ge=64, le=4096)
class DetectRequest(BaseModel):
    image_id: str
    cols: int = Field(..., ge=3, le=60, description="inner corners horizontally")
    rows: int = Field(..., ge=3, le=60, description="inner corners vertically")
    square_size_mm: Optional[float] = Field(None, gt=0)
    use_sb: bool = True
class DistortionRequest(BaseModel):
    image_id: str
    cols: int = Field(..., ge=3, le=60)
    rows: int = Field(..., ge=3, le=60)
class CalibrationRequest(BaseModel):
    image_ids: list[str]
    cols: int = Field(..., ge=3, le=60)
    rows: int = Field(..., ge=3, le=60)
    square_size_mm: Optional[float] = Field(None, gt=0)
    min_views: int = Field(10, ge=3, le=200)
