use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::batch::{BatchContext, ProcessResult};
use crate::path_utils;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExifEntry {
    pub tag: String,
    pub value: String,
    pub ifd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExifData {
    pub file_path: String,
    pub entries: Vec<ExifEntry>,
    pub error: Option<String>,
}

pub fn read_exif(file_path: &Path) -> Result<Vec<ExifEntry>, String> {
    let unicode_path = path_utils::to_unicode_path(file_path)?;
    let file = File::open(&unicode_path)
        .map_err(|e| format!("无法打开文件 '{}': {}", file_path.display(), e))?;
    let mut buf_reader = std::io::BufReader::new(file);

    let exif_reader = exif::Reader::new();
    let exif_data = exif_reader
        .read_from_container(&mut buf_reader)
        .map_err(|e| format!("读取 EXIF 失败 '{}': {}", file_path.display(), e))?;

    let mut entries = Vec::new();
    for field in exif_data.fields() {
        entries.push(ExifEntry {
            tag: format!("{:?}", field.tag),
            value: field.display_value().to_string(),
            ifd: format!("{:?}", field.ifd_num),
        });
    }

    Ok(entries)
}

pub fn batch_read_exif(
    input_paths: Vec<String>,
    ctx: &BatchContext,
) -> Vec<ExifData> {
    let total = input_paths.len();
    let mut results = Vec::new();

    for (i, path_str) in input_paths.iter().enumerate() {
        if ctx.is_cancelled() {
            break;
        }

        ctx.emit_progress(i, total, path_str, &[]);

        let path = Path::new(&path_str);
        match read_exif(path) {
            Ok(entries) => results.push(ExifData {
                file_path: path_str.clone(),
                entries,
                error: None,
            }),
            Err(e) => results.push(ExifData {
                file_path: path_str.clone(),
                entries: Vec::new(),
                error: Some(e),
            }),
        }
    }

    results
}

pub fn export_exif_csv(exif_data_list: &[ExifData], output_path: &Path) -> Result<(), String> {
    path_utils::validate_path_length(output_path)?;

    let unicode_path = path_utils::to_unicode_path(output_path)?;
    let file = File::create(&unicode_path)
        .map_err(|e| format!("无法创建 CSV 文件 '{}': {}", output_path.display(), e))?;
    let mut wtr = csv::Writer::from_writer(BufWriter::new(file));

    wtr.write_record(&["文件路径", "IFD", "标签", "值"])
        .map_err(|e| format!("写入 CSV 头失败: {}", e))?;

    for data in exif_data_list {
        for entry in &data.entries {
            wtr.write_record(&[&data.file_path, &entry.ifd, &entry.tag, &entry.value])
                .map_err(|e| format!("写入 CSV 行失败: {}", e))?;
        }
    }

    wtr.flush().map_err(|e| format!("写入 CSV 失败: {}", e))?;
    Ok(())
}

pub fn clear_exif(input_path: &Path, output_path: &Path) -> Result<(), String> {
    path_utils::validate_path_length(input_path)?;
    path_utils::validate_path_length(output_path)?;

    let img = crate::batch::load_image_safe(input_path)?;

    let rgb_img = img.to_rgb8();
    let clean_img = image::DynamicImage::ImageRgb8(rgb_img);

    let ext = output_path.extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    let format = crate::batch::format_from_extension(&ext)
        .ok_or_else(|| format!("不支持的格式: {}", ext))?;

    crate::batch::save_image_safe(&clean_img, output_path, format, None)?;
    Ok(())
}

pub fn batch_clear_exif(
    input_paths: Vec<String>,
    output_dir: String,
    ctx: &BatchContext,
) -> Vec<ProcessResult> {
    let total = input_paths.len();
    let mut results = Vec::new();
    let out_dir = Path::new(&output_dir);

    if let Err(e) = path_utils::ensure_output_dir(out_dir) {
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

    for (i, path_str) in input_paths.iter().enumerate() {
        if ctx.is_cancelled() {
            break;
        }

        ctx.emit_progress(i, total, path_str, &results);

        let input_path = Path::new(&path_str);
        let ext = input_path.extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_else(|| "png".to_string());

        let output_path = match path_utils::generate_output_path(out_dir, input_path, "cleaned", Some(&ext)) {
            Ok(p) => p,
            Err(e) => {
                results.push(ProcessResult {
                    input_path: path_str.clone(),
                    output_path: None,
                    success: false,
                    error: Some(e),
                });
                continue;
            }
        };

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            clear_exif(input_path, &output_path)
        }));

        match result {
            Ok(Ok(())) => results.push(ProcessResult {
                input_path: path_str.clone(),
                output_path: Some(output_path.to_string_lossy().to_string()),
                success: true,
                error: None,
            }),
            Ok(Err(e)) => results.push(ProcessResult {
                input_path: path_str.clone(),
                output_path: None,
                success: false,
                error: Some(e),
            }),
            Err(_) => results.push(ProcessResult {
                input_path: path_str.clone(),
                output_path: None,
                success: false,
                error: Some("清除 EXIF 过程中发生严重错误（可能文件已损坏）".to_string()),
            }),
        }
    }

    ctx.emit_progress(results.len().min(total), total, "", &results);
    results
}
