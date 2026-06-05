use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

use crate::path_utils;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessResult {
    pub input_path: String,
    pub output_path: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProgress {
    pub current: usize,
    pub total: usize,
    pub current_file: String,
    pub elapsed_secs: f64,
    pub estimated_remaining_secs: Option<f64>,
    pub completed: Vec<ProcessResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchReport {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
    pub results: Vec<ProcessResult>,
    pub elapsed_secs: f64,
}

impl BatchReport {
    pub fn from_results(results: Vec<ProcessResult>, elapsed_secs: f64) -> Self {
        let total = results.len();
        let succeeded = results.iter().filter(|r| r.success).count();
        let failed = results.iter().filter(|r| !r.success).count();
        Self {
            total,
            succeeded,
            failed,
            skipped: 0,
            results,
            elapsed_secs,
        }
    }
}

pub struct BatchContext {
    pub cancelled: Arc<AtomicBool>,
    pub start_time: Instant,
    pub app: AppHandle,
}

impl BatchContext {
    pub fn new(app: AppHandle) -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
            start_time: Instant::now(),
            app,
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    pub fn emit_progress(&self, current: usize, total: usize, current_file: &str, completed: &[ProcessResult]) {
        let elapsed = self.start_time.elapsed().as_secs_f64();
        let estimated_remaining = if current > 0 {
            let per_item = elapsed / current as f64;
            Some(per_item * (total - current) as f64)
        } else {
            None
        };

        let progress = BatchProgress {
            current,
            total,
            current_file: current_file.to_string(),
            elapsed_secs: elapsed,
            estimated_remaining_secs: estimated_remaining,
            completed: completed.to_vec(),
        };

        let _ = self.app.emit("batch-progress", &progress);
    }
}

pub fn load_image_safe(path: &Path) -> Result<image::DynamicImage, String> {
    let unicode_path = path_utils::to_unicode_path(path)?;
    let img = image::open(&unicode_path)
        .map_err(|e| format!("图片加载失败 '{}': {}", path.display(), e))?;
    Ok(img)
}

pub fn save_image_safe(img: &image::DynamicImage, path: &Path, format: image::ImageFormat, quality: Option<u8>) -> Result<(), String> {
    path_utils::validate_path_length(path)?;

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("无法创建目录 '{}': {}", parent.display(), e))?;
        }
    }

    let unicode_path = path_utils::to_unicode_path(path)?;

    match format {
        image::ImageFormat::Jpeg => {
            let quality = quality.unwrap_or(85);
            let mut buf = std::io::BufWriter::new(
                std::fs::File::create(&unicode_path)
                    .map_err(|e| format!("无法创建文件 '{}': {}", path.display(), e))?
            );
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
            img.write_with_encoder(encoder)
                .map_err(|e| format!("保存 JPEG 失败 '{}': {}", path.display(), e))?;
        }
        image::ImageFormat::Png => {
            img.save_with_format(&unicode_path, format)
                .map_err(|e| format!("保存 PNG 失败 '{}': {}", path.display(), e))?;
        }
        image::ImageFormat::WebP => {
            img.save_with_format(&unicode_path, format)
                .map_err(|e| format!("保存 WebP 失败 '{}': {}", path.display(), e))?;
        }
        _ => {
            img.save_with_format(&unicode_path, format)
                .map_err(|e| format!("保存图片失败 '{}': {}", path.display(), e))?;
        }
    }

    Ok(())
}

pub fn format_from_extension(ext: &str) -> Option<image::ImageFormat> {
    match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => Some(image::ImageFormat::Jpeg),
        "png" => Some(image::ImageFormat::Png),
        "webp" => Some(image::ImageFormat::WebP),
        "bmp" => Some(image::ImageFormat::Bmp),
        "tiff" | "tif" => Some(image::ImageFormat::Tiff),
        "gif" => Some(image::ImageFormat::Gif),
        "ico" => Some(image::ImageFormat::Ico),
        _ => None,
    }
}
