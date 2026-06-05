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
      <h3 class="section-title">格式转换参数</h3>

      <div class="form-group">
        <label>目标格式</label>
        <select v-model="outputFormat" class="form-select">
          <option value="jpg">JPEG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
          <option value="bmp">BMP</option>
          <option value="tiff">TIFF</option>
          <option value="gif">GIF</option>
        </select>
      </div>

      <div v-if="outputFormat === 'jpg' || outputFormat === 'webp'" class="form-group">
        <label>质量: {{ quality }}%</label>
        <input v-model.number="quality" type="range" min="1" max="100" class="form-range" />
      </div>

      <div class="form-group">
        <label>输出目录</label>
        <div class="dir-picker">
          <input :value="outputDir" type="text" class="form-input" readonly placeholder="选择输出目录" />
          <button class="btn-dir" @click="pickOutputDir">浏览</button>
        </div>
      </div>
    </div>

    <ProgressBar
      v-if="batch.progress.value"
      :progress="batch.progress.value"
      @cancel="batch.cancelProcess()"
    />

    <button
      class="btn-start"
      :disabled="!canStart"
      @click="startConvert"
    >
      {{ batch.isProcessing.value ? '处理中...' : '开始处理' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import FileList from './FileList.vue'
import ProgressBar from './ProgressBar.vue'
import { useBatch } from '../composables/useBatch'
import { batchConvert } from '../api'

const batch = useBatch()

const outputFormat = ref('jpg')
const quality = ref(85)
const outputDir = ref('')

const canStart = computed(() => {
  if (batch.isProcessing.value) return false
  if (batch.fileList.value.length === 0) return false
  if (!outputDir.value) return false
  return true
})

async function pickOutputDir() {
  const dir = await batch.pickDirectory()
  if (dir) outputDir.value = dir
}

async function startConvert() {
  await batch.startProcess(() =>
    batchConvert(batch.taskId, [...batch.fileList.value], {
      output_format: outputFormat.value,
      quality: outputFormat.value === 'jpg' || outputFormat.value === 'webp' ? quality.value : undefined,
      output_dir: outputDir.value,
    }),
  )
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

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  color: #aaaacc;
}

.form-select,
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

.form-select:focus,
.form-input:focus {
  border-color: #e94560;
}

.form-range {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  background: #1a1a2e;
  border-radius: 3px;
  outline: none;
}

.form-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #e94560;
  border-radius: 50%;
  cursor: pointer;
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
