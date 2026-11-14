from pydantic import BaseModel
from typing import Optional
class ImageInfo(BaseModel):
    image_id: str
    filename: str
    width: int
    height: int
    format: Optional[str]
    color_mode: str
    file_size_bytes: int
    kind: str  # individual | combined | unknown
    variant: str  # color | mono | unknown
class Dataset(BaseModel):
    source: str
    count: int
    images: list[ImageInfo]
    notes: list[str]
