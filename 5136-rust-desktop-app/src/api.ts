import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  ResizeOptions,
  ConvertOptions,
  WatermarkOptions,
  BatchProgress,
  BatchReport,
  ExifData,
} from './types'

export async function batchResize(
  taskId: string,
  inputPaths: string[],
  options: ResizeOptions,
): Promise<BatchReport> {
  return invoke('batch_resize', { taskId, inputPaths, options })
}

export async function batchConvert(
  taskId: string,
  inputPaths: string[],
  options: ConvertOptions,
): Promise<BatchReport> {
  return invoke('batch_convert', { taskId, inputPaths, options })
}

export async function batchWatermark(
  taskId: string,
  inputPaths: string[],
  options: WatermarkOptions,
): Promise<BatchReport> {
  return invoke('batch_watermark', { taskId, inputPaths, options })
}

export async function readExifBatch(
  taskId: string,
  inputPaths: string[],
): Promise<ExifData[]> {
  return invoke('read_exif_batch', { taskId, inputPaths })
}

export async function exportExifCsv(
  taskId: string,
  inputPaths: string[],
  csvPath: string,
): Promise<void> {
  return invoke('export_exif_csv', { taskId, inputPaths, csvPath })
}

export async function batchClearExif(
  taskId: string,
  inputPaths: string[],
  outputDir: string,
): Promise<BatchReport> {
  return invoke('batch_clear_exif', { taskId, inputPaths, outputDir })
}

export async function cancelTask(taskId: string): Promise<void> {
  return invoke('cancel_task', { taskId })
}

export async function listenProgress(
  callback: (progress: BatchProgress) => void,
): Promise<UnlistenFn> {
  return listen<BatchProgress>('batch-progress', (event) => {
    callback(event.payload)
  })
}
