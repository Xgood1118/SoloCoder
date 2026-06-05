<template>
  <el-dialog
    v-model="visible"
    title="列配置"
    width="500px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="column-config-dialog">
      <div class="config-tips">
        <el-alert
          title="拖拽调整列顺序，勾选控制列显隐，可拖动调整列宽"
          type="info"
          :closable="false"
          show-icon
        />
      </div>
      
      <div class="column-list">
        <div
          v-for="(column, index) in localColumns"
          :key="column.prop"
          class="column-item"
          draggable="true"
          :class="{ 'dragging': dragIndex === index }"
          @dragstart="handleDragStart(index)"
          @dragover.prevent="handleDragOver(index)"
          @dragend="handleDragEnd"
        >
          <div class="drag-handle">
            <el-icon><Rank /></el-icon>
          </div>
          
          <el-checkbox
            v-model="column.hidden"
            :true-label="false"
            :false-label="true"
            @change="handleColumnToggle(column)"
          >
            <span class="column-label">{{ column.label || column.prop }}</span>
          </el-checkbox>
          
          <div class="column-width-control">
            <span class="width-label">宽度:</span>
            <el-input-number
              v-model="column.width"
              :min="60"
              :max="500"
              :step="10"
              size="small"
              controls-position="right"
              style="width: 100px"
            />
            <span class="width-unit">px</span>
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleReset">恢复默认</el-button>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave">保存配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { deepClone } from '@/utils'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  columns: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'save', 'reset'])

const visible = ref(props.modelValue)
const localColumns = ref([])
const dragIndex = ref(-1)
const dragOverIndex = ref(-1)

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    localColumns.value = deepClone(props.columns)
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const handleDragStart = (index) => {
  dragIndex.value = index
}

const handleDragOver = (index) => {
  if (dragIndex.value === -1 || dragIndex.value === index) return
  
  const item = localColumns.value.splice(dragIndex.value, 1)[0]
  localColumns.value.splice(index, 0, item)
  dragIndex.value = index
}

const handleDragEnd = () => {
  dragIndex.value = -1
}

const handleColumnToggle = (column) => {
  const visibleCount = localColumns.value.filter(c => !c.hidden).length
  if (visibleCount === 0) {
    column.hidden = false
    ElMessage.warning('至少需要显示一列')
  }
}

const handleReset = () => {
  emit('reset')
}

const handleSave = () => {
  emit('save', deepClone(localColumns.value))
  visible.value = false
}

const handleClose = () => {
  visible.value = false
}
</script>

<style scoped lang="scss">
.column-config-dialog {
  .config-tips {
    margin-bottom: 16px;
  }
  
  .column-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    
    .column-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.2s;
      
      &:last-child {
        border-bottom: none;
      }
      
      &:hover {
        background-color: #f5f7fa;
      }
      
      &.dragging {
        opacity: 0.5;
        background-color: #ecf5ff;
      }
      
      .drag-handle {
        cursor: move;
        color: #c0c4cc;
        margin-right: 8px;
        display: flex;
        align-items: center;
        
        &:hover {
          color: #409eff;
        }
      }
      
      .column-label {
        font-size: 14px;
        color: #303133;
      }
      
      .column-width-control {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        
        .width-label {
          font-size: 12px;
          color: #909399;
        }
        
        .width-unit {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }
}
</style>
