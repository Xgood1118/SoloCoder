from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, Boolean,
    ForeignKey, Table, JSON
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base


image_tag_association = Table(
    "image_tag",
    Base.metadata,
    Column("image_id", Integer, ForeignKey("images.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    original_name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    thumbnail_path: Mapped[str] = mapped_column(String(1024), nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    format: Mapped[str] = mapped_column(String(20), nullable=True)
    mode: Mapped[str] = mapped_column(String(20), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=False)

    exif: Mapped["ExifData"] = relationship("ExifData", back_populates="image", uselist=False, cascade="all, delete-orphan")
    tags: Mapped[list["Tag"]] = relationship("Tag", secondary=image_tag_association, back_populates="images")

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "original_name": self.original_name,
            "file_path": self.file_path,
            "thumbnail_path": self.thumbnail_path,
            "file_size": self.file_size,
            "width": self.width,
            "height": self.height,
            "format": self.format,
            "mode": self.mode,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "is_indexed": self.is_indexed,
            "exif": self.exif.to_dict() if self.exif else None,
            "tags": [{"id": t.id, "name": t.full_path} for t in self.tags],
        }


class ExifData(Base):
    __tablename__ = "exif_data"

    id: Mapped[int] = mapped_column(primary_key=True)
    image_id: Mapped[int] = mapped_column(Integer, ForeignKey("images.id", ondelete="CASCADE"), unique=True)
    camera_make: Mapped[str] = mapped_column(String(256), nullable=True)
    camera_model: Mapped[str] = mapped_column(String(256), nullable=True)
    datetime_original: Mapped[str] = mapped_column(String(64), nullable=True)
    exposure_time: Mapped[str] = mapped_column(String(64), nullable=True)
    f_number: Mapped[str] = mapped_column(String(64), nullable=True)
    iso_speed: Mapped[int] = mapped_column(Integer, nullable=True)
    focal_length: Mapped[str] = mapped_column(String(64), nullable=True)
    gps_latitude: Mapped[float] = mapped_column(Float, nullable=True)
    gps_longitude: Mapped[float] = mapped_column(Float, nullable=True)
    gps_altitude: Mapped[float] = mapped_column(Float, nullable=True)
    software: Mapped[str] = mapped_column(String(256), nullable=True)
    artist: Mapped[str] = mapped_column(String(256), nullable=True)
    extra: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict)

    image: Mapped["Image"] = relationship("Image", back_populates="exif")

    def to_dict(self):
        return {
            "id": self.id,
            "image_id": self.image_id,
            "camera_make": self.camera_make,
            "camera_model": self.camera_model,
            "datetime_original": self.datetime_original,
            "exposure_time": self.exposure_time,
            "f_number": self.f_number,
            "iso_speed": self.iso_speed,
            "focal_length": self.focal_length,
            "gps_latitude": self.gps_latitude,
            "gps_longitude": self.gps_longitude,
            "gps_altitude": self.gps_altitude,
            "software": self.software,
            "artist": self.artist,
            "extra": self.extra,
        }


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("tags.id", ondelete="SET NULL"), nullable=True)
    level: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    parent: Mapped["Tag"] = relationship("Tag", remote_side=[id], back_populates="children")
    children: Mapped[list["Tag"]] = relationship("Tag", back_populates="parent", cascade="all, delete-orphan")
    images: Mapped[list["Image"]] = relationship("Image", secondary=image_tag_association, back_populates="tags")

    @property
    def full_path(self):
        parts = []
        current = self
        while current:
            parts.append(current.name)
            current = current.parent
        return "/".join(reversed(parts))

    def to_dict(self, include_children=True):
        result = {
            "id": self.id,
            "name": self.name,
            "parent_id": self.parent_id,
            "level": self.level,
            "full_path": self.full_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "image_count": len(self.images),
        }
        if include_children:
            result["children"] = [child.to_dict(include_children=True) for child in self.children]
        return result


class BatchTask(Base):
    __tablename__ = "batch_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    total: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    params: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict)
    result: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "task_type": self.task_type,
            "status": self.status,
            "total": self.total,
            "completed": self.completed,
            "failed": self.failed,
            "params": self.params,
            "result": self.result,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
        }
