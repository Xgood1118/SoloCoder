<template>
  <div class="application-detail">
    <div class="page-header">
      <el-button @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2 class="page-title">申请详情</h2>
      <div class="header-actions">
        <el-button type="primary" @click="showRollbackDialog = true" v-if="application?.status === 'pending'">
          <el-icon><RefreshLeft /></el-icon>
          回退申请
        </el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="detail-card">
          <template #header>
          <div class="card-title">基本信息</div>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请编号">{{ application?.application_no }}</el-descriptions-item>
          <el-descriptions-item label="申请标题">{{ application?.title }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ application?.applicant?.real_name }}</el-descriptions-item>
          <el-descriptions-item label="申请金额">
            <span class="amount">¥{{ application?.total_amount?.toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="getStatusType(application?.status)">{{ getStatusText(application?.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="当前节点">{{ getNodeText(application?.current_node_code) }}</el-descriptions-item>
          <el-descriptions-item label="申请类型" :span="2">{{ application?.application_type }}</el-descriptions-item>
          <el-descriptions-item label="申请说明" :span="2">{{ application?.description }}</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">{{ application?.created_at }}</el-descriptions-item>
        </el-descriptions>
        </el-card>

        <el-card class="detail-card" style="margin-top: 20px;">
          <template #header>
            <div class="card-title">采购明细</div>
          </template>
          <el-table :data="application?.items || []" border>
            <el-table-column prop="item_name" label="物品名称" />
            <el-table-column prop="specification" label="规格型号" />
            <el-table-column prop="quantity" label="数量" width="100" />
            <el-table-column prop="unit_price" label="单价" width="120">
              <template #default="{ row }">¥{{ row.unit_price.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="total_price" label="小计" width="120">
              <template #default="{ row }">¥{{ (row.quantity * row.unit_price).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card class="detail-card" style="margin-top: 20px;">
          <template #header>
            <div class="card-title">审批历史</div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(history, index) in histories"
              :key="history.id"
              :timestamp="history.created_at"
              :type="getTimelineType(history.action)"
            >
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="action">{{ getActionText(history.action) }}</span>
                  <span class="approver">{{ history.approver_name || '系统' }}</span>
                </div>
                <div class="timeline-node">{{ history.node_name }}</div>
                <div class="timeline-opinion" v-if="history.opinion">{{ history.opinion }}</div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card v-if="myTask" class="action-card">
          <template #header>
            <div class="card-title">审批操作</div>
          </template>
          <el-form label-width="80px">
            <el-form-item label="审批意见">
              <el-input
                v-model="approvalForm.opinion"
                type="textarea"
                :rows="4"
                placeholder="请输入审批意见"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="success" @click="handleApprove('approved')" :loading="loading">
                <el-icon><CircleCheck /></el-icon>
                通过
              </el-button>
              <el-button type="danger" @click="handleApprove('rejected')" :loading="loading">
                <el-icon><CircleClose /></el-icon>
                驳回
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showRollbackDialog" title="回退申请" width="400px">
      <el-form label-width="100px">
        <el-form-item label="回退到">
          <el-select v-model="rollbackForm.target_node_code" placeholder="请选择节点">
            <el-option
              v-for="node in rollbackNodes" :key="node.node_code" :label="node.node_name" :value="node.node_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="回退原因">
          <el-input
            v-model="rollbackForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入回退原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRollbackDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRollback">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getApplicationDetail, getApprovalHistory, getMyTasks, approve, rollback, getRollbackNodes } from '@/api/application'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const application = ref(null)
const histories = ref([])
const myTask = ref(null)
const showRollbackDialog = ref(false)
const rollbackNodes = ref([])
const approvalForm = ref({
  opinion: ''
})
const rollbackForm = ref({
  target_node_code: '',
  reason: ''
})

async function loadData() {
  const id = route.params.id
  const [appRes, historyRes, tasksRes] = await Promise.all([
    getApplicationDetail(id),
    getApprovalHistory(id),
    getMyTasks({ page: 1, page_size: 100, status: 'pending' })
  ])
  
  application.value = appRes
  histories.value = historyRes
  
  const tasks = tasksRes.items || []
  myTask.value = tasks.find(t => t.application_id === parseInt(id))
}

async function loadRollbackNodes() {
  const id = route.params.id
  const res = await getRollbackNodes(id)
  rollbackNodes.value = res
}

async function handleApprove(action) {
  if (!approvalForm.value.opinion) {
    ElMessage.warning('请输入审批意见')
    return
  }

  loading.value = true
  try {
    await approve({
      application_id: application.value.id,
      task_id: myTask.value.id,
      action: action,
      opinion: approvalForm.value.opinion
    })
    ElMessage.success('操作成功')
    router.push('/tasks')
  } finally {
    loading.value = false
  }
}

async function handleRollback() {
  if (!rollbackForm.value.target_node_code || !rollbackForm.value.reason) {
    ElMessage.warning('请填写完整信息')
    return
  }

  try {
    await rollback({
      application_id: application.value.id,
      target_node_code: rollbackForm.value.target_node_code,
      reason: rollbackForm.value.reason
    })
    ElMessage.success('回退成功')
    showRollbackDialog.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

function getStatusType(status) {
  const map = {
    pending: 'warning',
    completed: 'success',
    rejected: 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status) {
  const map = {
    pending: '审批中',
    completed: '已完成',
    rejected: '已驳回'
  }
  return map[status] || status
}

function getNodeText(nodeCode) {
  const map = {
    'preliminary_review': '待初审',
    'dept_manager_approval': '部门经理审批',
    'finance_manager_approval': '财务经理审批',
    'finance_review': '财务审核',
    'completed': '已完成',
    'rejected': '已驳回'
  }
  return map[nodeCode] || nodeCode
}

function getActionText(action) {
  const map = {
    submit: '提交申请',
    approve: '通过',
    reject: '驳回',
    transfer: '流转',
    complete: '完成',
    rollback: '回退',
    auto_approve: '超时自动通过'
  }
  return map[action] || action
}

function getTimelineType(action) {
  const map = {
    submit: 'primary',
    approve: 'success',
    reject: 'danger',
    transfer: 'info',
    complete: 'success',
    rollback: 'warning',
    auto_approve: 'success'
  }
  return map[action] || 'info'
}

onMounted(() => {
  loadData()
  loadRollbackNodes()
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: bold;
  color: #303133;
  margin: 0;
  flex: 1;
}

.header-actions {
  margin-left: auto;
}

.detail-card {
  margin-bottom: 20px;
}

.card-title {
  font-weight: bold;
  font-size: 16px;
}

.amount {
  color: #f56c6c;
  font-weight: bold;
  font-size: 16px;
}

.timeline-content {
  padding: 10px 0;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.timeline-header .action {
  font-weight: bold;
  color: #303133;
}

.timeline-header .approver {
  color: #909399;
  font-size: 14px;
}

.timeline-node {
  color: #606266;
  margin: 5px 0;
}

.timeline-opinion {
  color: #909399;
  font-size: 14px;
  background: #f5f7fa;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 5px;
}

.action-card {
  position: sticky;
  top: 20px;
}
</style>
