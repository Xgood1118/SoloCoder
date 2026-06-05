use std::path::Path;

use image::{GenericImage, GenericImageView, Rgba};
use serde::{Deserialize, Serialize};

use crate::batch::{self, BatchContext, ProcessResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatermarkOptions {
    pub watermark_type: WatermarkType,
    pub output_dir: String,
    pub output_format: Option<String>,
    pub quality: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WatermarkType {
    Text(TextWatermark),
    Image(ImageWatermark),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextWatermark {
    pub text: String,
    pub font_path: Option<String>,
    pub font_size: f32,
    pub color: String,
    pub position: WatermarkPosition,
    pub opacity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageWatermark {
    pub watermark_image_path: String,
    pub position: WatermarkPosition,
    pub opacity: f32,
    pub scale: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WatermarkPosition {
    TopLeft,
    TopCenter,
    TopRight,
    MiddleLeft,
    MiddleCenter,
    MiddleRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

fn parse_color(hex: &str) -> Result<Rgba<u8>, String> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return Err(format!("无效的颜色值: #{}", hex));
    }
    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|_| "无效的红色分量")?;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|_| "无效的绿色分量")?;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|_| "无效的蓝色分量")?;
    Ok(Rgba([r, g, b, 255]))
}

fn calculate_position(
    img_w: u32,
    img_h: u32,
    wm_w: u32,
    wm_h: u32,
    pos: &WatermarkPosition,
) -> (i64, i64) {
    let margin = 10i64;
    let x = match pos {
        WatermarkPosition::TopLeft | WatermarkPosition::MiddleLeft | WatermarkPosition::BottomLeft => margin,
        WatermarkPosition::TopCenter | WatermarkPosition::MiddleCenter | WatermarkPosition::BottomCenter => {
            (img_w as i64 - wm_w as i64) / 2
        }
        WatermarkPosition::TopRight | WatermarkPosition::MiddleRight | WatermarkPosition::BottomRight => {
            img_w as i64 - wm_w as i64 - margin
        }
    };
    let y = match pos {
        WatermarkPosition::TopLeft | WatermarkPosition::TopCenter | WatermarkPosition::TopRight => margin,
        WatermarkPosition::MiddleLeft | WatermarkPosition::MiddleCenter | WatermarkPosition::MiddleRight => {
            (img_h as i64 - wm_h as i64) / 2
        }
        WatermarkPosition::BottomLeft | WatermarkPosition::BottomCenter | WatermarkPosition::BottomRight => {
            img_h as i64 - wm_h as i64 - margin
        }
    };
    (x, y)
}

fn get_default_font_path() -> Option<String> {
    if cfg!(target_os = "windows") {
        let windir = std::env::var("WINDIR").ok()?;
        let msyh = std::path::Path::new(&windir).join("Fonts/msyh.ttc");
        if msyh.exists() {
            return Some(msyh.to_string_lossy().to_string());
        }
        let arial = std::path::Path::new(&windir).join("Fonts/arial.ttf");
        if arial.exists() {
            return Some(arial.to_string_lossy().to_string());
        }
    } else if cfg!(target_os = "macos") {
        let paths = [
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial.ttf",
        ];
        for p in &paths {
            if std::path::Path::new(p).exists() {
                return Some(p.to_string());
            }
        }
    } else {
        let paths = [
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
        ];
        for p in &paths {
            if std::path::Path::new(p).exists() {
                return Some(p.to_string());
            }
        }
    }
    None
}

fn load_font(font_path: &Option<String>) -> Result<fontdue::Font, String> {
    let path_str = font_path
        .as_ref()
        .cloned()
        .or_else(get_default_font_path)
        .ok_or_else(|| "未指定字体文件，且未找到系统默认字体。请在水印设置中指定字体文件路径。".to_string())?;

    let path = Path::new(&path_str);
    let unicode_path = crate::path_utils::to_unicode_path(path)?;
    let font_data = std::fs::read(&unicode_path)
        .map_err(|e| format!("无法读取字体文件 '{}': {}", path_str, e))?;

    fontdue::Font::from_bytes(font_data, fontdue::FontSettings::default())
        .map_err(|e| format!("字体解析失败 '{}': {:?}", path_str, e))
}

fn apply_text_watermark(
    img: &mut image::DynamicImage,
    text_wm: &TextWatermark,
) -> Result<(), String> {
    let font = load_font(&text_wm.font_path)?;

    let color = parse_color(&text_wm.color)?;
    let alpha = (text_wm.opacity.clamp(0.0, 1.0) * 255.0) as u8;

    let mut chars_bitmaps = Vec::new();
    let mut total_width = 0u32;
    let mut max_height = 0u32;

    for ch in text_wm.text.chars() {
        let (metrics, bitmap) = font.rasterize(ch, text_wm.font_size);
        chars_bitmaps.push((metrics, bitmap));
        total_width += metrics.width as u32;
        if metrics.height as u32 > max_height {
            max_height = metrics.height as u32;
        }
    }

    let (img_w, img_h) = img.dimensions();
    let (x_start, y_start) = calculate_position(img_w, img_h, total_width, max_height, &text_wm.position);

    let mut x_offset = 0i64;

    for (metrics, bitmap) in &chars_bitmaps {
        for row in 0..metrics.height {
            for col in 0..metrics.width {
                let bitmap_val = bitmap[row * metrics.width + col];
                if bitmap_val == 0 {
                    continue;
                }
                let px = x_start + x_offset + col as i64;
                let py = y_start + row as i64;
                if px < 0 || py < 0 || px >= img_w as i64 || py >= img_h as i64 {
                    continue;
                }
                let pixel = img.get_pixel(px as u32, py as u32);
                let factor = bitmap_val as f32 / 255.0;
                let a_factor = alpha as f32 / 255.0 * factor;
                let blended_r = (color[0] as f32 * a_factor + pixel[0] as f32 * (1.0 - a_factor)) as u8;
                let blended_g = (color[1] as f32 * a_factor + pixel[1] as f32 * (1.0 - a_factor)) as u8;
                let blended_b = (color[2] as f32 * a_factor + pixel[2] as f32 * (1.0 - a_factor)) as u8;
                let blended_a = (alpha as f32 * factor + pixel[3] as f32 * (1.0 - a_factor)) as u8;
                img.put_pixel(px as u32, py as u32, Rgba([blended_r, blended_g, blended_b, blended_a]));
            }
        }
        x_offset += metrics.width as i64;
    }

    Ok(())
}

fn apply_image_watermark(
    img: &mut image::DynamicImage,
    image_wm: &ImageWatermark,
) -> Result<(), String> {
    let wm_path = Path::new(&image_wm.watermark_image_path);
    let wm_img = batch::load_image_safe(wm_path)?;

    let scale = image_wm.scale.clamp(0.01, 5.0);
    let new_w = ((wm_img.width() as f64) * scale as f64).round() as u32;
    let new_h = ((wm_img.height() as f64) * scale as f64).round() as u32;
    let new_w = new_w.max(1);
    let new_h = new_h.max(1);

    let resized_wm = wm_img.resize_exact(new_w, new_h, image::imageops::FilterType::Lanczos3);
    let mut wm_rgba = resized_wm.to_rgba8();

    let alpha = (image_wm.opacity.clamp(0.0, 1.0) * 255.0) as u8;
    for pixel in wm_rgba.pixels_mut() {
        pixel[3] = ((pixel[3] as f32 * alpha as f32) / 255.0).round() as u8;
    }

    let (img_w, img_h) = img.dimensions();
    let (x_start, y_start) = calculate_position(img_w, img_h, new_w, new_h, &image_wm.position);

    for y in 0..new_h {
        for x in 0..new_w {
            let px = x_start + x as i64;
            let py = y_start + y as i64;
            if px < 0 || py < 0 || px >= img_w as i64 || py >= img_h as i64 {
                continue;
            }
            let wm_pixel = wm_rgba.get_pixel(x, y);
            if wm_pixel[3] == 0 {
                continue;
            }
            let base_pixel = img.get_pixel(px as u32, py as u32);
            let a = wm_pixel[3] as f32 / 255.0;
            let blended_r = (wm_pixel[0] as f32 * a + base_pixel[0] as f32 * (1.0 - a)) as u8;
            let blended_g = (wm_pixel[1] as f32 * a + base_pixel[1] as f32 * (1.0 - a)) as u8;
            let blended_b = (wm_pixel[2] as f32 * a + base_pixel[2] as f32 * (1.0 - a)) as u8;
            img.put_pixel(px as u32, py as u32, Rgba([blended_r, blended_g, blended_b, base_pixel[3]]));
        }
    }

    Ok(())
}

pub fn batch_watermark(
    input_paths: Vec<String>,
    options: WatermarkOptions,
    ctx: &BatchContext,
) -> Vec<ProcessResult> {
    let total = input_paths.len();
    let mut results = Vec::new();
    let output_dir = Path::new(&options.output_dir);

    if let Err(e) = crate::path_utils::ensure_output_dir(output_dir) {
        for p in &input_paths {
            results.push(ProcessResult {
                input_path: p.clone(),
                output_path: None,
                success: false,
                error: Some(e.clone()),
            });
        }
        return results;
    }

    for (i, input_path_str) in input_paths.iter().enumerate() {
        if ctx.is_cancelled() {
            break;
        }

        let input_path = Path::new(input_path_str);
        ctx.emit_progress(i, total, input_path_str, &results);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            process_single_watermark(input_path, &options)
        }));

        match result {
            Ok(Ok(output)) => results.push(output),
            Ok(Err(e)) => results.push(ProcessResult {
                input_path: input_path_str.clone(),
                output_path: None,
                success: false,
                error: Some(e),
            }),
            Err(_) => results.push(ProcessResult {
                input_path: input_path_str.clone(),
                output_path: None,
                success: false,
                error: Some("水印处理过程中发生严重错误（可能文件已损坏）".to_string()),
            }),
        }
    }

    ctx.emit_progress(results.len().min(total), total, "", &results);
    results
}

fn process_single_watermark(
    input_path: &Path,
    options: &WatermarkOptions,
) -> Result<ProcessResult, String> {
    crate::path_utils::validate_path_length(input_path)?;

    let mut img = batch::load_image_safe(input_path)?;

    match &options.watermark_type {
        WatermarkType::Text(text_wm) => apply_text_watermark(&mut img, text_wm)?,
        WatermarkType::Image(image_wm) => apply_image_watermark(&mut img, image_wm)?,
    }

    let original_ext = input_path.extension()
        .map(|e| e.to_string_lossy().to_string());
    let ext = match options.output_format.as_deref() {
        Some(f) => f,
        None => original_ext
            .as_deref()
            .unwrap_or("png"),
    };

    let format = batch::format_from_extension(ext)
        .ok_or_else(|| format!("不支持的输出格式: {}", ext))?;

    let output_path = crate::path_utils::generate_output_path(
        Path::new(&options.output_dir),
        input_path,
        "watermarked",
        Some(ext),
    )?;

    batch::save_image_safe(&img, &output_path, format, options.quality)?;

    Ok(ProcessResult {
        input_path: input_path.to_string_lossy().to_string(),
        output_path: Some(output_path.to_string_lossy().to_string()),
        success: true,
        error: None,
    })
}
