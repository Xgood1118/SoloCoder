import io
import logging
from pathlib import Path
from typing import Optional

from PIL import Image as PILImage

logger = logging.getLogger(__name__)


def batch_resize(file_path: str, output_path: str, width: int, height: int, keep_aspect: bool = True) -> bool:
    try:
        img = PILImage.open(file_path)
        if keep_aspect:
            img.thumbnail((width, height), PILImage.Resampling.LANCZOS)
        else:
            img = img.resize((width, height), PILImage.Resampling.LANCZOS)
        img.save(output_path, quality=95)
        return True
    except Exception as e:
        logger.error(f"batch_resize failed for {file_path}: {e}")
        return False


def batch_convert_format(file_path: str, output_path: str, target_format: str, quality: int = 95) -> bool:
    try:
        img = PILImage.open(file_path)
        if target_format.upper() in ("JPEG", "JPG") and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        fmt = "JPEG" if target_format.upper() == "JPG" else target_format.upper()
        img.save(output_path, format=fmt, quality=quality)
        return True
    except Exception as e:
        logger.error(f"batch_convert_format failed for {file_path}: {e}")
        return False


def batch_add_watermark(
    file_path: str,
    output_path: str,
    text: str = "© IMS",
    position: str = "bottom_right",
    opacity: int = 128,
    font_size: int = 36,
) -> bool:
    try:
        img = PILImage.open(file_path).convert("RGBA")
        from PIL import ImageDraw, ImageFont

        overlay = PILImage.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except (IOError, OSError):
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        margin = 20

        positions = {
            "top_left": (margin, margin),
            "top_right": (img.width - text_w - margin, margin),
            "bottom_left": (margin, img.height - text_h - margin),
            "bottom_right": (img.width - text_w - margin, img.height - text_h - margin),
            "center": ((img.width - text_w) // 2, (img.height - text_h) // 2),
        }
        pos = positions.get(position, positions["bottom_right"])

        draw.text(pos, text, fill=(255, 255, 255, opacity), font=font)

        watermarked = PILImage.alpha_composite(img, overlay)
        watermarked = watermarked.convert("RGB")
        watermarked.save(output_path, quality=95)
        return True
    except Exception as e:
        logger.error(f"batch_add_watermark failed for {file_path}: {e}")
        return False


def batch_extract_exif(file_path: str) -> Optional[dict]:
    from app.services.exif_service import extract_exif
    return extract_exif(file_path)


def batch_regenerate_thumbnail(file_path: str, thumb_dir: str, size: tuple = (256, 256)) -> Optional[str]:
    from app.services.exif_service import generate_thumbnail
    return generate_thumbnail(file_path, thumb_dir, size)


OPERATIONS = {
    "resize": batch_resize,
    "convert_format": batch_convert_format,
    "add_watermark": batch_add_watermark,
    "extract_exif": batch_extract_exif,
    "regenerate_thumbnail": batch_regenerate_thumbnail,
}
