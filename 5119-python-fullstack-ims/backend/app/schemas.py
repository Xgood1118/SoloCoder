from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ImageResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    file_path: str
    thumbnail_path: Optional[str] = None
    file_size: int = 0
    width: int = 0
    height: int = 0
    format: Optional[str] = None
    mode: Optional[str] = None
    uploaded_at: Optional[str] = None
    is_indexed: bool = False
    exif: Optional[dict] = None
    tags: list[dict] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ImageListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ImageResponse]


class ExifResponse(BaseModel):
    id: int
    image_id: int
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    datetime_original: Optional[str] = None
    exposure_time: Optional[str] = None
    f_number: Optional[str] = None
    iso_speed: Optional[int] = None
    focal_length: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    gps_altitude: Optional[float] = None
    software: Optional[str] = None
    artist: Optional[str] = None
    extra: Optional[dict] = None

    class Config:
        from_attributes = True


class TagCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None


class TagResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    level: int = 0
    full_path: str
    created_at: Optional[str] = None
    image_count: int = 0
    children: list["TagResponse"] = Field(default_factory=list)

    class Config:
        from_attributes = True


TagResponse.model_rebuild()


class BatchTagRequest(BaseModel):
    image_ids: list[int]
    tag_ids: list[int]
    mode: str = "add"


class BatchTagReplaceRequest(BaseModel):
    image_ids: list[int]
    old_tag_id: int
    new_tag_id: int


class SimilarSearchRequest(BaseModel):
    image_id: Optional[int] = None
    top_k: int = 10
    threshold: float = 0.0


class SimilarSearchUploadRequest(BaseModel):
    top_k: int = 10
    threshold: float = 0.0


class SimilarSearchResponse(BaseModel):
    query_image_id: Optional[int] = None
    results: list[dict]


class BatchProcessRequest(BaseModel):
    image_ids: list[int]
    operation: str
    params: dict = Field(default_factory=dict)


class BatchTaskResponse(BaseModel):
    id: int
    task_type: str
    status: str
    total: int
    completed: int
    failed: int
    params: Optional[dict] = None
    result: Optional[dict] = None
    created_at: Optional[str] = None
    finished_at: Optional[str] = None

    class Config:
        from_attributes = True


class ScriptExecuteRequest(BaseModel):
    script: str
    image_ids: Optional[list[int]] = None


class ScriptExecuteResponse(BaseModel):
    success: bool
    matched_ids: list[int] = Field(default_factory=list)
    error: Optional[str] = None
    log: Optional[str] = None
