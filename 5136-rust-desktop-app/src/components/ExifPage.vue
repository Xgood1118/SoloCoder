<template>
  <div class="page">
    <FileList
      :files="batch.fileList.value"
      :disabled="batch.isProcessing.value"
      @add="batch.addFiles($event)"
      @clear="batch.clearFiles()"
      @remove="batch.removeFile($event)"
    />

    <div class="config-section">
      <h3 class="section-title">EXIF 处理</h3>

      <div class="mode-tabs">
        <button
          :class="['tab-btn', { active: mode === 'read' }]"
          @click="mode = 'read'"
        >读取 EXIF 并导出 CSV</button>
        <button
          :class="['tab-btn', { active: mode === 'clear' }]"
          @click="mode = 'clear'"
        >清除 EXIF（隐私保护）</button>
      </div>

      <template v-if="mode === 'read'">
        <div class="form-group">
          <label>CSV 输出路径</label>
          <div class="dir-picker">
            <input :value="csvPath" type="text" class="form-input" readonly placeholder="选择 CSV 文件保存位置" />
            <button class="btn-dir" @click="pickCsvPath">保存为...</button>
          </div>
        </div>
      </template>

      <template v-if="mode === 'clear'">
        <div class="form-group">
          <label>输出目录</label>
          <div class="dir-picker">
            <input :value="outputDir" type="text" class="form-input" readonly placeholder="选择输出目录" />
            <button class="btn-dir" @click="pickOutputDir">浏览</button>
          </div>
        </div>
      </template>
    </div>

    <ProgressBar
      v-if="batch.progress.value"
      :progress="batch.progress.value"
      @cancel="batch.cancelProcess()"
    />

    <button
      class="btn-start"
      :disabled="!canStart"
      @click="startProcess"
    >
      {{ batch.isProcessing.value ? '处理中...' : mode === 'read' ? '开始读取并导出' : '开始清除 EXIF' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { save } from '@tauri-apps/plugin-dialog'
import FileList from './FileList.vue'
import ProgressBar from './ProgressBar.vue'
import { useBatch } from '../composables/useBatch'
import { exportExifCsv, batchClearExif } from '../api'

const batch = useBatch()

const mode = ref<'read' | 'clear'>('read')
const csvPath = ref('')
const outputDir = ref('')

const canStart = computed(() => {
  if (batch.isProcessing.value) return false
  if (batch.fileList.value.length === 0) return false
  if (mode.value === 'read' && !csvPath.value) return false
  if (mode.value === 'clear' && !outputDir.value) return false
  return true
})

async function pickCsvPath() {
  const path = await save({
    defaultPath: 'exif_export.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (typeof path === 'string') csvPath.value = path
}

async function pickOutputDir() {
  const dir = await batch.pickDirectory()
  if (dir) outputDir.value = dir
}

async function startProcess() {
  if (mode.value === 'read') {
    await batch.startProcess(async () => {
      await exportExifCsv(batch.taskId, [...batch.fileList.value], csvPath.value)
      return {
        total: batch.fileList.value.length,
        succeeded: batch.fileList.value.length,
        failed: 0,
        skipped: 0,
        results: batch.fileList.value.map((p) => ({
          input_path: p,
          output_path: csvPath.value,
          success: true,
        })),
        elapsed_secs: 0,
      }
    })
  } else {
    await batch.startProcess(() =>
      batchClearExif(batch.taskId, [...batch.fileList.value], outputDir.value),
    )
  }
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-section {
  background: #16213e;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  color: #eee;
  border-bottom: 1px solid #0f3460;
  padding-bottom: 10px;
}

.mode-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid #3a3a5c;
  background: #1a1a2e;
  color: #8888aa;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #0f3460;
  border-color: #e94560;
  color: #eee;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  color: #aaaacc;
}

.form-input {
  background: #1a1a2e;
  border: 1px solid #3a3a5c;
  color: #eee;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #e94560;
}

.dir-picker {
  display: flex;
  gap: 8px;
}

.dir-picker .form-input {
  flex: 1;
}

.btn-dir {
  background: #0f3460;
  border: 1px solid #3a3a5c;
  color: #eee;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: background 0.2s;
}

.btn-dir:hover {
  background: #1a4a80;
}

.btn-start {
  background: linear-gradient(135deg, #0f3460, #e94560);
  border: none;
  color: #fff;
  padding: 12px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-start:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-start:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
