<template>
  <div class="dashboard">
    <div class="page-header">
      <h2 class="page-title">监控仪表板</h2>
      <el-button type="primary" @click="refresh" :loading="loading">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #409EFF">
            <el-icon :size="28"><Collection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="label">数据源总数</div>
            <div class="value">{{ overview?.status?.datasource_count || 0 }}</div>
            <div class="sub-text">
              <span class="status-running">{{ runningDSCount }} 个运行中</span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #67C23A">
            <el-icon :size="28"><Connection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="label">管道总数</div>
            <div class="value">{{ overview?.status?.pipeline_count || 0 }}</div>
            <div class="sub-text">
              <span class="status-running">{{ runningPipeCount }} 个运行中</span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #E6A23C">
            <el-icon :size="28"><TrendCharts /></el-icon>
          </div>
          <div class="stat-content">
            <div class="label">总处理量</div>
            <div class="value">{{ formatNumber(overview?.status?.total_input || 0) }}</div>
            <div class="sub-text">
              <span class="status-info">总输出 {{ formatNumber(overview?.status?.total_output || 0) }}</span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" :class="{ 'has-error': overview?.status?.error_count > 0 }">
          <div class="stat-icon" style="background: #F56C6C">
            <el-icon :size="28"><Warning /></el-icon>
          </div>
          <div class="stat-content">
            <div class="label">异常数量</div>
            <div class="value">{{ overview?.status?.error_count || 0 }}</div>
            <div class="sub-text">
              <span :class="overview?.status?.error_count > 0 ? 'status-error' : 'status-running'">
                {{ overview?.status?.error_count > 0 ? '需要关注' : '运行正常' }}
              </span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="content-row">
      <el-col :span="12">
        <div class="card">
          <h3 class="card-title">
            <el-icon><Monitor /></el-icon>
            管道状态
          </h3>
          <el-table :data="overview?.status?.pipelines || []" size="small">
            <el-table-column prop="pipeline_id" label="ID" width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <span class="status-tag" :class="'status-' + row.status">
                  {{ row.status }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="input_count" label="输入" width="100" />
            <el-table-column prop="output_count" label="输出" width="100" />
            <el-table-column prop="error_count" label="错误" width="80" />
            <el-table-column prop="avg_latency_ms" label="延迟(ms)" width="100">
              <template #default="{ row }">
                {{ row.avg_latency_ms?.toFixed(2) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card">
          <h3 class="card-title">
            <el-icon><Collection /></el-icon>
            数据源状态
          </h3>
          <el-table :data="overview?.status?.datasources || []" size="small">
            <el-table-column prop="datasource_id" label="ID" width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <span class="status-tag" :class="'status-' + row.status">
                  {{ row.status }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="record_count" label="记录数" width="120" />
            <el-table-column prop="error_count" label="错误" width="80" />
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="content-row">
      <el-col :span="16">
        <div class="card">
          <h3 class="card-title">
            <el-icon><TrendCharts /></el-icon>
            处理流量趋势
          </h3>
          <div ref="chartRef" class="metric-chart"></div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="card">
          <h3 class="card-title">
            <el-icon><Warning /></el-icon>
            最近告警
          </h3>
          <el-table :data="overview?.recent_alerts || []" size="small">
            <el-table-column label="级别" width="80">
              <template #default="{ row }">
                <span class="status-tag" :class="'status-' + row.severity">
                  {{ row.severity }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="rule_name" label="规则" show-overflow-tooltip />
            <el-table-column prop="value" label="值" width="80" />
            <el-table-column label="时间" width="160">
              <template #default="{ row }">
                {{ formatTime(row.triggered_at) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <div v-if="overview?.unhealthy_pipes?.length > 0 || overview?.unhealthy_ds?.length > 0" class="card warning-section">
      <h3 class="card-title" style="color: #F56C6C">
        <el-icon><WarningFilled /></el-icon>
        需要关注的组件
      </h3>
      <el-alert
        v-if="overview?.unhealthy_pipes?.length > 0"
        type="error"
        :title="'异常管道: ' + overview.unhealthy_pipes.join(', ')"
        show-icon
        style="margin-bottom: 12px"
      />
      <el-alert
        v-if="overview?.unhealthy_ds?.length > 0"
        type="warning"
        :title="'异常数据源: ' + overview.unhealthy_ds.join(', ')"
        show-icon
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import * as api from '@/api'
import dayjs from 'dayjs'

const loading = ref(false)
const overview = ref(null)
const chartRef = ref(null)
let chart = null
let refreshTimer = null

const runningDSCount = ref(0)
const runningPipeCount = ref(0)

const formatNumber = num => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const formatTime = t => dayjs(t).format('MM-DD HH:mm:ss')

const initChart = () => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chart) return

  const metrics = overview.value?.pipeline_metrics || {}
  const times = []
  const inputData = []
  const outputData = []

  const now = dayjs()
  for (let i = 11; i >= 0; i--) {
    times.push(now.subtract(i * 5, 'minute').format('HH:mm'))
    inputData.push(Math.floor(Math.random() * 1000))
    outputData.push(Math.floor(Math.random() * 900))
  }

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['输入', '输出'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: times, boundaryGap: false },
    yAxis: { type: 'value' },
    series: [
      {
        name: '输入',
        type: 'line',
        smooth: true,
        data: inputData,
        areaStyle: { opacity: 0.3 },
        color: '#409EFF'
      },
      {
        name: '输出',
        type: 'line',
        smooth: true,
        data: outputData,
        areaStyle: { opacity: 0.3 },
        color: '#67C23A'
      }
    ]
  })
}

const refresh = async () => {
  loading.value = true
  try {
    const res = await api.getMonitorOverview()
    overview.value = res.data

    runningDSCount.value = (overview.value.status?.datasources || []).filter(
      d => d.status === 'running'
    ).length
    runningPipeCount.value = (overview.value.status?.pipelines || []).filter(
      p => p.status === 'running'
    ).length

    updateChart()
  } finally {
    loading.value = false
  }
}

const handleResize = () => {
  chart?.resize()
}

onMounted(() => {
  refresh()
  nextTick(() => initChart())
  refreshTimer = setInterval(refresh, 10000)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>

<style scoped>
.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.stat-card.has-error {
  border: 1px solid #F56C6C;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-content .label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-content .value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.stat-content .sub-text {
  font-size: 12px;
  margin-top: 4px;
}

.content-row {
  margin-bottom: 20px;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  height: 100%;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
}

.warning-section {
  border-left: 4px solid #F56C6C;
}
</style>
