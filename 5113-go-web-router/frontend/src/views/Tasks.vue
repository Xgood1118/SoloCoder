<template>
  <div class="tasks">
    <h2 class="page-title">待审批任务</h2>
    <el-card>
      <el-table :data="tasks" style="width: 100%" v-loading="loading">
        <el-table-column prop="application.application_no" label="申请编号" width="160" />
        <el-table-column prop="application.title" label="申请标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="申请金额" width="120">
          <template #default="{ row }">
            <span class="amount">¥{{ row.application?.total_amount?.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="application.applicant.real_name" label="申请人" width="120" />
        <el-table-column prop="node_name" label="当前节点" width="140" />
        <el-table-column prop="created_at" label="到达时间" width="180" />
        <el-table-column label="是否会签" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_signatory" type="warning" size="small">会签</el-tag>
            <el-tag v-else size="small">单人</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">审批</el-button>
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
import { getMyTasks } from '@/api/application'

const router = useRouter()
const loading = ref(false)
const tasks = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

async function loadData() {
  loading.value = true
  try {
    const res = await getMyTasks({
      page: page.value,
      page_size: pageSize.value,
      status: 'pending'
    })
    tasks.value = res.items || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

function viewDetail(row) {
  router.push(`/applications/${row.application_id}`)
}

onMounted(loadData)
</script>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 20px;
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
