<template>
  <div class="column-filter" ref="filterRef">
    <div class="filter-trigger" @click.stop="toggleFilter">
      <el-icon v-if="hasFilter" class="filter-active"><Filter /></el-icon>
      <el-icon v-else><ArrowDown /></el-icon>
    </div>
    
    <div v-if="visible" class="filter-dropdown" @click.stop>
      <div v-if="column.filterType === 'text' || !column.filterType" class="filter-body">
        <el-input
          v-model="localFilter.text"
          placeholder="输入关键词搜索"
          clearable
          size="small"
          @input="handleDebounceChange"
          @keyup.enter="handleConfirm"
        />
      </div>
      
      <div v-else-if="column.filterType === 'number'" class="filter-body">
        <div class="number-range">
          <el-input-number
            v-model="localFilter.min"
            :min="column.min"
            :max="column.max"
            :precision="column.precision || 0"
            :step="column.step || 1"
            size="small"
            controls-position="right"
            placeholder="最小值"
            style="width: 100%"
            @change="handleChange"
          />
          <span class="range-separator">至</span>
          <el-input-number
            v-model="localFilter.max"
            :min="column.min"
            :max="column.max"
            :precision="column.precision || 0"
            :step="column.step || 1"
            size="small"
            controls-position="right"
            placeholder="最大值"
            style="width: 100%"
            @change="handleChange"
          />
        </div>
      </div>
      
      <div v-else-if="column.filterType === 'date'" class="filter-body">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          :start-placeholder="'开始日期'"
          :end-placeholder="'结束日期'"
          value-format="YYYY-MM-DD"
          size="small"
          style="width: 100%"
          @change="handleDateChange"
        />
      </div>
      
      <div v-else-if="column.filterType === 'select'" class="filter-body">
        <el-select
          v-model="localFilter.value"
          placeholder="请选择"
          clearable
          size="small"
          style="width: 100%"
          @change="handleChange"
        >
          <el-option
            v-for="option in column.filterOptions || []"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
      
      <div class="filter-footer">
        <el-button size="small" @click="handleReset">重置</el-button>
        <el-button size="small" type="primary" @click="handleConfirm">确定</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { debounce } from '@/utils'

const props = defineProps({
  column: {
    type: Object,
    required: true
  },
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'filter-change'])

const visible = ref(false)
const filterRef = ref(null)
const dateRange = ref([])

const localFilter = ref({
  type: props.column.filterType || 'text',
  value: '',
  text: '',
  min: undefined,
  max: undefined,
  start: '',
  end: ''
})

const hasFilter = computed(() => {
  const f = props.modelValue
  if (!f) return false
  if (f.text) return true
  if (f.min !== undefined && f.min !== '') return true
  if (f.max !== undefined && f.max !== '') return true
  if (f.start) return true
  if (f.end) return true
  if (f.value) return true
  return false
})

watch(() => props.modelValue, (val) => {
  if (val) {
    localFilter.value = { ...localFilter.value, ...val }
    if (val.start || val.end) {
      dateRange.value = [val.start, val.end].filter(Boolean)
    }
  }
}, { immediate: true, deep: true })

const toggleFilter = () => {
  visible.value = !visible.value
}

const handleChange = () => {
  emit('update:modelValue', { ...localFilter.value })
}

const handleDebounceChange = debounce(() => {
  handleChange()
  emit('filter-change', { ...localFilter.value })
}, 500)

const handleDateChange = (val) => {
  if (val && val.length === 2) {
    localFilter.value.start = val[0]
    localFilter.value.end = val[1]
  } else {
    localFilter.value.start = ''
    localFilter.value.end = ''
  }
  handleChange()
}

const handleConfirm = () => {
  emit('filter-change', { ...localFilter.value })
  visible.value = false
}

const handleReset = () => {
  localFilter.value = {
    type: props.column.filterType || 'text',
    value: '',
    text: '',
    min: undefined,
    max: undefined,
    start: '',
    end: ''
  }
  dateRange.value = []
  emit('update:modelValue', { ...localFilter.value })
  emit('filter-change', { ...localFilter.value })
  visible.value = false
}

const handleClickOutside = (e) => {
  if (filterRef.value && !filterRef.value.contains(e.target)) {
    visible.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped lang="scss">
.column-filter {
  display: inline-block;
  position: relative;
  margin-left: 4px;
  vertical-align: middle;
  
  .filter-trigger {
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    
    &:hover {
      background-color: rgba(64, 158, 255, 0.1);
    }
    
    .filter-active {
      color: #409eff;
    }
  }
  
  .filter-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background-color: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    padding: 12px;
    min-width: 220px;
    z-index: 2000;
    
    .filter-body {
      margin-bottom: 12px;
    }
    
    .number-range {
      display: flex;
      flex-direction: column;
      gap: 8px;
      
      .range-separator {
        text-align: center;
        color: #909399;
        font-size: 12px;
      }
    }
    
    .filter-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
    }
  }
}
</style>
