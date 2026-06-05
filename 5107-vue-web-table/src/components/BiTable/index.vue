<template>
  <div class="bi-table-wrapper" v-loading="loading">
    <TableToolbar
      v-if="showToolbar"
      :loading="loading"
      :selected-count="selectionStore.selectedCount"
      :show-refresh="toolbarConfig.showRefresh"
      :show-export="toolbarConfig.showExport"
      :show-batch-delete="toolbarConfig.showBatchDelete"
      :show-batch-edit="toolbarConfig.showBatchEdit"
      :batch-edit-options="toolbarConfig.batchEditOptions"
      :show-column-config="toolbarConfig.showColumnConfig"
      :show-clear-selection="toolbarConfig.showClearSelection"
      :show-dedup="toolbarConfig.showDedup"
      v-model:dedup-fields="dedupFields"
      :dedup-column-options="dedupColumnOptions"
      @refresh="handleRefresh"
      @export="handleExport"
      @export-selected="handleExportSelected"
      @batch-delete="handleBatchDelete"
      @batch-edit="handleBatchEdit"
      @column-config="columnConfigVisible = true"
      @clear-selection="handleClearSelection"
    >
      <template #buttons>
        <slot name="toolbar-buttons" />
      </template>
      <template #left>
        <slot name="toolbar-left" />
      </template>
      <template #right>
        <slot name="toolbar-right" />
      </template>
    </TableToolbar>
    
    <div class="table-container">
      <el-table
        ref="tableRef"
        :data="tableData"
        :border="border"
        :stripe="stripe"
        :size="size"
        :height="height"
        :max-height="maxHeight"
        :highlight-current-row="highlightCurrentRow"
        :row-key="rowKey"
        :default-sort="defaultSort"
        :show-header="showHeader"
        :show-summary="showSummary"
        :summary-method="summaryMethod"
        :empty-text="emptyText"
        :expand-row-keys="expandRowKeys"
        :tree-props="treeProps"
        :header-cell-style="headerCellStyle"
        :cell-style="cellStyle"
        :default-expand-all="defaultExpandAll"
        @select="handleSelect"
        @select-all="handleSelectAll"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        @row-dblclick="handleRowDblclick"
        @expand-change="handleExpandChange"
        @header-dragend="handleHeaderDragend"
      >
        <el-table-column
          v-if="selectable"
          type="selection"
          width="50"
          align="center"
          :selectable="handleSelectable"
          :reserve-selection="true"
        >
          <template #header>
            <el-checkbox
              v-if="selectMode === 'multiple'"
              :model-value="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="handleHeaderCheckboxChange"
            />
            <span v-else class="selection-header">选择</span>
          </template>
        </el-table-column>
        
        <el-table-column
          v-if="showIndex"
          type="index"
          label="序号"
          width="60"
          align="center"
          :index="getIndex"
        />
        
        <template v-for="column in visibleColumns" :key="column.prop">
          <el-table-column
            :prop="column.prop"
            :label="column.label"
            :width="column.width"
            :min-width="column.minWidth"
            :fixed="column.fixed"
            :align="column.align || 'left'"
            :sortable="column.sortable !== false ? 'custom' : false"
            :resizable="column.resizable !== false"
            :show-overflow-tooltip="column.showOverflowTooltip !== false"
            :formatter="column.formatter"
          >
            <template #header="{ column: col }">
              <div class="header-content">
                <div 
                  class="header-sortable" 
                  @click="handleHeaderClick(col, $event)"
                  @mousedown="handleHeaderMouseDown($event)"
                >
                  <span class="header-label">{{ col.label }}</span>
                  <span class="sort-caret-wrapper" v-if="column.sortable !== false">
                    <span 
                      class="sort-caret sort-ascending" 
                      :class="{ active: getSortOrder(col.property) === 'ascending' }"
                    ></span>
                    <span 
                      class="sort-caret sort-descending"
                      :class="{ active: getSortOrder(col.property) === 'descending' }"
                    ></span>
                  </span>
                </div>
                <ColumnFilter
                  v-if="column.filterable !== false && column.filterType !== 'none'"
                  :column="column"
                  v-model="filters[column.prop]"
                  @filter-change="handleFilterChange"
                />
              </div>
            </template>
            
            <template #default="{ row, $index }">
              <slot
                v-if="$slots[`cell-${column.prop}`]"
                :name="`cell-${column.prop}`"
                :row="row"
                :column="column"
                :index="$index"
              />
              <component
                v-else-if="column.component"
                :is="column.component"
                :row="row"
                :column="column"
                :index="$index"
              />
              <span v-else>{{ formatCell(row, column) }}</span>
            </template>
          </el-table-column>
        </template>
        
        <el-table-column
          v-if="$slots.actions || actions.length > 0"
          label="操作"
          :width="actionsWidth"
          :fixed="actionsFixed"
          align="center"
        >
          <template #default="{ row, $index }">
            <slot name="actions" :row="row" :index="$index" />
            <template v-for="action in actions" :key="action.key">
              <el-button
                v-if="!action.show || action.show(row)"
                :type="action.type || 'primary'"
                :link="action.link !== false"
                size="small"
                :disabled="action.disabled && action.disabled(row)"
                @click="handleActionClick(action, row, $index)"
              >
                {{ action.label }}
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <BiPagination
      v-if="showPagination"
      v-model="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="pageSizes"
      :selected-count="selectionStore.selectedCount"
      :sync-url="syncUrl"
      :url-key-prefix="tableKey"
      @change="handlePaginationChange"
    />
    
    <ColumnConfig
      v-model="columnConfigVisible"
      :columns="columns"
      @save="handleColumnConfigSave"
      @reset="handleColumnConfigReset"
    />
    
    <el-dialog
      v-model="batchEditVisible"
      :title="`批量修改${currentBatchEditField?.label || ''}`"
      width="400px"
      @close="batchEditVisible = false"
    >
      <el-form :model="batchEditForm" label-width="80px">
        <el-form-item :label="currentBatchEditField?.label">
          <component
            v-if="currentBatchEditField?.component"
            :is="currentBatchEditField.component"
            v-model="batchEditForm.value"
          />
          <el-select
            v-else-if="currentBatchEditField?.options"
            v-model="batchEditForm.value"
            placeholder="请选择"
            style="width: 100%"
          >
            <el-option
              v-for="opt in currentBatchEditField.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-input
            v-else
            v-model="batchEditForm.value"
            :placeholder="`请输入${currentBatchEditField?.label || ''}`"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchEditLoading" @click="submitBatchEdit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, provide } from 'vue'
