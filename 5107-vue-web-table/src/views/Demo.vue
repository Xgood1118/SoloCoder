<template>
  <div class="demo-page">
    <div class="page-header">
      <h2 class="page-title">BI 数据表格组件演示</h2>
      <p class="page-desc">
        支持分页排序、多列过滤、时间窗口去重、行选择跨分页、Excel导出、列配置保存等功能
      </p>
    </div>
    
    <div class="page-content">
      <el-card shadow="never" class="table-card">
        <BiTable
          ref="tableRef"
          table-key="order_list_demo"
          :columns="columns"
          :toolbar-config="toolbarConfig"
          :actions="actions"
          :row-key="'id'"
          :select-mode="'multiple'"
          :show-index="true"
          :sync-url="true"
          :page-sizes="[10, 20, 50, 100]"
          :height="'calc(100vh - 280px)'"
          @data-loaded="handleDataLoaded"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
          @action-click="handleActionClick"
          @batch-delete="handleBatchDelete"
          @batch-edit-submit="handleBatchEditSubmit"
        >
          <template #cell-amount="{ row }">
            <span :class="row.amount > 5000 ? 'high-amount' : ''">
              ¥{{ formatNumber(row.amount, 2) }}
            </span>
          </template>
          
          <template #cell-status="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status }}
            </el-tag>
          </template>
          
          <template #toolbar-buttons>
            <el-button type="primary" size="small" :icon="Plus" @click="handleAdd">
              新增订单
            </el-button>
          </template>
        </BiTable>
      </el-card>
      
      <el-card shadow="never" class="info-card">
        <div class="info-title">功能说明</div>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="分页功能">
            支持自定义每页条数，URL同步，刷新保持分页状态
          </el-descriptions-item>
          <el-descriptions-item label="多列排序">
            按住 Shift 点击列头可进行多列排序，按点击顺序排序
          </el-descriptions-item>
          <el-descriptions-item label="列头筛选">
            支持文本模糊搜索、数字范围、日期范围、下拉选择
          </el-descriptions-item>
          <el-descriptions-item label="时间窗口去重">
            点击「去重设置」选择去重字段，按指定字段去除重复数据
          </el-descriptions-item>
          <el-descriptions-item label="行选择">
            支持单选/多选，跨分页保持选中状态，localStorage 持久化
          </el-descriptions-item>
          <el-descriptions-item label="Excel导出">
            支持导出全部筛选结果或仅导出选中行，保持当前列顺序
          </el-descriptions-item>
          <el-descriptions-item label="列配置">
            支持调整列宽、列顺序、显示/隐藏列，自动保存用户配置
          </el-descriptions-item>
          <el-descriptions-item label="批量操作">
            支持批量删除、批量修改字段，可自定义批量操作项
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </div>
    
    <el-dialog v-model="detailVisible" title="订单详情" width="600px">
      <el-descriptions v-if="currentRow" :column="2" border>
        <el-descriptions-item label="订单号">{{ currentRow.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="业务ID">{{ currentRow.businessId }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ currentRow.businessType }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(currentRow.status)" size="small">
            {{ currentRow.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ formatNumber(currentRow.amount, 2) }}</el-descriptions-item>
        <el-descriptions-item label="数量">{{ currentRow.quantity }}</el-descriptions-item>
        <el-descriptions-item label="区域">{{ currentRow.region }}</el-descriptions-item>
        <el-descriptions-item label="产品">{{ currentRow.product }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ currentRow.customerName }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ currentRow.phone }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(currentRow.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentRow.operator }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentRow.remark || '无' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, shallowRef } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { BiTable } from '@/components'
import { formatDate, formatNumber } from '@/utils'
import { mockFetchTableData } from '@/api/table'

const tableRef = ref(null)
const detailVisible = ref(false)
const currentRow = ref(null)

