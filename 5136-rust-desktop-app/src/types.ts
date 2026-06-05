export type { UnlistenFn } from '@tauri-apps/api/event'

export type ResizeMode = 'by_width' | 'by_height' | 'fixed'

export interface ResizeOptions {
  mode: ResizeMode
  width?: number
  height?: number
  output_format?: string
  quality?: number
  output_dir: string
}

export interface ConvertOptions {
  output_format: string
  quality?: number
  output_dir: string
}

export type WatermarkPosition =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'middle_left'
  | 'middle_center'
  | 'middle_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right'

export interface TextWatermark {
  text: string
  font_path?: string
  font_size: number
  color: string
  position: WatermarkPosition
  opacity: number
}

export interface ImageWatermark {
  watermark_image_path: string
  position: WatermarkPosition
  opacity: number
  scale: number
}

export type WatermarkType = { text: TextWatermark } | { image: ImageWatermark }

export interface WatermarkOptions {
  watermark_type: WatermarkType
  output_dir: string
  output_format?: string
  quality?: number
}

export interface BatchProgress {
  current: number
  total: number
  current_file: string
  elapsed_secs: number
  estimated_remaining_secs?: number
}

export interface ProcessResult {
  input_path: string
  output_path?: string
  success: boolean
  error?: string
}

export interface BatchReport {
  total: number
  succeeded: number
  failed: number
  skipped: number
  results: ProcessResult[]
  elapsed_secs: number
}

export interface ExifEntry {
  tag: string
  value: string
  ifd: string
}

export interface ExifData {
  file_path: string
  entries: ExifEntry[]
  error?: string
}
