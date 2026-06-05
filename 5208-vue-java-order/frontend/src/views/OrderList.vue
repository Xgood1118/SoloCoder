<template>
  <div class="order-list">
    <el-card class="filter-card">
      <el-form :model="queryForm" label-width="80px" @submit.prevent>
        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="订单状态">
              <el-select v-model="queryForm.status" placeholder="请选择状态" clearable>
                <el-option
                  v-for="item in OrderStatusList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="用户ID">
              <el-input v-model="queryForm.userId" placeholder="请输入用户ID" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="商品搜索">
              <el-input v-model="queryForm.productKeyword" placeholder="搜索商品名称/SKU" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="下单时间">
              <el-date-picker
                v-model="dateRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="金额范围">
              <div style="display: flex; gap: 8px;">
                <el-input v-model="queryForm.minAmount" placeholder="最小金额" style="flex: 1;" />
                <span style="line-height: 32px;">-</span>
                <el-input v-model="queryForm.maxAmount" placeholder="最大金额" style="flex: 1;" />
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="排序方式">
              <el-select v-model="queryForm.sortBy" placeholder="排序字段" clearable style="width: 48%;">
                <el-option label="下单时间" value="time" />
                <el-option label="订单金额" value="amount" />
              </el-select>
              <el-select v-model="queryForm.sortOrder" placeholder="排序方式" style="width: 48%; margin-left: 4%;">
                <el-option label="降序" value="desc" />
                <el-option label="升序" value="asc" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" style="text-align: right;">
            <el-button type="primary" @click="handleSearch">
              <el-icon><Search /></el-icon> 搜索
            </el-button>
            <el-button @click="handleReset">
              <el-icon><Refresh /></el-icon> 重置
            </el-button>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon> 代客下单
          </el-button>
          <el-button type="success" :disabled="selectedIds.length === 0" @click="handleBatchShip">
            <el-icon><Van /></el-icon> 批量发货
          </el-button>
          <el-button type="warning" :disabled="selectedIds.length === 0" @click="handleBatchConfirm">
            <el-icon><Checked /></el-icon> 批量确认收货
          </el-button>
          <el-button type="info" @click="handleExport">
            <el-icon><Download /></el-icon> 导出CSV
          </el-button>
        </div>
        <div class="toolbar-right">
          <span style="color: #909399;">共 {{ total }} 条记录</span>
        </div>
      </div>

      <el-table
        ref="tableRef"
        :data="tableData"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        border
        stripe
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="orderNo" label="订单号" width="220">
          <template #default="{ row }">
            <el-link type="primary" @click="goDetail(row.id)">{{ row.orderNo }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="userId" label="用户ID" width="120" />
        <el-table-column label="商品信息" min-width="200">
          <template #default="{ row }">
            <div v-for="item in row.items" :key="item.skuId" class="product-item">
              <span class="product-title">{{ item.productTitle || item.skuName }}</span>
              <span class="product-qty">x{{ item.quantity }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="订单金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount">¥{{ fenToYuan(row.totalAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paidAmount" label="实付金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount paid">¥{{ fenToYuan(row.paidAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" effect="dark">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="下单时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goDetail(row.id)">
              详情
            </el-button>
            <el-button
              v-if="row.status === '待支付'"
              type="success"
              link
              size="small"
              @click="handlePay(row)"
            >
              支付
            </el-button>
            <el-button
              v-if="row.status === '已支付'"
              type="warning"
              link
              size="small"
              @click="handleShip(row)"
            >
              发货
            </el-button>
            <el-button
              v-if="row.status === '已发货'"
              type="success"
              link
              size="small"
              @click="handleConfirm(row)"
            >
              确认收货
            </el-button>
            <el-button
              v-if="row.status !== '已退款' && row.status !== '已取消' && row.status !== '已收货'"
              type="danger"
              link
              size="small"
              @click="handleRefund(row)"
            >
              退款
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="queryForm.page"
          v-model:page-size="queryForm.size"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <el-dialog v-model="shipDialogVisible" title="订单发货" width="500px">
      <el-form :model="shipForm" label-width="80px">
        <el-form-item label="运单号" required>
          <el-input v-model="shipForm.trackingNumber" placeholder="请输入运单号" />
        </el-form-item>
        <el-form-item label="物流公司" required>
          <el-input v-model="shipForm.company" placeholder="请输入物流公司" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="shipForm.remark" type="textarea" :rows="3" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitShip">确认发货</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="refundDialogVisible" title="申请退款" width="500px">
      <el-form :model="refundForm" label-width="100px">
        <el-form-item label="退款类型">
          <el-radio-group v-model="refundForm.refundType">
            <el-radio label="full">全额退款</el-radio>
            <el-radio label="partial">部分退款</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="refundForm.refundType === 'partial'" label="退款金额">
          <el-input v-model="refundForm.refundAmount" placeholder="请输入退款金额(元)">
            <template #append>元</template>
          </el-input>
        </el-form-item>
        <el-form-item label="退款原因" required>
          <el-input v-model="refundForm.reason" type="textarea" :rows="3" placeholder="请输入退款原因" />
        </el-form-item>
        <el-form-item label="退货退款">
          <el-switch v-model="refundForm.isReturn" />
          <span style="color: #909399; margin-left: 8px;">已发货订单需退货</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRefund">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getOrderList,
  payOrder,
  shipOrder,
  confirmOrder,
  applyRefund,
  batchShip,
  batchConfirm,
  exportOrders
} from '../api/order'
import {
  OrderStatusList,
  fenToYuan,
  formatDateTime,
  getStatusTagType
} from '../utils/order'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const selectedIds = ref([])

const dateRange = ref([])

const queryForm = reactive({
  status: '',
  userId: '',
  productKeyword: '',
  minAmount: '',
  maxAmount: '',
  sortBy: 'time',
  sortOrder: 'desc',
  page: 1,
  size: 10
})

const currentOrder = ref(null)
const shipDialogVisible = ref(false)
const shipForm = reactive({
  trackingNumber: '',
  company: '',
  remark: ''
})

const refundDialogVisible = ref(false)
const refundForm = reactive({
  refundType: 'full',
  refundAmount: '',
  reason: '',
  isReturn: false
})

const fetchList = async () => {
  loading.value = true
  try {
    const params = {
      ...queryForm
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startTime = dateRange.value[0]
      params.endTime = dateRange.value[1]
    }
    const res = await getOrderList(params)
    tableData.value = res.content
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  queryForm.page = 1
  fetchList()
}

const handleReset = () => {
  queryForm.status = ''
  queryForm.userId = ''
  queryForm.productKeyword = ''
  queryForm.minAmount = ''
  queryForm.maxAmount = ''
  queryForm.sortBy = 'time'
  queryForm.sortOrder = 'desc'
  queryForm.page = 1
  dateRange.value = []
  fetchList()
}

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

const goDetail = (id) => {
  router.push(`/orders/${id}`)
}

const handleCreate = () => {
  router.push('/orders/create')
}

const handlePay = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要对订单 ${row.orderNo} 进行支付操作吗？`, '确认支付', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await payOrder(row.id)
    ElMessage.success('支付成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

const handleShip = (row) => {
  currentOrder.value = row
  shipForm.trackingNumber = ''
  shipForm.company = ''
  shipForm.remark = ''
  shipDialogVisible.value = true
}

const handleConfirm = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要确认订单 ${row.orderNo} 收货吗？`, '确认收货', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await confirmOrder(row.id, { operatorId: 'admin', operatorName: '管理员' })
    ElMessage.success('确认收货成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

const handleRefund = (row) => {
  currentOrder.value = row
  refundForm.refundType = 'full'
  refundForm.refundAmount = fenToYuan(row.paidAmount)
  refundForm.reason = ''
  refundForm.isReturn = row.status === '已发货'
  refundDialogVisible.value = true
}

const submitRefund = async () => {
  if (!refundForm.reason) {
    ElMessage.warning('请填写退款原因')
    return
  }
  if (refundForm.refundType === 'partial' && !refundForm.refundAmount) {
    ElMessage.warning('请填写退款金额')
    return
  }
  try {
    await applyRefund(currentOrder.value.id, {
      reason: refundForm.reason,
      refundAmount: refundForm.refundType === 'partial' ? refundForm.refundAmount : undefined,
      isReturn: refundForm.isReturn,
      isPartial: refundForm.refundType === 'partial',
      applicantId: 'admin',
      applicantName: '管理员'
    })
    ElMessage.success('退款申请已提交')
    refundDialogVisible.value = false
    fetchList()
  } catch (e) {
    console.error(e)
  }
}

const handleBatchShip = () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择要发货的订单')
    return
  }
  currentOrder.value = null
  shipForm.trackingNumber = ''
  shipForm.company = ''
  shipForm.remark = ''
  shipDialogVisible.value = true
}

const submitShip = async () => {
  if (!shipForm.trackingNumber || !shipForm.company) {
    ElMessage.warning('请填写运单号和物流公司')
    return
  }
  try {
    if (currentOrder.value) {
      await shipOrder(currentOrder.value.id, {
        ...shipForm,
        operatorId: 'admin',
        operatorName: '管理员'
      })
      ElMessage.success('发货成功')
    } else {
      const res = await batchShip({
        orderIds: selectedIds.value,
        trackingNumber: shipForm.trackingNumber,
        company: shipForm.company,
        operatorId: 'admin',
        operatorName: '管理员'
      })
      if (res.failedIds && res.failedIds.length > 0) {
        ElMessage.warning(`成功${res.successIds.length}个，失败${res.failedIds.length}个`)
      } else {
        ElMessage.success(`批量发货成功，共${res.successIds.length}个订单`)
      }
    }
    shipDialogVisible.value = false
    fetchList()
  } catch (e) {
    console.error(e)
  }
}

const handleBatchConfirm = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择要确认收货的订单')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要对选中的 ${selectedIds.value.length} 个订单执行确认收货操作吗？`, '批量确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const res = await batchConfirm({
      orderIds: selectedIds.value,
      operatorId: 'admin',
      operatorName: '管理员'
    })
    if (res.failedIds && res.failedIds.length > 0) {
      ElMessage.warning(`成功${res.successIds.length}个，失败${res.failedIds.length}个`)
    } else {
      ElMessage.success(`批量确认成功，共${res.successIds.length}个订单`)
    }
    fetchList()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

const handleExport = async () => {
  try {
    const params = {
      status: queryForm.status || undefined,
      userId: queryForm.userId || undefined,
      productKeyword: queryForm.productKeyword || undefined,
      minAmount: queryForm.minAmount || undefined,
      maxAmount: queryForm.maxAmount || undefined
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startTime = dateRange.value[0]
      params.endTime = dateRange.value[1]
    }
    const blob = await exportOrders(params)
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `orders_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('导出成功')
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.order-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card :deep(.el-card__body) {
  padding-bottom: 0;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.product-item {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.product-title {
  color: #303133;
  font-size: 13px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-qty {
  color: #909399;
  font-size: 12px;
}

.amount {
  font-size: 14px;
  font-weight: 500;
}

.amount.paid {
  color: #f56c6c;
  font-weight: 600;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