const columns = [
  { prop: 'orderNo', label: '订单号', width: 150, fixed: 'left', dataType: 'text' },
  { prop: 'businessId', label: '业务ID', width: 130, dataType: 'text', dedupable: true },
  { prop: 'businessType', label: '业务类型', width: 100, filterType: 'select', 
    filterOptions: [
      { label: '订单', value: '订单' },
      { label: '退款', value: '退款' },
      { label: '换货', value: '换货' },
      { label: '维修', value: '维修' },
      { label: '咨询', value: '咨询' }
    ]
  },
  { prop: 'amount', label: '金额', width: 120, dataType: 'number', precision: 2, filterType: 'number' },
  { prop: 'quantity', label: '数量', width: 100, dataType: 'number', filterType: 'number' },
  { prop: 'status', label: '状态', width: 100, filterType: 'select',
    filterOptions: [
      { label: '待处理', value: '待处理' },
      { label: '处理中', value: '处理中' },
      { label: '已完成', value: '已完成' },
      { label: '已取消', value: '已取消' }
    ]
  },
  { prop: 'region', label: '区域', width: 100, dedupable: true },
  { prop: 'product', label: '产品', width: 100 },
  { prop: 'customerName', label: '客户名称', width: 120 },
  { prop: 'phone', label: '联系电话', width: 140 },
  { prop: 'createTime', label: '创建时间', width: 180, dataType: 'date', filterType: 'date' },
  { prop: 'operator', label: '操作人', width: 100 },
  { prop: 'remark', label: '备注', width: 150, filterType: 'none', sortable: false }
]

const toolbarConfig = {
  showRefresh: true,
  showExport: true,
  showBatchDelete: true,
  showBatchEdit: true,
  batchEditOptions: [
    { field: 'status', label: '状态', options: [
      { label: '待处理', value: '待处理' },
      { label: '处理中', value: '处理中' },
      { label: '已完成', value: '已完成' },
      { label: '已取消', value: '已取消' }
    ]},
    { field: 'operator', label: '操作人' }
  ],
  showColumnConfig: true,
  showClearSelection: true,
  showDedup: true
}

const actions = [
  { 
    key: 'view', 
    label: '查看', 
    type: 'primary', 
    onClick: (row) => handleView(row)
  },
  { 
    key: 'edit', 
    label: '编辑', 
    type: 'primary'
  },
  { 
    key: 'delete', 
    label: '删除', 
    type: 'danger',
    show: (row) => row.status !== '已完成'
  }
]

const fetchData = shallowRef(async (params) => {
  return await mockFetchTableData(params)
})

const handleDataLoaded = (data) => {
  console.log('Data loaded:', data)
}

const handleSelectionChange = (selection) => {
  console.log('Selection changed:', selection)
}

const handleRowClick = (row) => {
  console.log('Row clicked:', row)
}

const handleActionClick = ({ action, row, index }) => {
  console.log('Action clicked:', action.key, row, index)
  if (action.key === 'edit') {
    ElMessage.info(`编辑订单: ${row.orderNo}`)
  } else if (action.key === 'delete') {
    ElMessageBox.confirm(
      `确定删除订单 ${row.orderNo} 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => {
      ElMessage.success('删除成功')
      tableRef.value?.refresh()
    }).catch(() => {})
  }
}

const handleView = (row) => {
  currentRow.value = row
  detailVisible.value = true
}

const handleAdd = () => {
  ElMessage.info('新增订单功能')
}

const handleBatchDelete = (rows) => {
  ElMessageBox.confirm(
    `确定删除选中的 ${rows.length} 条订单吗？`,
    '批量删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    ElMessage.success(`成功删除 ${rows.length} 条数据`)
    tableRef.value?.refresh()
    tableRef.value?.clearSelection()
  }).catch(() => {})
}

const handleBatchEditSubmit = (data) => {
  console.log('Batch edit submit:', data)
  ElMessage.success(`成功修改 ${data.ids.length} 条数据的 ${data.field} 字段`)
  tableRef.value?.refresh()
}

const getStatusType = (status) => {
  const typeMap = {
    '待处理': 'warning',
    '处理中': 'primary',
    '已完成': 'success',
    '已取消': 'info'
  }
  return typeMap[status] || ''
}
</script>

<style scoped lang="scss">
.demo-page {
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  
  .page-header {
    margin-bottom: 20px;
    
    .page-title {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 8px;
    }
    
    .page-desc {
      font-size: 14px;
      color: #606266;
    }
  }
  
  .page-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .table-card {
    width: 100%;
    
    :deep(.el-card__body) {
      padding: 0;
      height: calc(100vh - 280px);
    }
  }
  
  .info-card {
    .info-title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 16px;
    }
  }
  
  .high-amount {
    color: #f56c6c;
    font-weight: 600;
  }
}
</style>
