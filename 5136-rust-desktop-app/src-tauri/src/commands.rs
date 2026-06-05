use std::collections::HashMap;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};

use crate::batch::{BatchContext, BatchReport};
use crate::convert;
use crate::exif_handler;
use crate::resize;
use crate::watermark;

pub struct CancellationState {
    pub tokens: Mutex<HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>>,
}

impl Default for CancellationState {
    fn default() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }
}

fn create_batch_ctx(app: &AppHandle, task_id: &str) -> (BatchContext, std::sync::Arc<std::sync::atomic::AtomicBool>) {
    let cancelled = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let state: State<CancellationState> = app.state();
    {
        let mut tokens = state.tokens.lock().unwrap();
        tokens.insert(task_id.to_string(), cancelled.clone());
    }
    let ctx = BatchContext {
        cancelled: cancelled.clone(),
        start_time: std::time::Instant::now(),
        app: app.clone(),
    };
    (ctx, cancelled)
}

fn cleanup_token(app: &AppHandle, task_id: &str) {
    let state: State<CancellationState> = app.state();
    let mut tokens = state.tokens.lock().unwrap();
    tokens.remove(task_id);
}

#[tauri::command]
pub fn batch_resize(
    app: AppHandle,
    task_id: String,
    input_paths: Vec<String>,
    options: resize::ResizeOptions,
) -> Result<BatchReport, String> {
    let (ctx, _) = create_batch_ctx(&app, &task_id);
    let start = std::time::Instant::now();
    let results = resize::batch_resize(input_paths, options, &ctx);
    cleanup_token(&app, &task_id);
    let elapsed = start.elapsed().as_secs_f64();
    Ok(BatchReport::from_results(results, elapsed))
}

#[tauri::command]
pub fn batch_convert(
    app: AppHandle,
    task_id: String,
    input_paths: Vec<String>,
    options: convert::ConvertOptions,
) -> Result<BatchReport, String> {
    let (ctx, _) = create_batch_ctx(&app, &task_id);
    let start = std::time::Instant::now();
    let results = convert::batch_convert(input_paths, options, &ctx);
    cleanup_token(&app, &task_id);
    let elapsed = start.elapsed().as_secs_f64();
    Ok(BatchReport::from_results(results, elapsed))
}

#[tauri::command]
pub fn batch_watermark(
    app: AppHandle,
    task_id: String,
    input_paths: Vec<String>,
    options: watermark::WatermarkOptions,
) -> Result<BatchReport, String> {
    let (ctx, _) = create_batch_ctx(&app, &task_id);
    let start = std::time::Instant::now();
    let results = watermark::batch_watermark(input_paths, options, &ctx);
    cleanup_token(&app, &task_id);
    let elapsed = start.elapsed().as_secs_f64();
    Ok(BatchReport::from_results(results, elapsed))
}

#[tauri::command]
pub fn read_exif_batch(
    app: AppHandle,
    task_id: String,
    input_paths: Vec<String>,
) -> Result<Vec<exif_handler::ExifData>, String> {
    let (ctx, _) = create_batch_ctx(&app, &task_id);
    let results = exif_handler::batch_read_exif(input_paths, &ctx);
    cleanup_token(&app, &task_id);
    Ok(results)
}

#[tauri::command]
pub fn export_exif_csv(
    app: AppHandle,
    task_id: String,
    input_paths: Vec<String>,
    csv_path: String,
) -> Result<(), String> {
    let (ctx, _) = create_batch_ctx(&app, &task_id);
    let exif_data = exif_handler::batch_read_exif(input_paths, &ctx);
    cleanup_token(&app, &task_id);

    let mut valid_data = Vec::new();
    for d in exif_data {
        if d.error.is_none() {
            valid_data.push(d);
        }
    }

    exif_handler::export_exif_csv(&valid_data, std::path::Path::new(&csv_path))
}

#[tauri::command]
pub fn batch_clear_exif(
    app: AppHandle,
    task_id: String,
    input_paths: Vec<String>,
    output_dir: String,
) -> Result<BatchReport, String> {
    let (ctx, _) = create_batch_ctx(&app, &task_id);
    let start = std::time::Instant::now();
    let results = exif_handler::batch_clear_exif(input_paths, output_dir, &ctx);
    cleanup_token(&app, &task_id);
    let elapsed = start.elapsed().as_secs_f64();
    Ok(BatchReport::from_results(results, elapsed))
}

#[tauri::command]
pub fn cancel_task(
    app: AppHandle,
    task_id: String,
) -> Result<(), String> {
    let state: State<CancellationState> = app.state();
    let tokens = state.tokens.lock().unwrap();
    if let Some(cancelled) = tokens.get(&task_id) {
        cancelled.store(true, std::sync::atomic::Ordering::Relaxed);
        Ok(())
    } else {
        Err(format!("未找到任务: {}", task_id))
    }
}
