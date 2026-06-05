use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::batch::{self, BatchContext, ProcessResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertOptions {
    pub output_format: String,
    pub quality: Option<u8>,
    pub output_dir: String,
}

pub fn batch_convert(
    input_paths: Vec<String>,
    options: ConvertOptions,
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

    let format = match batch::format_from_extension(&options.output_format) {
        Some(f) => f,
        None => {
            let err = format!("不支持的目标格式: {}", options.output_format);
            for p in &input_paths {
                results.push(ProcessResult {
                    input_path: p.clone(),
                    output_path: None,
                    success: false,
                    error: Some(err.clone()),
                });
            }
            return results;
        }
    };

    for (i, input_path_str) in input_paths.iter().enumerate() {
        if ctx.is_cancelled() {
            break;
        }

        let input_path = Path::new(input_path_str);
        ctx.emit_progress(i, total, input_path_str, &results);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            process_single_convert(input_path, &options, format)
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
                error: Some("格式转换过程中发生严重错误（可能文件已损坏）".to_string()),
            }),
        }
    }

    ctx.emit_progress(results.len().min(total), total, "", &results);
    results
}

fn process_single_convert(
    input_path: &Path,
    options: &ConvertOptions,
    format: image::ImageFormat,
) -> Result<ProcessResult, String> {
    crate::path_utils::validate_path_length(input_path)?;

    let img = batch::load_image_safe(input_path)?;

    let output_path = crate::path_utils::generate_output_path(
        Path::new(&options.output_dir),
        input_path,
        "",
        Some(&options.output_format),
    )?;

    batch::save_image_safe(&img, &output_path, format, options.quality)?;

    Ok(ProcessResult {
        input_path: input_path.to_string_lossy().to_string(),
        output_path: Some(output_path.to_string_lossy().to_string()),
        success: true,
        error: None,
    })
}
