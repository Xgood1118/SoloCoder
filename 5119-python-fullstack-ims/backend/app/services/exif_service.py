import json
import logging
from pathlib import Path
from typing import Optional

from PIL import Image as PILImage
from PIL.ExifTags import TAGS, GPSTAGS

logger = logging.getLogger(__name__)


def _get_exif_tag(exif_data, tag_name):
    for tag_id, value in exif_data.items():
        tag = TAGS.get(tag_id, tag_id)
        if tag == tag_name:
            return value
    return None


def _convert_to_degrees(value):
    d, m, s = value
    return float(d) + float(m) / 60.0 + float(s) / 3600.0


def _get_gps_info(exif_data):
    gps_info = {}
    gps_raw = _get_exif_tag(exif_data, "GPSInfo")
    if not gps_raw:
        return None, None, None
    for key in gps_raw.keys():
        decode = GPSTAGS.get(key, key)
        gps_info[decode] = gps_raw[key]

    lat = lon = alt = None
    if "GPSLatitude" in gps_info and "GPSLatitudeRef" in gps_info:
        lat = _convert_to_degrees(gps_info["GPSLatitude"])
        if gps_info["GPSLatitudeRef"] == "S":
            lat = -lat
    if "GPSLongitude" in gps_info and "GPSLongitudeRef" in gps_info:
        lon = _convert_to_degrees(gps_info["GPSLongitude"])
        if gps_info["GPSLongitudeRef"] == "W":
            lon = -lon
    if "GPSAltitude" in gps_info:
        alt = float(gps_info["GPSAltitude"])
    return lat, lon, alt


def extract_exif(file_path: str) -> Optional[dict]:
    try:
        img = PILImage.open(file_path)
        exif_data = img._getexif()
        if not exif_data:
            return _build_empty_exif(img)

        lat, lon, alt = _get_gps_info(exif_data)

        extra = {}
        skip_tags = {
            "Make", "Model", "DateTimeOriginal", "ExposureTime",
            "FNumber", "ISOSpeedRatings", "FocalLength", "GPSInfo",
            "Software", "Artist"
        }
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            if tag not in skip_tags:
                try:
                    json.dumps(value)
                    extra[tag] = value
                except (TypeError, ValueError):
                    extra[tag] = str(value)

        return {
            "camera_make": _get_exif_tag(exif_data, "Make"),
            "camera_model": _get_exif_tag(exif_data, "Model"),
            "datetime_original": _get_exif_tag(exif_data, "DateTimeOriginal"),
            "exposure_time": str(_get_exif_tag(exif_data, "ExposureTime")) if _get_exif_tag(exif_data, "ExposureTime") else None,
            "f_number": str(_get_exif_tag(exif_data, "FNumber")) if _get_exif_tag(exif_data, "FNumber") else None,
            "iso_speed": _get_exif_tag(exif_data, "ISOSpeedRatings"),
            "focal_length": str(_get_exif_tag(exif_data, "FocalLength")) if _get_exif_tag(exif_data, "FocalLength") else None,
            "gps_latitude": lat,
            "gps_longitude": lon,
            "gps_altitude": alt,
            "software": _get_exif_tag(exif_data, "Software"),
            "artist": _get_exif_tag(exif_data, "Artist"),
            "extra": extra,
        }
    except Exception as e:
        logger.warning(f"Failed to extract EXIF from {file_path}: {e}")
        return None


def _build_empty_exif(img):
    return {
        "camera_make": None,
        "camera_model": None,
        "datetime_original": None,
        "exposure_time": None,
        "f_number": None,
        "iso_speed": None,
        "focal_length": None,
        "gps_latitude": None,
        "gps_longitude": None,
        "gps_altitude": None,
        "software": None,
        "artist": None,
        "extra": {},
    }


def generate_thumbnail(file_path: str, thumb_dir: str, size: tuple = (256, 256)) -> Optional[str]:
    try:
        thumb_dir_path = Path(thumb_dir)
        thumb_dir_path.mkdir(parents=True, exist_ok=True)

        img = PILImage.open(file_path)
        img.thumbnail(size, PILImage.Resampling.LANCZOS)

        original = Path(file_path)
        thumb_name = f"{original.stem}_thumb{original.suffix}"
        thumb_path = thumb_dir_path / thumb_name

        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            thumb_path = thumb_dir_path / f"{original.stem}_thumb.jpg"

        img.save(str(thumb_path), quality=85)
        return str(thumb_path)
    except Exception as e:
        logger.error(f"Failed to generate thumbnail for {file_path}: {e}")
        return None


def get_image_info(file_path: str) -> dict:
    try:
        img = PILImage.open(file_path)
        return {
            "width": img.width,
            "height": img.height,
            "format": img.format,
            "mode": img.mode,
            "file_size": Path(file_path).stat().st_size,
        }
    except Exception as e:
        logger.error(f"Failed to get image info for {file_path}: {e}")
        return {
            "width": 0,
            "height": 0,
            "format": None,
            "mode": None,
            "file_size": 0,
        }
