<template>
  <div class="applications">
    <div class="page-header">
      <h2 class="page-title">我的申请</h2>
      <el-button type="primary" @click="$router.push('/applications/new')">
        <el-icon><Plus /></el-icon>
        新建申请
      </el-button>
    </div>
    <el-card>
      <el-table :data="applications" style="width: 100%" v-loading="loading">
        <el-table-column prop="application_no" label="申请编号" width="160" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="total_amount" label="金额" width="120">
          <template #default="{ row }">
            <span class="amount">¥{{ row.total_amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="current_node_code" label="当前节点" width="140">
          <template #default="{ row }">
            {{ getNodeText(row.current_node_code) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
        class="pagination"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getMyApplications } from '@/api/application'

const router = useRouter()
const loading = ref(false)
const applications = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

async function loadData() {
  loading.value = true
  try {
    const res = await getMyApplications({
      page: page.value,
      page_size: pageSize.value
    })
    applications.value = res.items || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

function viewDetail(row) {
  router.push(`/applications/${row.id}`)
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

onMounted(loadData)
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: bold;
  color: #303133;
  margin: 0;
}

.amount {
  color: #409eff;
  font-weight: bold;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
