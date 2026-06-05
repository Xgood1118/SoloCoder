<template>
  <div class="stats-page">
    <div class="page-header">
      <h3>统计与导出</h3>
    </div>

    <el-tabs v-model="activeTab" class="stats-tabs">
      <el-tab-pane label="我的统计" name="my">
        <el-row :gutter="20">
          <el-col :span="16">
            <el-card shadow="never">
              <h4>我的任务统计</h4>
              <div class="stats-grid" v-if="stats">
                <div class="stat-item" style="border-left-color: #909399;">
                  <div class="stat-value">{{ stats.todo }}</div>
                  <div class="stat-label">待办</div>
                </div>
                <div class="stat-item" style="border-left-color: #409eff;">
                  <div class="stat-value">{{ stats.in_progress }}</div>
                  <div class="stat-label">进行中</div>
                </div>
                <div class="stat-item" style="border-left-color: #e6a23c;">
                  <div class="stat-value">{{ stats.pending_review }}</div>
                  <div class="stat-label">待审核</div>
                </div>
                <div class="stat-item" style="border-left-color: #67c23a;">
                  <div class="stat-value">{{ stats.done }}</div>
                  <div class="stat-label">已完成</div>
                </div>
                <div class="stat-item" style="border-left-color: #c0c4cc;">
                  <div class="stat-value">{{ stats.closed }}</div>
                  <div class="stat-label">已关闭</div>
                </div>
                <div class="stat-item" style="border-left-color: #f56c6c;">
                  <div class="stat-value">{{ stats.due_soon }}</div>
                  <div class="stat-label">即将到期</div>
                </div>
              </div>
            </el-card>
          </el-col>

          <el-col :span="8">
            <el-card shadow="never">
              <h4>导出任务</h4>
              <p style="color: #909399; font-size: 13px; margin-bottom: 16px;">
                导出您负责的任务为 CSV 文件，超过500条将自动分文件打包。
              </p>
              <el-form label-width="80px">
                <el-form-item label="开始时间">
                  <el-date-picker v-model="exportFrom" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%;" />
                </el-form-item>
                <el-form-item label="结束时间">
                  <el-date-picker v-model="exportTo" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%;" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="exportTasks" :loading="exporting">导出 CSV</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="分类统计" name="category">
        <el-row :gutter="20">
          <el-col :span="16">
            <el-card shadow="never">
              <h4>各分类任务统计</h4>
              <div class="category-list" v-if="categoryStats && categoryStats.by_category.length">
                <div v-for="cat in categoryStats.by_category" :key="cat.category_id" class="category-item">
                  <div class="category-header">
                    <span class="category-color-dot" :style="{ backgroundColor: cat.category_color }"></span>
                    <span class="category-name">{{ cat.category_name }}</span>
                    <span class="category-total">共 {{ cat.total }} 个</span>
                  </div>
                  <div class="category-status">
                    <el-tag size="small" type="success" effect="plain">已完成 {{ cat.completed }}</el-tag>
                    <el-tag size="small" type="primary" effect="plain">进行中 {{ cat.in_progress }}</el-tag>
                    <el-tag size="small" type="info" effect="plain">待办 {{ cat.todo }}</el-tag>
                  </div>
                  <div class="priority-breakdown">
                    <span class="breakdown-label">优先级分布：</span>
                    <el-tag v-if="cat.priority_breakdown.urgent" size="small" type="danger">紧急 {{ cat.priority_breakdown.urgent }}</el-tag>
                    <el-tag v-if="cat.priority_breakdown.high" size="small" type="danger" effect="plain">高 {{ cat.priority_breakdown.high }}</el-tag>
                    <el-tag v-if="cat.priority_breakdown.medium" size="small" type="warning" effect="plain">中 {{ cat.priority_breakdown.medium }}</el-tag>
                    <el-tag v-if="cat.priority_breakdown.medium_low" size="small" type="info" effect="plain">中低 {{ cat.priority_breakdown.medium_low }}</el-tag>
                    <el-tag v-if="cat.priority_breakdown.low" size="small" type="info" effect="plain">低 {{ cat.priority_breakdown.low }}</el-tag>
                    <span v-if="!cat.priority_breakdown.urgent && !cat.priority_breakdown.high && !cat.priority_breakdown.medium && !cat.priority_breakdown.medium_low && !cat.priority_breakdown.low" class="no-priority">暂无</span>
                  </div>
                </div>
              </div>
              <el-empty v-else description="暂无数据" />
            </el-card>
          </el-col>

          <el-col :span="8">
            <el-card shadow="never">
              <h4>按月汇总（近12个月）</h4>
              <div class="monthly-list" v-if="categoryStats && categoryStats.monthly.length">
                <div v-for="m in categoryStats.monthly" :key="m.month" class="monthly-item">
                  <div class="monthly-header">
                    <span class="month">{{ m.month }}</span>
                    <span class="monthly-count">创建 {{ m.total }} 个，完成 {{ m.completed }} 个</span>
                  </div>
                  <div class="monthly-priority">
                    <el-tag v-if="m.priority_breakdown.urgent" size="small" type="danger" effect="plain">紧急 {{ m.priority_breakdown.urgent }}</el-tag>
                    <el-tag v-if="m.priority_breakdown.high" size="small" type="danger" effect="plain">高 {{ m.priority_breakdown.high }}</el-tag>
                    <el-tag v-if="m.priority_breakdown.medium" size="small" type="warning" effect="plain">中 {{ m.priority_breakdown.medium }}</el-tag>
                    <el-tag v-if="m.priority_breakdown.medium_low" size="small" type="info" effect="plain">中低 {{ m.priority_breakdown.medium_low }}</el-tag>
                    <el-tag v-if="m.priority_breakdown.low" size="small" type="info" effect="plain">低 {{ m.priority_breakdown.low }}</el-tag>
                  </div>
                </div>
              </div>
              <el-empty v-else description="暂无数据" />
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../api'

