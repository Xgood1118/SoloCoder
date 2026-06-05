<template>
  <div class="bi-pagination">
    <div class="pagination-left">
      <span class="total-text">共 {{ total }} 条</span>
      <span v-if="selectedCount > 0" class="selected-text">
        已选择 <em>{{ selectedCount }}</em> 项
      </span>
    </div>
    
    <div class="pagination-right">
      <el-pagination
        v-model:current-page="internalPage"
        v-model:page-size="internalPageSize"
        :page-sizes="pageSizes"
        :total="total"
        :layout="layout"
        :background="background"
        :disabled="disabled"
        :hide-on-single-page="hideOnSinglePage"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { setUrlParams, getUrlParams } from '@/utils'

const props = defineProps({
  modelValue: {
    type: Number,
    default: 1
  },
  pageSize: {
    type: Number,
    default: 20
  },
  total: {
    type: Number,
    default: 0
  },
  pageSizes: {
    type: Array,
    default: () => [10, 20, 50, 100]
  },
  layout: {
    type: String,
    default: 'sizes, prev, pager, next, jumper'
  },
  background: {
    type: Boolean,
    default: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  hideOnSinglePage: {
    type: Boolean,
    default: false
  },
  selectedCount: {
    type: Number,
    default: 0
  },
  syncUrl: {
    type: Boolean,
    default: true
  },
  urlKeyPrefix: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'update:pageSize', 'change', 'size-change', 'current-change'])

const internalPage = ref(props.modelValue)
const internalPageSize = ref(props.pageSize)

const pageKey = computed(() => props.urlKeyPrefix ? `${props.urlKeyPrefix}_page` : 'page')
const pageSizeKey = computed(() => props.urlKeyPrefix ? `${props.urlKeyPrefix}_pageSize` : 'pageSize')

watch(() => props.modelValue, (val) => {
  internalPage.value = val
})

watch(() => props.pageSize, (val) => {
  internalPageSize.value = val
})

watch(internalPage, (val) => {
  emit('update:modelValue', val)
})

watch(internalPageSize, (val) => {
  emit('update:pageSize', val)
})

const handleSizeChange = (val) => {
  internalPage.value = 1
  if (props.syncUrl) {
    setUrlParams({
      [pageKey.value]: 1,
      [pageSizeKey.value]: val
    })
  }
  emit('size-change', val)
  emit('change', { page: 1, pageSize: val })
}

const handleCurrentChange = (val) => {
  if (props.syncUrl) {
    setUrlParams({
      [pageKey.value]: val,
      [pageSizeKey.value]: internalPageSize.value
    })
  }
  emit('current-change', val)
  emit('change', { page: val, pageSize: internalPageSize.value })
}

onMounted(() => {
  if (props.syncUrl) {
    const params = getUrlParams()
    if (params[pageKey.value]) {
      const page = parseInt(params[pageKey.value])
      if (!isNaN(page) && page > 0) {
        internalPage.value = page
        emit('update:modelValue', page)
      }
    }
    if (params[pageSizeKey.value]) {
      const size = parseInt(params[pageSizeKey.value])
      if (!isNaN(size) && props.pageSizes.includes(size)) {
        internalPageSize.value = size
        emit('update:pageSize', size)
      }
    }
  }
})
</script>

<style scoped lang="scss">
.bi-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  
  .pagination-left {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .total-text {
      color: #606266;
      font-size: 14px;
    }
    
    .selected-text {
      color: #909399;
      font-size: 14px;
      
      em {
        color: #409eff;
        font-style: normal;
        font-weight: 600;
      }
    }
  }
  
  .pagination-right {
    :deep(.el-pagination) {
      display: flex;
      align-items: center;
      
      .el-pager li {
        background-color: #fff;
        border: 1px solid #dcdfe6;
        
        &.active {
          border-color: #409eff;
        }
      }
      
      .btn-prev,
      .btn-next {
        background-color: #fff;
        border: 1px solid #dcdfe6;
      }
    }
  }
}
</style>
