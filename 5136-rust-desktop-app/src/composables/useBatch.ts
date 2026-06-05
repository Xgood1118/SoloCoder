import { ref, readonly } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { listenProgress, cancelTask } from '../api'
import type { BatchProgress, BatchReport, UnlistenFn } from '../types'

function generateUUID(): string {
  return crypto.randomUUID()
}

export function useBatch() {
  const fileList = ref<string[]>([])
  const isProcessing = ref(false)
  const progress = ref<BatchProgress | null>(null)
  const report = ref<BatchReport | null>(null)
  const taskId = generateUUID()
  let unlisten: UnlistenFn | null = null

  async function addFiles() {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: '图片',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'gif', 'ico'],
        },
      ],
    })
    if (!selected) return
    const paths = Array.isArray(selected) ? selected : [selected]
    fileList.value = [...fileList.value, ...paths]
  }

  function removeFile(index: number) {
    fileList.value.splice(index, 1)
  }

  function addFilesInternal(paths: string[]) {
    fileList.value = [...fileList.value, ...paths]
  }

  function clearFiles() {
    fileList.value = []
  }

  async function startProcess(fn: () => Promise<BatchReport>) {
    if (isProcessing.value) return
    isProcessing.value = true
    progress.value = null
    report.value = null

    unlisten = await listenProgress((p) => {
      progress.value = p
    })

    try {
      const result = await fn()
      report.value = result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      report.value = {
        total: fileList.value.length,
        succeeded: 0,
        failed: fileList.value.length,
        skipped: 0,
        results: fileList.value.map((p) => ({
          input_path: p,
          success: false,
          error: msg,
        })),
        elapsed_secs: 0,
      }
    } finally {
      isProcessing.value = false
      progress.value = null
      if (unlisten) {
        unlisten()
        unlisten = null
      }
    }
  }

  async function cancelProcess() {
    await cancelTask(taskId)
  }

  async function pickDirectory(): Promise<string | null> {
    const dir = await open({ directory: true })
    if (typeof dir === 'string') return dir
    return null
  }

  return {
    fileList: readonly(fileList),
    isProcessing: readonly(isProcessing),
    progress: readonly(progress),
    report: readonly(report),
    taskId,
    addFilesFromDialog: addFiles,
    addFiles: addFilesInternal,
    removeFile,
    clearFiles,
    startProcess,
    cancelProcess,
    pickDirectory,
  }
}
