<template>
  <div class="home">
    <h2 class="page-title">工作台</h2>
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-icon pending">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.pending }}</div>
              <div class="stat-label">待我审批</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-icon processing">
              <el-icon><Loading /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.processing }}</div>
              <div class="stat-label">审批中</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-icon completed">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.completed }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-item">
            <div class="stat-icon rejected">
              <el-icon><CircleClose /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.rejected }}</div>
              <div class="stat-label">已驳回</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最新申请</span>
              <el-button type="primary" link @click="$router.push('/applications')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentApplications" style="width: 100%">
            <el-table-column prop="application_no" label="申请编号" width="150" />
            <el-table-column prop="title" label="标题" show-overflow-tooltip />
            <el-table-column prop="total_amount" label="金额" width="120">
              <template #default="{ row }">
                ¥{{ row.total_amount.toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>待办任务</span>
              <el-button type="primary" link @click="$router.push('/tasks')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="pendingTasks" style="width: 100%">
            <el-table-column prop="application.application_no" label="申请编号" width="150" />
            <el-table-column prop="application.title" label="标题" show-overflow-tooltip />
            <el-table-column prop="node_name" label="当前节点" width="120" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="primary" link @click="goToTask(row)">处理</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getMyApplications, getMyTasks } from '@/api/application'

const router = useRouter()
const stats = ref({
  pending: 0,
  processing: 0,
  completed: 0,
  rejected: 0
})
const recentApplications = ref([])
const pendingTasks = ref([])

async function loadData() {
  try {
    const [appsRes, tasksRes] = await Promise.all([
      getMyApplications({ page: 1, page_size: 10 }),
      getMyTasks({ page: 1, page_size: 10, status: 'pending' })
    ])

    recentApplications.value = appsRes.items || []
    pendingTasks.value = tasksRes.items || []

    stats.value.pending = tasksRes.total || 0
    stats.value.processing = recentApplications.value.filter(a => a.status === 'pending').length
    stats.value.completed = recentApplications.value.filter(a => a.status === 'completed').length
    stats.value.rejected = recentApplications.value.filter(a => a.status === 'rejected').length
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

function goToTask(row) {
  router.push(`/applications/${row.application_id}`)
}

onMounted(loadData)
</script>

<style scoped>
.page-title {
  margin-bottom: 20px;
  font-size: 20px;
  font-weight: bold;
  color: #303133;
}

.stat-card {
  cursor: pointer;
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
}

.stat-icon.pending {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
}

.stat-icon.processing {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.completed {
  background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
}

.stat-icon.rejected {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
