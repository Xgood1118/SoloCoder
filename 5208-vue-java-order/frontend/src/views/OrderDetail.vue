<template>
  <div class="order-detail" v-loading="loading">
    <div class="detail-header">
      <el-button @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回列表
      </el-button>
      <h2 class="order-title">
        订单详情
        <el-tag :type="getStatusTagType(order?.status)" size="large" effect="dark" style="margin-left: 12px;">
          {{ order?.status }}
        </el-tag>
      </h2>
      <div class="header-actions">
        <el-button type="primary" @click="exportPDF">
          <el-icon><Printer /></el-icon> 导出PDF
        </el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card class="info-card">
          <template #header>
            <div class="card-header">
              <el-icon><InfoFilled /></el-icon>
              <span>订单信息</span>
            </div>
          </template>

          <div class="info-section">
            <div class="info-row">
              <span class="label">订单号：</span>
              <span class="value">{{ order?.orderNo }}</span>
            </div>
            <div class="info-row">
              <span class="label">用户ID：</span>
              <span class="value">{{ order?.userId }}</span>
            </div>
            <div class="info-row">
              <span class="label">下单时间：</span>
              <span class="value">{{ formatDateTime(order?.createdAt) }}</span>
            </div>
            <div class="info-row">
              <span class="label">订单备注：</span>
              <span class="value">{{ order?.remark || '-' }}</span>
            </div>
            <div class="info-row" v-if="order?.createReason">
              <span class="label">下单原因：</span>
              <span class="value">{{ order.createReason }}</span>
            </div>
          </div>
        </el-card>

        <el-card class="timeline-card">
          <template #header>
            <div class="card-header">
              <el-icon><Clock /></el-icon>
              <span>订单状态</span>
              <div v-if="order?.status === '待支付'" class="countdown">
                <el-icon color="#f56c6c"><WarningFilled /></el-icon>
                <span class="countdown-text">支付剩余：{{ payCountdown }}</span>
              </div>
            </div>
          </template>

          <el-timeline>
            <el-timeline-item
              v-for="item in statusTimeline"
              :key="item.status"
              :timestamp="item.time"
              :type="item.type"
              placement="top"
            >
              <h4>{{ item.status }}</h4>
              <p style="color: #909399; font-size: 12px;">{{ item.time }}</p>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-card class="products-card">
          <template #header>
            <div class="card-header">
              <el-icon><Goods /></el-icon>
              <span>商品信息</span>
            </div>
          </template>

          <el-table :data="order?.items || []" border>
            <el-table-column prop="productTitle" label="商品名称">
              <template #default="{ row }">
                <div class="product-name">{{ row.productTitle || row.skuName }}</div>
                <div class="product-sku">SKU: {{ row.skuId }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="unitPrice" label="单价" width="120" align="right">
              <template #default="{ row }">¥{{ fenToYuan(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="80" align="center">
              <template #default="{ row }">x{{ row.quantity }}</template>
            </el-table-column>
            <el-table-column prop="subtotal" label="小计" width="120" align="right">
              <template #default="{ row }">
                <span class="subtotal">¥{{ fenToYuan(row.subtotal) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card class="logistics-card" v-if="order?.logistics?.trackingNumber">
          <template #header>
            <div class="card-header">
              <el-icon><Van /></el-icon>
              <span>物流信息</span>
              <el-button type="primary" link size="small" @click="addLogisticsVisible = true">
                添加物流轨迹
              </el-button>
            </div>
          </template>

          <div class="logistics-info">
            <div class="logistics-row">
              <span class="label">物流公司：</span>
              <span class="value">{{ order.logistics.company }}</span>
            </div>
            <div class="logistics-row">
              <span class="label">运单号：</span>
              <span class="value">{{ order.logistics.trackingNumber }}</span>
            </div>
            <div class="logistics-row">
              <span class="label">当前状态：</span>
              <span class="value">{{ order.logistics.currentStatus }}</span>
            </div>
          </div>

          <el-divider />

          <el-timeline>
            <el-timeline-item
              v-for="(record, index) in reversedTrackingRecords"
              :key="index"
              :timestamp="formatDateTime(record.time)"
              :type="index === 0 ? 'primary' : ''"
              placement="top"
            >
              <h4>{{ record.description }}</h4>
              <p style="color: #909399; font-size: 12px;" v-if="record.location">{{ record.location }}</p>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="amount-card">
          <template #header>
            <div class="card-header">
              <el-icon><Money /></el-icon>
              <span>金额信息</span>
            </div>
          </template>

          <div class="amount-list">
            <div class="amount-item">
              <span class="label">商品总额</span>
              <span class="value">¥{{ fenToYuan(order?.totalAmount || 0) }}</span>
            </div>
            <div class="amount-item">
              <span class="label">运费</span>
              <span class="value">¥{{ fenToYuan(order?.shippingFee || 0) }}</span>
            </div>
            <div class="amount-item discount">
              <span class="label">优惠金额</span>
              <span class="value">-¥{{ fenToYuan(order?.discountAmount || 0) }}</span>
            </div>
            <el-divider style="margin: 10px 0;" />
            <div class="amount-item total">
              <span class="label">实付金额</span>
              <span class="value">¥{{ fenToYuan(order?.paidAmount || 0) }}</span>
            </div>
          </div>
        </el-card>

        <el-card class="address-card">
          <template #header>
            <div class="card-header">
              <el-icon><Location /></el-icon>
              <span>收货地址</span>
            </div>
          </template>

          <div class="address-info" v-if="order?.address">
            <div class="address-row">
              <span class="label">收货人：</span>
              <span class="value">{{ order.address.name }}</span>
            </div>
            <div class="address-row">
              <span class="label">联系电话：</span>
              <span class="value">{{ order.address.phone }}</span>
            </div>
            <div class="address-row">
              <span class="label">详细地址：</span>
              <span class="value">{{ formatFullAddress(order.address) }}</span>
            </div>
          </div>
        </el-card>

        <el-card class="action-card">
          <template #header>
            <div class="card-header">
              <el-icon><Operation /></el-icon>
              <span>订单操作</span>
            </div>
          </template>

          <div class="action-buttons">
            <el-button
              v-if="order?.status === '待支付'"
              type="success"
              @click="handlePay"
            >
              <el-icon><Wallet /></el-icon> 模拟支付
            </el-button>
            <el-button
              v-if="order?.status === '已支付'"
              type="warning"
              @click="shipDialogVisible = true"
            >
              <el-icon><Van /></el-icon> 发货
            </el-button>
            <el-button
              v-if="order?.status === '已发货'"
              type="success"
              @click="handleConfirm"
            >
              <el-icon><Checked /></el-icon> 确认收货
            </el-button>
            <el-button
              v-if="order?.status === '待支付'"
              type="danger"
              @click="handleCancel"
            >
              <el-icon><Close /></el-icon> 取消订单
            </el-button>
            <el-button
              v-if="canRefund"
              type="danger"
              @click="refundDialogVisible = true"
            >
              <el-icon><Refund /></el-icon> 申请退款
            </el-button>
          </div>
        </el-card>

        <el-card class="refund-card" v-if="order?.refundApplications?.length > 0">
          <template #header>
            <div class="card-header">
              <el-icon><Document /></el-icon>
              <span>退款记录</span>
            </div>
          </template>

          <div
            v-for="refund in order.refundApplications"
            :key="refund.id"
            class="refund-item"
          >
            <div class="refund-header">
              <el-tag :type="getRefundStatusType(refund.status)">
                {{ refund.status }}
              </el-tag>
              <span class="refund-amount">¥{{ fenToYuan(refund.refundAmount) }}</span>
            </div>
            <div class="refund-info">
              <p><span class="label">类型：</span>{{ refund.type?.description || refund.type }}</p>
              <p><span class="label">原因：</span>{{ refund.reason }}</p>
              <p v-if="refund.rejectReason"><span class="label">驳回原因：</span>{{ refund.rejectReason }}</p>
              <p><span class="label">申请时间：</span>{{ formatDateTime(refund.appliedAt) }}</p>
              <div v-if="refund.status === '待审核'" class="refund-actions">
                <el-button size="small" type="success" @click="handleAuditRefund(refund.id, true)">
                  通过
                </el-button>
                <el-button size="small" type="danger" @click="showRejectDialog(refund.id)">
                  驳回
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="logs-card">
      <template #header>
        <div class="card-header">
          <el-icon><List /></el-icon>
          <span>操作日志</span>
        </div>
      </template>

      <el-table :data="orderLogs" border>
        <el-table-column prop="operatorName" label="操作人" width="120" />
        <el-table-column prop="action" label="操作" width="150">
          <template #default="{ row }">{{ row.action?.description || row.action }}</template>
        </el-table-column>
        <el-table-column label="状态变更" width="200">
          <template #default="{ row }">
            <span v-if="row.fromStatus">{{ row.fromStatus?.description || row.fromStatus }}</span>
            <span v-if="row.fromStatus && row.toStatus"> → </span>
            <span v-if="row.toStatus" style="color: #409EFF;">{{ row.toStatus?.description || row.toStatus }}</span>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200">
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column prop="timestamp" label="时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.timestamp) }}</template>
        </el-table-column>
      </el-table>
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
          <el-input v-model="shipForm.remark" type="textarea" :rows="2" />
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

    <el-dialog v-model="rejectDialogVisible" title="驳回退款" width="400px">
      <el-form label-width="80px">
        <el-form-item label="驳回原因">
          <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="请输入驳回原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="submitReject">确认驳回</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addLogisticsVisible" title="添加物流轨迹" width="500px">
      <el-form :model="logisticsForm" label-width="80px">
        <el-form-item label="描述" required>
          <el-input v-model="logisticsForm.description" type="textarea" :rows="2" placeholder="请输入物流轨迹描述" />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="logisticsForm.location" placeholder="请输入地点" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addLogisticsVisible = false">取消</el-button>
        <el-button type="primary" @click="submitLogistics">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getOrderDetail,
  getOrderLogs,
  payOrder,
  shipOrder,
  confirmOrder,
  cancelOrder,
  applyRefund,
  auditRefund as apiAuditRefund,
  addLogistics
} from '../api/order'
import {
  fenToYuan,
  formatDateTime,
  getStatusTagType,
  formatFullAddress
} from '../utils/order'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

pdfMake.vfs = pdfFonts.pdfMake.vfs

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const order = ref(null)
const orderLogs = ref([])
const payCountdown = ref('')

let countdownTimer = null

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

const rejectDialogVisible = ref(false)
const rejectReason = ref('')
const currentRefundId = ref('')

const addLogisticsVisible = ref(false)
const logisticsForm = reactive({
  description: '',
  location: ''
})

const canRefund = computed(() => {
  if (!order.value) return false
  const status = order.value.status
  return status !== '已退款' && status !== '已取消'
})

const reversedTrackingRecords = computed(() => {
  if (!order.value?.logistics?.trackingRecords) return []
  return [...order.value.logistics.trackingRecords].reverse()
})

const statusTimeline = computed(() => {
  if (!order.value || !order.value.statusTimestamps) return []
  
  const statusOrder = ['待支付', '已支付', '已发货', '已收货', '已退款', '已取消']
  const typeMap = {
    '待支付': 'warning',
    '已支付': 'primary',
    '已发货': 'info',
    '已收货': 'success',
    '已退款': 'danger',
    '已取消': 'info'
  }
  
  return statusOrder
    .filter(status => order.value.statusTimestamps[status])
    .map(status => ({
      status,
      time: formatDateTime(order.value.statusTimestamps[status]),
      type: typeMap[status] || ''
    }))
})

function getRefundStatusType(status) {
  const map = {
    '待审核': 'warning',
    '已通过': 'success',
    '已驳回': 'danger'
  }
  return map[status] || 'info'
}

const fetchDetail = async () => {
  loading.value = true
  try {
    const id = route.params.id
    order.value = await getOrderDetail(id)
    orderLogs.value = await getOrderLogs(id)
    if (order.value.status === '待支付') {
      startCountdown()
    }
  } finally {
    loading.value = false
  }
}

const startCountdown = () => {
  if (!order.value?.expireAt) return
  
  const updateCountdown = () => {
    const now = new Date().getTime()
    const expire = new Date(order.value.expireAt).getTime()
    const diff = expire - now
    
    if (diff <= 0) {
      payCountdown.value = '已超时'
      clearInterval(countdownTimer)
      return
    }
    
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    payCountdown.value = `${minutes}分${seconds}秒`
  }
  
  updateCountdown()
  countdownTimer = setInterval(updateCountdown, 1000)
}

const goBack = () => {
  router.push('/orders')
}

const handlePay = async () => {
  try {
    await ElMessageBox.confirm('确定要模拟支付吗？', '确认支付', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await payOrder(order.value.id)
    ElMessage.success('支付成功')
    fetchDetail()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const submitShip = async () => {
  if (!shipForm.trackingNumber || !shipForm.company) {
    ElMessage.warning('请填写运单号和物流公司')
    return
  }
  try {
    await shipOrder(order.value.id, {
      ...shipForm,
      operatorId: 'admin',
      operatorName: '管理员'
    })
    ElMessage.success('发货成功')
    shipDialogVisible.value = false
    fetchDetail()
  } catch (e) {
    console.error(e)
  }
}

const handleConfirm = async () => {
  try {
    await ElMessageBox.confirm('确定要确认收货吗？', '确认收货', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await confirmOrder(order.value.id, { operatorId: 'admin', operatorName: '管理员' })
    ElMessage.success('确认收货成功')
    fetchDetail()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const handleCancel = async () => {
  try {
    await ElMessageBox.confirm('确定要取消订单吗？', '取消订单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await cancelOrder(order.value.id, { operatorId: 'admin', operatorName: '管理员' })
    ElMessage.success('订单已取消')
    fetchDetail()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
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
    await applyRefund(order.value.id, {
      reason: refundForm.reason,
      refundAmount: refundForm.refundType === 'partial' ? refundForm.refundAmount : undefined,
      isReturn: refundForm.isReturn,
      isPartial: refundForm.refundType === 'partial',
      applicantId: 'admin',
      applicantName: '管理员'
    })
    ElMessage.success('退款申请已提交')
    refundDialogVisible.value = false
    fetchDetail()
  } catch (e) {
    console.error(e)
  }
}

const handleAuditRefund = async (refundId, approved) => {
  try {
    await apiAuditRefund(refundId, {
      approved,
      rejectReason: approved ? undefined : rejectReason.value,
      auditorId: 'admin',
      auditorName: '管理员'
    })
    ElMessage.success(approved ? '退款审核通过' : '已驳回退款申请')
    fetchDetail()
  } catch (e) {
    console.error(e)
  }
}

const showRejectDialog = (refundId) => {
  currentRefundId.value = refundId
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

const submitReject = () => {
  if (!rejectReason.value) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  rejectDialogVisible.value = false
  handleAuditRefund(currentRefundId.value, false)
}

const submitLogistics = async () => {
  if (!logisticsForm.description) {
    ElMessage.warning('请填写物流轨迹描述')
    return
  }
  try {
    await addLogistics(order.value.id, {
      ...logisticsForm,
      operatorId: 'admin',
      operatorName: '管理员'
    })
    ElMessage.success('物流轨迹添加成功')
    addLogisticsVisible.value = false
    fetchDetail()
  } catch (e) {
    console.error(e)
  }
}

const exportPDF = () => {
  if (!order.value) return
  
  const orderData = order.value
  
  const items = orderData.items.map(item => [
    item.productTitle || item.skuName,
    item.skuId,
    `¥${fenToYuan(item.unitPrice)}`,
    `x${item.quantity}`,
    `¥${fenToYuan(item.subtotal)}`
  ])

  const docDefinition = {
    content: [
      { text: '订单详情', style: 'header' },
      { text: `订单号: ${orderData.orderNo}`, margin: [0, 10] },
      { text: `用户ID: ${orderData.userId}` },
      { text: `订单状态: ${orderData.status}` },
      { text: `下单时间: ${formatDateTime(orderData.createdAt)}`, margin: [0, 0, 0, 10] },
      
      { text: '商品列表', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['商品名称', 'SKU', '单价', '数量', '小计'],
            ...items
          ]
        }
      },
      
      { text: '金额信息', style: 'subheader', margin: [0, 20, 0, 5] },
      { text: `商品总额: ¥${fenToYuan(orderData.totalAmount)}` },
      { text: `运费: ¥${fenToYuan(orderData.shippingFee)}` },
      { text: `优惠金额: -¥${fenToYuan(orderData.discountAmount)}` },
      { text: `实付金额: ¥${fenToYuan(orderData.paidAmount)}`, bold: true, fontSize: 14 },
      
      { text: '收货地址', style: 'subheader', margin: [0, 20, 0, 5] },
      { text: `收货人: ${orderData.address?.name || ''}` },
      { text: `联系电话: ${orderData.address?.phone || ''}` },
      { text: `详细地址: ${formatFullAddress(orderData.address)}` }
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },
      subheader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5]
      }
    }
  }

  pdfMake.createPdf(docDefinition).download(`order_${orderData.orderNo}.pdf`)
}

onMounted(() => {
  fetchDetail()
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
</script>

<style scoped>
.order-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.order-title {
  flex: 1;
  font-size: 20px;
  margin: 0;
  display: flex;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.info-card,
.timeline-card,
.products-card,
.logistics-card,
.amount-card,
.address-card,
.action-card,
.refund-card,
.logs-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.card-header .el-icon {
  color: #409EFF;
}

.info-section {
  display: flex;
  flex-wrap: wrap;
}

.info-row {
  width: 50%;
  padding: 8px 0;
  display: flex;
}

.info-row .label {
  color: #909399;
  min-width: 80px;
}

.info-row .value {
  color: #303133;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.countdown-text {
  color: #f56c6c;
  font-weight: 600;
  font-size: 14px;
}

.product-name {
  font-weight: 500;
  color: #303133;
}

.product-sku {
  color: #909399;
  font-size: 12px;
}

.subtotal {
  color: #f56c6c;
  font-weight: 600;
}

.amount-list {
  padding: 10px 0;
}

.amount-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.amount-item .label {
  color: #606266;
}

.amount-item .value {
  color: #303133;
}

.amount-item.discount .value {
  color: #67c23a;
}

.amount-item.total {
  font-size: 16px;
  font-weight: 600;
}

.amount-item.total .value {
  color: #f56c6c;
}

.address-info .address-row {
  padding: 6px 0;
  display: flex;
}

.address-row .label {
  color: #909399;
  min-width: 80px;
}

.address-row .value {
  color: #303133;
  flex: 1;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-buttons .el-button {
  width: 100%;
}

.refund-item {
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-bottom: 10px;
}

.refund-item:last-child {
  margin-bottom: 0;
}

.refund-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.refund-amount {
  color: #f56c6c;
  font-weight: 600;
}

.refund-info p {
  margin: 4px 0;
  font-size: 13px;
  color: #606266;
}

.refund-info .label {
  color: #909399;
}

.refund-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.logistics-info .logistics-row {
  padding: 6px 0;
  display: flex;
}

.logistics-row .label {
  color: #909399;
  min-width: 80px;
}

.logistics-row .value {
  color: #303133;
}
</style>
