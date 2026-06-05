<template>
  <div class="task-list-page">
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item>
          <el-button-group>
            <el-button :type="viewMode === 'all' ? 'primary' : ''" @click="switchView('all')">全部任务</el-button>
            <el-button :type="viewMode === 'today' ? 'primary' : ''" @click="switchView('today')">今日到期</el-button>
          </el-button-group>
        </el-form-item>
        <el-form-item label="排序">
          <el-select v-model="sortBy" style="width: 130px" @change="loadTasks">
            <el-option label="按截止时间" value="due_date" />
            <el-option label="优先级降序" value="priority_desc" />
            <el-option label="优先级升序" value="priority_asc" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="搜索标题" clearable style="width: 160px" @clear="loadTasks" @keyup.enter="loadTasks" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 130px" @change="loadTasks">
            <el-option label="待办" value="todo" />
            <el-option label="进行中" value="in_progress" />
            <el-option label="待审核" value="pending_review" />
            <el-option label="已完成" value="done" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="filters.priority" placeholder="全部" clearable style="width: 120px" @change="loadTasks">
            <el-option label="紧急" value="urgent" />
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="中低" value="medium_low" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="filters.category_id" placeholder="全部" clearable style="width: 140px" @change="loadTasks">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="filters.assignee_id" placeholder="全部" clearable style="width: 130px" @change="loadTasks">
            <el-option v-for="u in users" :key="u.id" :label="u.real_name || u.username" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止时间" v-if="viewMode === 'all'">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadTasks">筛选</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <el-table :data="paginatedTasks" stripe style="width: 100%" @row-click="handleRowClick" row-key="id" :row-class-name="tableRowClassName">
        <el-table-column label="标题" min-width="200">
          <template #default="{ row }">
            <div class="task-title-cell">
              <span class="task-title">{{ truncateTitle(row.title) }}</span>
              <span v-if="row.category_name" class="category-tag" :style="{ backgroundColor: row.category_color + '22', color: row.category_color, borderColor: row.category_color + '44' }">
                {{ row.category_name }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="priorityType(row.priority)" size="small">{{ priorityLabel(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="plain">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="100" align="center">
          <template #default="{ row }">
            {{ row.assignee_name || '无' }}
          </template>
        </el-table-column>
        <el-table-column label="进度" width="120" align="center">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="8" :color="progressColor(row.progress)" />
          </template>
        </el-table-column>
        <el-table-column label="截止时间" width="110" align="center">
          <template #default="{ row }">
            <span :class="{ 'overdue-text': isOverdue(row) }">
              {{ formatDate(row.due_date) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="创建人" width="90" align="center">
          <template #default="{ row }">{{ row.creator_name }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper" v-if="tasks.length > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="tasks.length"
          layout="prev, pager, next"
          background
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'

const router = useRouter()
const tasks = ref([])
const categories = ref([])
const users = ref([])
const currentPage = ref(1)
const pageSize = 20
const dateRange = ref(null)
const viewMode = ref('all')
const sortBy = ref('priority_desc')

const filters = reactive({
  keyword: '',
  status: '',
  priority: '',
  category_id: '',
  assignee_id: '',
  due_date_from: '',
  due_date_to: '',
})

const paginatedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return tasks.value.slice(start, start + pageSize)
})

function truncateTitle(title) {
  if (!title) return ''
  return title.length > 50 ? title.substring(0, 50) + '...' : title
}

function priorityLabel(p) {
  return { urgent: '紧急', high: '高', medium: '中', medium_low: '中低', low: '低' }[p] || p
}

function priorityType(p) {
  return { urgent: 'danger', high: 'danger', medium: 'warning', medium_low: 'info', low: 'info' }[p] || ''
}

function statusLabel(s) {
  return { todo: '待办', in_progress: '进行中', pending_review: '待审核', done: '已完成', closed: '已关闭' }[s] || s
}

function statusType(s) {
  return { todo: 'info', in_progress: '', pending_review: 'warning', done: 'success', closed: 'info' }[s] || ''
}

function progressColor(p) {
  if (p >= 80) return '#67c23a'
  if (p >= 40) return '#e6a23c'
  return '#409eff'
}

function formatDate(dt) {
  if (!dt) return '-'
  return new Date(dt).toLocaleDateString('zh-CN')
}

function isOverdue(task) {
  if (!task.due_date) return false
  if (task.status === 'done' || task.status === 'closed') return false
  return new Date(task.due_date) < new Date()
}

function tableRowClassName({ row }) {
  return isOverdue(row) ? 'overdue-row' : ''
}

function switchView(mode) {
  viewMode.value = mode
  loadTasks()
}

function handleDateChange(val) {
  if (val) {
    filters.due_date_from = val[0]
    filters.due_date_to = val[1]
  } else {
    filters.due_date_from = ''
    filters.due_date_to = ''
  }
  loadTasks()
}

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  filters.priority = ''
  filters.category_id = ''
  filters.assignee_id = ''
  filters.due_date_from = ''
  filters.due_date_to = ''
  dateRange.value = null
  sortBy.value = 'priority_desc'
  loadTasks()
}

async function loadTasks() {
  const params = {}
  if (filters.keyword) params.keyword = filters.keyword
  if (filters.status) params.status = filters.status
  if (filters.priority) params.priority = filters.priority
  if (filters.category_id) params.category_id = filters.category_id
  if (filters.assignee_id) params.assignee_id = filters.assignee_id
  if (viewMode.value === 'all') {
    if (filters.due_date_from) params.due_date_from = filters.due_date_from
    if (filters.due_date_to) params.due_date_to = filters.due_date_to
  }
  params.sort_by = sortBy.value

  const endpoint = viewMode.value === 'today' ? '/tasks/today' : '/tasks/'
  const res = await api.get(endpoint, { params })
  tasks.value = res.data
  currentPage.value = 1
}

async function loadCategories() {
  const res = await api.get('/categories/')
  categories.value = res.data
}

async function loadUsers() {
  const res = await api.get('/users/')
  users.value = res.data
}

function handleRowClick(row) {
  router.push(`/tasks/${row.id}`)
}

onMounted(() => {
  loadTasks()
  loadCategories()
  loadUsers()
})
</script>

<style scoped>
.task-list-page {
  padding: 0;
}
.filter-card :deep(.el-card__body) {
  padding: 16px 20px 0;
}
.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}
.filter-form .el-form-item {
  margin-bottom: 16px;
}
.task-title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.task-title {
  font-weight: 500;
  cursor: pointer;
}
.category-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  border: 1px solid;
  white-space: nowrap;
}
.overdue-text {
  color: #f56c6c;
  font-weight: bold;
}
.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>

<style>
.el-table .overdue-row {
  background-color: #fef0f0 !important;
}
.el-table .overdue-row:hover > td {
  background-color: #fde2e2 !important;
}
</style>