const activeTab = ref('my')
const stats = ref(null)
const categoryStats = ref(null)
const exportFrom = ref('')
const exportTo = ref('')
const exporting = ref(false)

async function loadStats() {
  const res = await api.get('/stats/my')
  stats.value = res.data
}

async function loadCategoryStats() {
  const res = await api.get('/stats/by-category')
  categoryStats.value = res.data
}

async function exportTasks() {
  exporting.value = true
  try {
    const params = {}
    if (exportFrom.value) params.date_from = exportFrom.value
    if (exportTo.value) params.date_to = exportTo.value

    const res = await api.get('/stats/export', { params, responseType: 'blob' })
    const blob = new Blob([res.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const contentType = res.headers['content-type']
    link.download = contentType?.includes('zip') ? 'tasks_export.zip' : 'tasks_export.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

watch(activeTab, (newTab) => {
  if (newTab === 'category' && !categoryStats.value) {
    loadCategoryStats()
  }
})

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.stats-page {
  padding: 0;
}
.page-header {
  margin-bottom: 16px;
}
.page-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
}
.stat-item {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  border-left: 4px solid;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.stats-tabs :deep(.el-tabs__header) {
  margin: 0 0 16px;
}
.category-list {
  margin-top: 16px;
}
.category-item {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 12px;
}
.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.category-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.category-name {
  font-weight: 600;
  font-size: 15px;
}
.category-total {
  color: #909399;
  font-size: 13px;
  margin-left: auto;
}
.category-status {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.priority-breakdown {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.breakdown-label {
  color: #606266;
  font-size: 13px;
}
.no-priority {
  color: #c0c4cc;
  font-size: 13px;
}
.monthly-list {
  margin-top: 16px;
}
.monthly-item {
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 10px;
}
.monthly-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.month {
  font-weight: 600;
  font-size: 14px;
}
.monthly-count {
  color: #909399;
  font-size: 12px;
}
.monthly-priority {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
