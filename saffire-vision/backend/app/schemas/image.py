from pydantic import BaseModel, Field
from typing import Optional

class ImageInfo(BaseModel):
    """Metadata read from a file. Nothing here is a scientific measurement of the scene."""
    image_id: str
    filename: str
    width: int
    height: int
    format: Optional[str] = None
    color_mode: str
    channels: int = Field(..., description="Channel count stored in the file (PIL bands), not a claim about scene content")
    file_size_bytes: int
    kind: str  # individual | combined | unknown
    variant: str  # color | mono | unknown

class Dataset(BaseModel):
    source: str
    count: int
    images: list[ImageInfo]
    notes: list[str]
    missing_expected_files: list[str] = []
    present_expected_files: list[str] = []

class PanelMatch(BaseModel):
    filename: str
    mean_abs_diff: float

class PanelInfo(BaseModel):
    index: int = Field(..., description="0-based panel number, left to right. Use it as `panel` in analysis requests.")
    x_start: int
    x_end: int = Field(..., description="Exclusive")
    width: int
    height: int
    matches_individual: Optional[PanelMatch] = Field(None, description="Set only when the panel is pixel-near-identical to an individual file in data/raw")
    closest_individual_mean_abs_diff: Optional[float] = None

class PanelsResponse(BaseModel):
    """Measured layout of an image. Camera identity is not determined by software."""
    image_id: str
    width: int
    height: int
    divider: Optional[list[int]] = Field(None, description="[start, end_exclusive] columns of the divider, or null")
    panels: list[PanelInfo]
    method: str
    notes: list[str]
