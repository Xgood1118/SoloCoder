<template>
  <div class="table-toolbar">
    <div class="toolbar-left">
      <slot name="left">
        <el-button
          v-if="showRefresh"
          :icon="Refresh"
          size="small"
          :loading="loading"
          @click="$emit('refresh')"
        >
          刷新
        </el-button>
        
        <el-button
          v-if="showExport && selectedCount > 0"
          type="success"
          :icon="Download"
          size="small"
          @click="$emit('export-selected')"
        >
          导出选中 ({{ selectedCount }})
        </el-button>
        
        <el-button
          v-if="showExport"
          type="primary"
          :icon="Download"
          size="small"
          @click="$emit('export')"
        >
          导出全部
        </el-button>
        
        <el-button
          v-if="showBatchDelete && selectedCount > 0"
          type="danger"
          :icon="Delete"
          size="small"
          @click="$emit('batch-delete')"
        >
          批量删除 ({{ selectedCount }})
        </el-button>
        
        <el-dropdown
          v-if="showBatchEdit && selectedCount > 0"
          @command="handleBatchEdit"
        >
          <el-button size="small" type="warning">
            批量修改 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in batchEditOptions"
                :key="item.field"
                :command="item"
              >
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        
        <slot name="buttons" />
      </slot>
    </div>
    
    <div class="toolbar-right">
      <div v-if="showDedup" class="dedup-config">
        <el-popover
          placement="bottom"
          :width="300"
          trigger="click"
        >
          <template #reference>
            <el-button size="small" :type="dedupFields.length > 0 ? 'warning' : ''">
              <el-icon><CopyDocument /></el-icon>
              去重设置
            </el-button>
          </template>
          <div class="dedup-content">
            <div class="dedup-title">时间窗口去重字段</div>
            <div class="dedup-tip">
              <el-alert
                title="选择去重依据字段，系统将在指定时间窗口内按这些字段去除重复数据"
                type="info"
                :closable="false"
                size="small"
                show-icon
              />
            </div>
            <el-checkbox-group v-model="localDedupFields" class="dedup-fields">
              <el-checkbox
                v-for="col in dedupColumnOptions"
                :key="col.prop"
                :value="col.prop"
              >
                {{ col.label }}
              </el-checkbox>
            </el-checkbox-group>
            <div class="dedup-actions">
              <el-button size="small" @click="localDedupFields = []">清空</el-button>
              <el-button size="small" type="primary" @click="applyDedup">应用</el-button>
            </div>
          </div>
        </el-popover>
      </div>
      
      <el-button
        v-if="showColumnConfig"
        :icon="Setting"
        size="small"
        @click="$emit('column-config')"
      >
        列配置
      </el-button>
      
      <el-button
        v-if="showClearSelection && selectedCount > 0"
        size="small"
        @click="$emit('clear-selection')"
      >
        清除选择
      </el-button>
      
      <slot name="right" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Refresh, Download, Delete, Setting, ArrowDown, CopyDocument } from '@element-plus/icons-vue'

const props = defineProps({
  loading: Boolean,
  selectedCount: {
    type: Number,
    default: 0
  },
  showRefresh: {
    type: Boolean,
    default: true
  },
  showExport: {
    type: Boolean,
    default: true
  },
  showBatchDelete: {
    type: Boolean,
    default: false
  },
  showBatchEdit: {
    type: Boolean,
    default: false
  },
  batchEditOptions: {
    type: Array,
    default: () => []
  },
  showColumnConfig: {
    type: Boolean,
    default: true
  },
  showClearSelection: {
    type: Boolean,
    default: true
  },
  showDedup: {
    type: Boolean,
    default: true
  },
  dedupFields: {
    type: Array,
    default: () => []
  },
  dedupColumnOptions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'refresh',
  'export',
  'export-selected',
  'batch-delete',
  'batch-edit',
  'column-config',
  'clear-selection',
  'update:dedupFields'
])

const localDedupFields = ref([...props.dedupFields])

watch(() => props.dedupFields, (val) => {
  localDedupFields.value = [...val]
}, { deep: true })

const handleBatchEdit = (item) => {
  emit('batch-edit', item)
}

const applyDedup = () => {
  emit('update:dedupFields', [...localDedupFields.value])
}
</script>

<style scoped lang="scss">
.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  flex-wrap: wrap;
  gap: 12px;
  
  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .dedup-config {
    .dedup-content {
      .dedup-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #303133;
      }
      
      .dedup-tip {
        margin-bottom: 12px;
      }
      
      .dedup-fields {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 12px;
      }
      
      .dedup-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid #f0f0f0;
      }
    }
  }
}
</style>
