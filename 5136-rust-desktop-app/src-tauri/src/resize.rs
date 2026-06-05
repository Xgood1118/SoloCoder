use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::batch::{self, BatchContext, ProcessResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResizeOptions {
    pub mode: ResizeMode,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub output_format: Option<String>,
    pub quality: Option<u8>,
    pub output_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResizeMode {
    ByWidth,
    ByHeight,
    Fixed,
}

pub fn resize_image(img: &image::DynamicImage, options: &ResizeOptions) -> Result<image::DynamicImage, String> {
    let (orig_w, orig_h) = (img.width(), img.height());

    let (new_w, new_h) = match options.mode {
        ResizeMode::ByWidth => {
            let w = options.width.ok_or("按宽度缩放时必须指定宽度")?;
            if w == 0 {
                return Err("宽度不能为 0".to_string());
            }
            let h = (orig_h as f64 * (w as f64 / orig_w as f64)).round() as u32;
            (w, h.max(1))
        }
        ResizeMode::ByHeight => {
            let h = options.height.ok_or("按高度缩放时必须指定高度")?;
            if h == 0 {
                return Err("高度不能为 0".to_string());
            }
            let w = (orig_w as f64 * (h as f64 / orig_h as f64)).round() as u32;
            (w.max(1), h)
        }
        ResizeMode::Fixed => {
            let w = options.width.ok_or("固定尺寸时必须指定宽度")?;
            let h = options.height.ok_or("固定尺寸时必须指定高度")?;
            if w == 0 || h == 0 {
                return Err("宽度和高度都不能为 0".to_string());
            }
            (w, h)
        }
    };

    Ok(img.resize_exact(new_w, new_h, image::imageops::FilterType::Lanczos3))
}

pub fn batch_resize(
    input_paths: Vec<String>,
    options: ResizeOptions,
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
            process_single_resize(input_path, &options)
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
                error: Some("图片处理过程中发生严重错误（可能文件已损坏）".to_string()),
            }),
        }
    }

    ctx.emit_progress(results.len().min(total), total, "", &results);
    results
}

fn process_single_resize(input_path: &Path, options: &ResizeOptions) -> Result<ProcessResult, String> {
    crate::path_utils::validate_path_length(input_path)?;

    let img = batch::load_image_safe(input_path)?;

    let resized = resize_image(&img, options)?;

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
        "resized",
        Some(ext),
    )?;

    batch::save_image_safe(&resized, &output_path, format, options.quality)?;

    Ok(ProcessResult {
        input_path: input_path.to_string_lossy().to_string(),
        output_path: Some(output_path.to_string_lossy().to_string()),
        success: true,
        error: None,
    })
}
