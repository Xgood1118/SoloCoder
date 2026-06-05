<template>
  <div v-if="progress" class="progress-bar">
    <div class="progress-header">
      <span class="progress-count">{{ progress.current }} / {{ progress.total }}</span>
      <span class="progress-file" :title="progress.current_file">{{ currentFileName }}</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: percent + '%' }"></div>
    </div>
    <div class="progress-footer">
      <div class="progress-time">
        <span>已用时: {{ formatTime(progress.elapsed_secs) }}</span>
        <span v-if="progress.estimated_remaining_secs != null">
          预计剩余: {{ formatTime(progress.estimated_remaining_secs) }}
        </span>
      </div>
      <button class="btn-cancel" @click="$emit('cancel')">取消</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BatchProgress } from '../types'

const props = defineProps<{
  progress: BatchProgress | null
}>()

defineEmits<{
  cancel: []
}>()

const percent = computed(() => {
  if (!props.progress || props.progress.total === 0) return 0
  return Math.round((props.progress.current / props.progress.total) * 100)
})

const currentFileName = computed(() => {
  if (!props.progress) return ''
  const f = props.progress.current_file
  if (!f) return ''
  const sep = f.includes('\\') ? '\\' : '/'
  const parts = f.split(sep)
  return parts[parts.length - 1] || f
})

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}
</script>

<style scoped>
.progress-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #16213e;
  border-radius: 8px;
  border: 1px solid #0f3460;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-count {
  color: #e94560;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

.progress-file {
  color: #8888aa;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-track {
  height: 8px;
  background: #1a1a2e;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0f3460, #e94560);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-time {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #8888aa;
}

.btn-cancel {
  background: rgba(233, 69, 96, 0.15);
  border: 1px solid #e94560;
  color: #e94560;
  cursor: pointer;
  padding: 4px 16px;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: #e94560;
  color: #fff;
}
</style>
