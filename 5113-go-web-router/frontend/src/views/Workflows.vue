<template>
  <div class="workflows">
    <div class="page-header">
      <h2 class="page-title">流程管理</h2>
    </div>
    <el-card>
      <el-table :data="workflows" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="流程名称" min-width="150" />
        <el-table-column prop="code" label="流程编码" width="150" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">查看</el-button>
            <el-button type="primary" link size="small" @click="editWorkflow(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="deleteWorkflow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showDetailDialog" title="流程详情" width="800px">
      <el-descriptions :column="2" border v-if="selectedWorkflow">
        <el-descriptions-item label="流程名称">{{ selectedWorkflow.name }}</el-descriptions-item>
        <el-descriptions-item label="流程编码">{{ selectedWorkflow.code }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ selectedWorkflow.version }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="selectedWorkflow.is_active ? 'success' : 'info'">
            {{ selectedWorkflow.is_active ? '启用' : '停用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ selectedWorkflow.description }}</el-descriptions-item>
      </el-descriptions>
      
      <h4 style="margin: 20px 0 10px;">流程节点</h4>
      <el-table :data="selectedWorkflow?.nodes || []" size="small" border>
        <el-table-column prop="node_name" label="节点名称" />
        <el-table-column prop="node_type" label="节点类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ getNodeTypeText(row.node_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="approval_type" label="审批类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.approval_type === 'countersign' ? 'warning' : 'primary'">
              {{ row.approval_type === 'countersign' ? '会签' : '单人' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="approval_roles" label="审批角色" width="150">
          <template #default="{ row }">
            {{ row.approval_roles?.join(', ') }}
          </template>
        </el-table-column>
        <el-table-column prop="timeout_hours" label="超时(小时)" width="100" />
        <el-table-column prop="timeout_strategy" label="超时策略" width="120">
          <template #default="{ row }">
            {{ row.timeout_strategy === 'auto_approve' ? '自动通过' : '仅通知' }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getWorkflows, deleteWorkflow as deleteWF } from '@/api/workflow'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const workflows = ref([])
const showDetailDialog = ref(false)
const selectedWorkflow = ref(null)

async function loadData() {
  loading.value = true
  try {
    const res = await getWorkflows()
    workflows.value = res
  } finally {
    loading.value = false
  }
}

function viewDetail(row) {
  selectedWorkflow.value = row
  showDetailDialog.value = true
}

function editWorkflow(row) {
  ElMessage.info('编辑功能开发中...')
}

async function deleteWorkflow(row) {
  try {
    await ElMessageBox.confirm('确定要删除该流程吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteWF(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

function getNodeTypeText(type) {
  const map = {
    start: '开始',
    end: '结束',
    approval: '审批',
    condition: '条件'
  }
  return map[type] || type
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
</style>
