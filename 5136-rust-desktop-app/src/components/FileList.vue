<template>
  <div class="file-list">
    <div
      class="drop-zone"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
      @click="addFiles"
    >
      <div class="drop-zone-text">
        <span class="drop-icon">+</span>
        <span>拖拽图片到此处或点击选择文件</span>
      </div>
    </div>
    <div v-if="files.length > 0" class="file-items">
      <div class="file-header">
        <span>已选择 {{ files.length }} 个文件</span>
        <button class="btn-clear" @click="$emit('clear')">清空</button>
      </div>
      <div class="file-scroll">
        <div
          v-for="(file, index) in files"
          :key="index"
          class="file-item"
        >
          <span class="file-name" :title="file">{{ getFileName(file) }}</span>
          <button class="btn-remove" @click="$emit('remove', index)" :disabled="disabled">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  files: readonly string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  add: [paths: string[]]
  remove: [index: number]
  clear: []
}>()

const dragging = ref(false)

function getFileName(path: string): string {
  const sep = path.includes('\\') ? '\\' : '/'
  const parts = path.split(sep)
  return parts[parts.length - 1] || path
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (props.disabled) return
  if (!e.dataTransfer) return
  const paths: string[] = []
  for (const file of e.dataTransfer.files) {
    if ('path' in file && typeof (file as File & { path: string }).path === 'string') {
      paths.push((file as File & { path: string }).path)
    }
  }
  if (paths.length > 0) {
    emit('add', paths)
  }
}

async function addFiles() {
  if (props.disabled) return
  const { open } = await import('@tauri-apps/plugin-dialog')
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
  emit('add', paths)
}
</script>

<style scoped>
.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drop-zone {
  border: 2px dashed #3a3a5c;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #1a1a2e;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: #e94560;
  background: #1e1e3a;
}

.drop-zone-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #8888aa;
  font-size: 14px;
}

.drop-icon {
  font-size: 28px;
  color: #e94560;
  line-height: 1;
}

.file-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #aaaacc;
  padding: 0 4px;
}

.btn-clear {
  background: none;
  border: none;
  color: #e94560;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.btn-clear:hover {
  background: rgba(233, 69, 96, 0.15);
}

.file-scroll {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-scroll::-webkit-scrollbar {
  width: 6px;
}

.file-scroll::-webkit-scrollbar-thumb {
  background: #3a3a5c;
  border-radius: 3px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #16213e;
  border-radius: 4px;
  font-size: 13px;
}

.file-name {
  color: #ccccee;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.btn-remove {
  background: none;
  border: none;
  color: #666688;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
  border-radius: 4px;
}

.btn-remove:hover:not(:disabled) {
  color: #e94560;
  background: rgba(233, 69, 96, 0.1);
}

.btn-remove:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