import { useSelectionStore } from '@/stores/selection'
import { useColumnConfigStore } from '@/stores/columnConfig'
import { mockFetchTableData } from '@/api/table'
import { exportToExcel, exportSelectedToExcel } from '@/utils/export'
import { formatDate, formatNumber, deepClone, getUrlParams } from '@/utils'
import ColumnFilter from './ColumnFilter.vue'
import BiPagination from './BiPagination.vue'
import ColumnConfig from './ColumnConfig.vue'
import TableToolbar from './TableToolbar.vue'

const props = defineProps({
  tableKey: {
    type: String,
    required: true
  },
  columns: {
    type: Array,
    required: true
  },
  requestApi: {
    type: Function,
    default: null
  },
  exportApi: {
    type: Function,
    default: null
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  border: {
    type: Boolean,
    default: true
  },
  stripe: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: 'default'
  },
  height: {
    type: [Number, String],
    default: '100%'
  },
  maxHeight: {
    type: [Number, String],
    default: null
  },
  highlightCurrentRow: {
    type: Boolean,
    default: true
  },
  defaultSort: {
    type: Object,
    default: () => ({})
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  showSummary: {
    type: Boolean,
    default: false
  },
  summaryMethod: {
    type: Function,
    default: null
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  expandRowKeys: {
    type: Array,
    default: () => []
  },
  treeProps: {
    type: Object,
    default: () => ({ children: 'children', hasChildren: 'hasChildren' })
  },
  defaultExpandAll: {
    type: Boolean,
    default: false
  },
  showToolbar: {
    type: Boolean,
    default: true
  },
  toolbarConfig: {
    type: Object,
    default: () => ({
      showRefresh: true,
      showExport: true,
      showBatchDelete: false,
      showBatchEdit: false,
      batchEditOptions: [],
      showColumnConfig: true,
      showClearSelection: true,
      showDedup: true
    })
  },
  showPagination: {
    type: Boolean,
    default: true
  },
  showIndex: {
    type: Boolean,
    default: true
  },
  pageSizes: {
    type: Array,
    default: () => [10, 20, 50, 100]
  },
  selectable: {
    type: Boolean,
    default: true
  },
  selectMode: {
    type: String,
    default: 'multiple'
  },
  selectableHandler: {
    type: Function,
    default: null
  },
  syncUrl: {
    type: Boolean,
    default: true
  },
  autoLoad: {
    type: Boolean,
    default: true
  },
  actions: {
    type: Array,
    default: () => []
  },
  actionsWidth: {
    type: [Number, String],
    default: 150
  },
  actionsFixed: {
    type: [String, Boolean],
    default: 'right'
  },
  headerCellStyle: {
    type: Object,
    default: () => ({ background: '#f5f7fa', color: '#303133' })
  },
  cellStyle: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'data-loaded',
  'selection-change',
  'row-click',
  'row-dblclick',
  'action-click',
  'sort-change',
  'filter-change',
  'pagination-change',
  'batch-delete',
  'batch-edit-submit',
  'export-start',
  'export-end'
])

const tableRef = ref(null)
const loading = ref(false)
const tableData = ref([])
const internalColumns = ref([])

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const sorts = ref([])
const filters = ref({})
const dedupFields = ref([])

const columnConfigVisible = ref(false)
const batchEditVisible = ref(false)
const batchEditLoading = ref(false)
const currentBatchEditField = ref(null)
const batchEditForm = ref({ value: null })

const selectionStore = useSelectionStore()
const columnConfigStore = useColumnConfigStore()

provide('tableKey', props.tableKey)

const visibleColumns = computed(() => {
  return internalColumns.value.filter(col => !col.hidden)
})

const dedupColumnOptions = computed(() => {
  return internalColumns.value
    .filter(col => col.dedupable !== false)
    .map(col => ({ prop: col.prop, label: col.label || col.prop }))
})

const isAllSelected = computed(() => {
  return selectionStore.isAllSelected(tableData.value)
})

const isIndeterminate = computed(() => {
  return selectionStore.isIndeterminate(tableData.value)
})

const inferFilterType = (col) => {
  if (col.filterType) return col.filterType
  if (col.type === 'number' || col.dataType === 'number') return 'number'
  if (col.type === 'date' || col.dataType === 'date') return 'date'
  if (col.options || col.filterOptions) return 'select'
  return 'text'
}

const initColumns = (columns) => {
  const loadedColumns = columnConfigStore.load(props.tableKey, columns)
  internalColumns.value = loadedColumns.map((col, index) => ({
    width: 150,
    minWidth: 100,
    align: 'left',
    sortable: true,
    filterable: true,
    filterType: inferFilterType(col),
    resizable: true,
    showOverflowTooltip: true,
    hidden: false,
    order: index,
    ...col
  }))
}

const initFromUrlParams = () => {
  const params = getUrlParams()
  if (params.page) {
    const page = parseInt(params.page)
    if (!isNaN(page) && page > 0) {
      pagination.value.page = page
    }
  }
  if (params.pageSize) {
    const size = parseInt(params.pageSize)
    if (!isNaN(size) && props.pageSizes.includes(size)) {
      pagination.value.pageSize = size
    }
  }
  if (params.sorts) {
    try {
      sorts.value = JSON.parse(decodeURIComponent(params.sorts))
    } catch (e) {
      console.warn('Parse sorts from url failed:', e)
    }
  }
}

const buildRequestParams = () => {
  return {
    page: pagination.value.page,
    pageSize: pagination.value.pageSize,
    sorts: sorts.value,
    filters: Object.fromEntries(
      Object.entries(filters.value).filter(([_, v]) => {
        if (!v) return false
        if (typeof v === 'object') {
          return Object.values(v).some(val => val !== undefined && val !== '' && val !== null)
        }
        return v !== ''
      })
    ),
    dedupFields: dedupFields.value
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const params = buildRequestParams()
    const api = props.requestApi || mockFetchTableData
    const result = await api(params)
    
    const data = result.data || result
    tableData.value = data.list || []
    pagination.value.total = data.total || 0
    pagination.value.page = data.page || pagination.value.page
    pagination.value.pageSize = data.pageSize || pagination.value.pageSize
    
    emit('data-loaded', {
      data: tableData.value,
      pagination: { ...pagination.value },
      total: pagination.value.total
    })
  } catch (error) {
    console.error('Fetch table data error:', error)
    tableData.value = []
    pagination.value.total = 0
  } finally {
    loading.value = false
  }
}

watch(() => props.columns, (val) => {
  initColumns(val)
}, { immediate: true, deep: true })

watch([pagination, sorts, filters, dedupFields], () => {
  if (props.autoLoad) {
    fetchData()
  }
}, { deep: true })

const syncSortToTable = () => {
  nextTick(() => {
    if (tableRef.value && sorts.value.length > 0) {
      sorts.value.forEach(sort => {
        tableRef.value.sort(sort.prop, sort.order === 'ascending' ? 'asc' : 'desc')
      })
    }
  })
}

onMounted(() => {
  selectionStore.init(props.tableKey, props.rowKey)
  
  if (props.syncUrl) {
    initFromUrlParams()
  }
  
  if (props.autoLoad) {
    nextTick(() => {
      fetchData()
    })
  }
})

const isShiftPressed = ref(false)

const getSortOrder = (prop) => {
  const sort = sorts.value.find(s => s.prop === prop)
  return sort ? sort.order : null
}

const getSortPriority = (prop) => {
  const index = sorts.value.findIndex(s => s.prop === prop)
  return index >= 0 ? index + 1 : null
}

const handleHeaderMouseDown = (e) => {
  isShiftPressed.value = e.shiftKey
}

const handleHeaderClick = (col, e) => {
  if (col.sortable === false) return
  
  const prop = col.property
  const shiftPressed = e.shiftKey || isShiftPressed.value
  
  const existingIndex = sorts.value.findIndex(s => s.prop === prop)
  
  if (existingIndex !== -1) {
    const currentOrder = sorts.value[existingIndex].order
    if (currentOrder === 'ascending') {
      sorts.value[existingIndex].order = 'descending'
    } else if (currentOrder === 'descending') {
      sorts.value.splice(existingIndex, 1)
    }
  } else {
    if (shiftPressed) {
      sorts.value.push({ prop, order: 'ascending' })
    } else {
      sorts.value = [{ prop, order: 'ascending' }]
    }
  }
  
  emit('sort-change', [...sorts.value])
}

const handleRefresh = () => {
  fetchData()
}

const handleSortChange = () => {
}

const handleFilterChange = (filter, column) => {
  emit('filter-change', { ...filters.value })
}

const handlePaginationChange = (val) => {
  pagination.value.page = val.page
  pagination.value.pageSize = val.pageSize
  emit('pagination-change', { ...pagination.value })
}

const handleSelect = (selection, row) => {
  const isSelected = selection.some(item => item[props.rowKey] === row[props.rowKey])
  selectionStore.setSelected(row, isSelected)
}

const handleSelectAll = (selection) => {
  selectionStore.setAllSelected(tableData.value, selection.length > 0)
}

const handleSelectionChange = (selection) => {
  emit('selection-change', selectionStore.selectedRows)
}

const handleHeaderCheckboxChange = (val) => {
  selectionStore.setAllSelected(tableData.value, val)
}

const handleSelectable = (row, index) => {
  if (props.selectableHandler) {
    return props.selectableHandler(row, index)
  }
  return true
}

const handleRowClick = (row, column, event) => {
  emit('row-click', row, column, event)
}

const handleRowDblclick = (row, column, event) => {
  emit('row-dblclick', row, column, event)
}

const handleExpandChange = (row, expandedRows) => {
}

const handleHeaderDragend = (newWidth, oldWidth, column, event) => {
  const targetCol = internalColumns.value.find(c => c.prop === column.property)
  if (targetCol) {
    targetCol.width = newWidth
    saveColumnConfig()
  }
}

const handleClearSelection = () => {
  selectionStore.clear()
  tableRef.value?.clearSelection()
}

const handleActionClick = (action, row, index) => {
  emit('action-click', { action, row, index })
  if (action.onClick) {
    action.onClick(row, index)
  }
}

const handleColumnConfigSave = (newColumns) => {
  internalColumns.value = newColumns
  saveColumnConfig()
  ElMessage.success('列配置已保存')
}

const handleColumnConfigReset = () => {
  columnConfigStore.reset(props.tableKey)
  initColumns(props.columns)
  ElMessage.success('列配置已重置')
}

const saveColumnConfig = () => {
  columnConfigStore.save(props.tableKey, internalColumns.value)
}

const handleBatchDelete = () => {
  emit('batch-delete', selectionStore.selectedRows)
}

const handleBatchEdit = (field) => {
  currentBatchEditField.value = field
  batchEditForm.value = { value: null }
  batchEditVisible.value = true
}

const submitBatchEdit = async () => {
  if (batchEditForm.value.value === null || batchEditForm.value.value === '') {
    ElMessage.warning('请输入修改值')
    return
  }
  
  batchEditLoading.value = true
  try {
    const data = {
      field: currentBatchEditField.value.field,
      value: batchEditForm.value.value,
      ids: selectionStore.selectedIds
    }
    emit('batch-edit-submit', data)
    batchEditVisible.value = false
    ElMessage.success('批量修改成功')
    fetchData()
  } finally {
    batchEditLoading.value = false
  }
}

const handleExport = async () => {
  emit('export-start')
  try {
    const params = buildRequestParams()
    params.pageSize = pagination.value.total
    params.page = 1
    
    let exportData = []
    
    if (props.exportApi) {
      const result = await props.exportApi(params)
      exportData = result.data?.list || result.list || result.data || []
    } else {
      const result = await mockFetchTableData(params)
      exportData = result.data?.list || result.list || []
    }
    
    const exportColumns = internalColumns.value.filter(col => !col.hidden)
    exportToExcel(exportColumns, exportData, props.tableKey)
    
    ElMessage.success('导出成功')
    emit('export-end', { success: true, count: exportData.length })
  } catch (error) {
    console.error('Export error:', error)
    ElMessage.error('导出失败')
    emit('export-end', { success: false, error })
  }
}

const handleExportSelected = () => {
  if (selectionStore.selectedCount === 0) {
    ElMessage.warning('请先选择要导出的数据')
    return
  }
  const exportColumns = internalColumns.value.filter(col => !col.hidden)
  exportSelectedToExcel(exportColumns, selectionStore.selectedRows, `${props.tableKey}_selected`)
  ElMessage.success(`已导出 ${selectionStore.selectedCount} 条数据`)
}

const formatCell = (row, column) => {
  const value = row[column.prop]
  
  if (column.formatter) {
    return column.formatter(row, column, value)
  }
  
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  
  if (column.dataType === 'date' || column.type === 'date') {
    return formatDate(value, column.dateFormat || 'YYYY-MM-DD HH:mm:ss')
  }
  
  if (column.dataType === 'number' || column.type === 'number') {
    return formatNumber(value, column.precision)
  }
  
  if (column.options || column.filterOptions) {
    const opt = (column.options || column.filterOptions).find(o => o.value === value)
    return opt ? opt.label : value
  }
  
  return value
}

const getIndex = (index) => {
  return (pagination.value.page - 1) * pagination.value.pageSize + index + 1
}

defineExpose({
  refresh: fetchData,
  clearSelection: handleClearSelection,
  getSelectedRows: () => selectionStore.selectedRows,
  getSelectedIds: () => selectionStore.selectedIds,
  getPagination: () => ({ ...pagination.value }),
  getFilters: () => ({ ...filters.value }),
  getSorts: () => [...sorts.value],
  setPage: (page) => {
    pagination.value.page = page
  },
  setPageSize: (size) => {
    pagination.value.pageSize = size
  },
  resetFilters: () => {
    filters.value = {}
  },
  resetSorts: () => {
    sorts.value = []
  },
  resetAll: () => {
    pagination.value.page = 1
    filters.value = {}
    sorts.value = []
    selectionStore.clear()
  }
})
</script>

<style scoped lang="scss">
.bi-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #fff;
  border-radius: 4px;
  padding: 16px;
  
  .table-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
    
    :deep(.el-table) {
      .header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        
        .header-sortable {
          display: flex;
          align-items: center;
          flex: 1;
          cursor: pointer;
          user-select: none;
          min-width: 0;
          
          &:hover {
            color: #409eff;
          }
          
          &:hover .sort-caret-wrapper {
            .sort-caret {
              border-color: #c0c4cc;
              
              &.active {
                border-color: #409eff;
              }
            }
          }
        }
        
        .header-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-right: 4px;
        }
        
        .sort-caret-wrapper {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          height: 14px;
          width: 14px;
          vertical-align: middle;
          margin-left: 2px;
          
          .sort-caret {
            position: absolute;
            width: 0;
            height: 0;
            border: 5px solid transparent;
            
            &.sort-ascending {
              top: 0;
              border-bottom-color: #c0c4cc;
              border-top: none;
              
              &.active {
                border-bottom-color: #409eff;
              }
            }
            
            &.sort-descending {
              bottom: 0;
              border-top-color: #c0c4cc;
              border-bottom: none;
              
              &.active {
                border-top-color: #409eff;
              }
            }
          }
        }
      }
      
      .selection-header {
        font-size: 14px;
      }
    }
    
    :deep(.el-table__header th) {
      background-color: #f5f7fa !important;
      color: #303133;
      font-weight: 600;
    }
    
    :deep(.el-table__row:hover > td) {
      background-color: #ecf5ff !important;
    }
    
    :deep(.el-table--enable-row-hover .el-table__body tr:hover > td) {
      background-color: #ecf5ff !important;
    }
  }
}
</style>
