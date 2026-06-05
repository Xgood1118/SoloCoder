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
      <h3 class="section-title">水印参数</h3>

      <div class="form-group">
        <label>水印类型</label>
        <div class="type-toggle">
          <button
            :class="['toggle-btn', { active: watermarkType === 'text' }]"
            @click="watermarkType = 'text'"
          >文字水印</button>
          <button
            :class="['toggle-btn', { active: watermarkType === 'image' }]"
            @click="watermarkType = 'image'"
          >图片水印</button>
        </div>
      </div>

      <template v-if="watermarkType === 'text'">
        <div class="form-group">
          <label>水印文字</label>
          <input v-model="textContent" type="text" class="form-input" placeholder="输入水印文字" />
        </div>

        <div class="form-group">
          <label>字体文件（可选）</label>
          <div class="dir-picker">
            <input :value="fontPath" type="text" class="form-input" readonly placeholder="不选则使用系统默认字体" />
            <button class="btn-dir" @click="pickFont">浏览</button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>字号: {{ fontSize }}px</label>
            <input v-model.number="fontSize" type="range" min="12" max="200" class="form-range" />
          </div>
          <div class="form-group">
            <label>颜色</label>
            <input v-model="color" type="color" class="form-color" />
          </div>
        </div>

        <div class="form-group">
          <label>透明度: {{ Math.round(textOpacity * 100) }}%</label>
          <input v-model.number="textOpacity" type="range" min="0" max="1" step="0.05" class="form-range" />
        </div>
      </template>

      <template v-if="watermarkType === 'image'">
        <div class="form-group">
          <label>水印图片</label>
          <div class="dir-picker">
            <input :value="watermarkImagePath" type="text" class="form-input" readonly placeholder="选择水印图片" />
            <button class="btn-dir" @click="pickWatermarkImage">浏览</button>
          </div>
        </div>

        <div class="form-group">
          <label>透明度: {{ Math.round(imageOpacity * 100) }}%</label>
          <input v-model.number="imageOpacity" type="range" min="0" max="1" step="0.05" class="form-range" />
        </div>

        <div class="form-group">
          <label>缩放比例: {{ imageScale.toFixed(1) }}x</label>
          <input v-model.number="imageScale" type="range" min="0.1" max="5" step="0.1" class="form-range" />
        </div>
      </template>

      <div class="form-group">
        <label>水印位置</label>
        <div class="position-grid">
          <button
            v-for="pos in positions"
            :key="pos"
            :class="['pos-cell', { active: position === pos }]"
            @click="position = pos"
          >{{ positionLabels[pos] }}</button>
        </div>
      </div>

      <div class="form-group">
        <label>输出格式</label>
        <select v-model="outputFormat" class="form-select">
          <option value="">保持原格式</option>
          <option value="jpg">JPEG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
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
      @click="startWatermark"
    >
      {{ batch.isProcessing.value ? '处理中...' : '开始处理' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import FileList from './FileList.vue'
import ProgressBar from './ProgressBar.vue'
import { useBatch } from '../composables/useBatch'
import { batchWatermark } from '../api'
import type { WatermarkPosition } from '../types'

const batch = useBatch()

const watermarkType = ref<'text' | 'image'>('text')
const textContent = ref('水印文字')
const fontPath = ref('')
const fontSize = ref(48)
const color = ref('#ffffff')
const textOpacity = ref(0.5)
const watermarkImagePath = ref('')
const imageOpacity = ref(0.5)
const imageScale = ref(0.3)
const position = ref<WatermarkPosition>('bottom_right')
const outputFormat = ref('')
const quality = ref(85)
const outputDir = ref('')

const positions: WatermarkPosition[] = [
  'top_left', 'top_center', 'top_right',
  'middle_left', 'middle_center', 'middle_right',
  'bottom_left', 'bottom_center', 'bottom_right',
]

const positionLabels: Record<WatermarkPosition, string> = {
  top_left: '↖', top_center: '↑', top_right: '↗',
  middle_left: '←', middle_center: '·', middle_right: '→',
  bottom_left: '↙', bottom_center: '↓', bottom_right: '↘',
}

const canStart = computed(() => {
  if (batch.isProcessing.value) return false
  if (batch.fileList.value.length === 0) return false
  if (!outputDir.value) return false
  if (watermarkType.value === 'text' && !textContent.value) return false
  if (watermarkType.value === 'image' && !watermarkImagePath.value) return false
  return true
})

async function pickOutputDir() {
  const dir = await batch.pickDirectory()
  if (dir) outputDir.value = dir
}

async function pickFont() {
  const selected = await open({
    multiple: false,
    filters: [{ name: '字体', extensions: ['ttf', 'otf', 'ttc', 'woff', 'woff2'] }],
  })
  if (typeof selected === 'string') fontPath.value = selected
}

async function pickWatermarkImage() {
  const selected = await open({
    multiple: false,
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }],
  })
  if (typeof selected === 'string') watermarkImagePath.value = selected
}

async function startWatermark() {
  const wmType = watermarkType.value === 'text'
    ? { text: { text: textContent.value, font_path: fontPath.value || undefined, font_size: fontSize.value, color: color.value, position: position.value, opacity: textOpacity.value } }
    : { image: { watermark_image_path: watermarkImagePath.value, position: position.value, opacity: imageOpacity.value, scale: imageScale.value } }

  await batch.startProcess(() =>
    batchWatermark(batch.taskId, [...batch.fileList.value], {
      watermark_type: wmType,
      output_dir: outputDir.value,
      output_format: outputFormat.value || undefined,
      quality: outputFormat.value === 'jpg' || outputFormat.value === 'webp' ? quality.value : undefined,
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.type-toggle {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #3a3a5c;
  background: #1a1a2e;
  color: #8888aa;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: #0f3460;
  border-color: #e94560;
  color: #eee;
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

.form-color {
  width: 100%;
  height: 36px;
  background: #1a1a2e;
  border: 1px solid #3a3a5c;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
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

.position-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  max-width: 240px;
}

.pos-cell {
  aspect-ratio: 1.5;
  background: #1a1a2e;
  border: 1px solid #3a3a5c;
  color: #8888aa;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.pos-cell:hover {
  border-color: #e94560;
}

.pos-cell.active {
  background: #0f3460;
  border-color: #e94560;
  color: #e94560;
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
