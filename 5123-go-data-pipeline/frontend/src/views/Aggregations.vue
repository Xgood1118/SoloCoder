<template>
  <div class="aggregations">
    <div class="page-header">
      <h2 class="page-title">聚合统计</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        新增聚合规则
      </el-button>
    </div>

    <el-row :gutter="20">
      <el-col :span="10">
        <div class="card">
          <h3 class="card-title">
            <el-icon><TrendCharts /></el-icon>
            聚合规则列表
          </h3>
          <el-table :data="rules" v-loading="loading" @row-click="selectRule" highlight-current-row>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="名称" width="150" />
            <el-table-column label="聚合函数" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.function }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="field" label="字段" width="120" />
            <el-table-column label="窗口" width="100">
              <template #default="{ row }">
                {{ formatWindow(row.window_seconds) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <span class="status-tag" :class="row.enabled ? 'status-running' : 'status-stopped'">
                  {{ row.enabled ? '启用' : '停用' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click.stop="openEditDialog(row)">
                  编辑
                </el-button>
                <el-button type="danger" size="small" @click.stop="deleteRule(row)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :span="14">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <el-icon><DataLine /></el-icon>
              聚合结果
              <span v-if="selectedRule" class="selected-info">
                - {{ selectedRule.name }}
              </span>
            </h3>
            <el-select v-if="selectedRule" v-model="chartType" size="small" style="width: 120px">
              <el-option label="折线图" value="line" />
              <el-option label="柱状图" value="bar" />
            </el-select>
          </div>
          <div v-if="!selectedRule" class="empty-state">
            <el-empty description="请选择一个聚合规则查看结果" />
          </div>
          <div v-else>
            <div ref="chartRef" class="agg-chart"></div>
            <div class="result-table">
              <h4 class="sub-title">最近数据</h4>
              <el-table :data="results" size="small" max-height="250">
                <el-table-column label="时间窗口" width="180">
                  <template #default="{ row }">
                    {{ formatTime(row.window_start) }} - {{ formatTime(row.window_end) }}
                  </template>
                </el-table-column>
                <el-table-column prop="value" label="聚合值" width="120">
                  <template #default="{ row }">
                    {{ row.value?.toFixed(2) }}
                  </template>
                </el-table-column>
                <el-table-column prop="count" label="样本数" width="100" />
                <el-table-column label="生成时间" width="160">
                  <template #default="{ row }">
                    {{ formatTime(row.timestamp) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑聚合规则' : '新增聚合规则'" width="600px">
      <el-form :model="form" :rules="rulesForm" ref="formRef" label-width="120px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="数据源" prop="datasource_id">
          <el-select v-model="form.datasource_id" placeholder="选择数据源" style="width: 100%">
            <el-option v-for="ds in datasourceOptions" :key="ds.id" :label="ds.name" :value="ds.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="聚合函数" prop="function">
          <el-select v-model="form.function" style="width: 100%">
            <el-option label="计数 (Count)" value="count" />
            <el-option label="求和 (Sum)" value="sum" />
            <el-option label="平均值 (Avg)" value="avg" />
            <el-option label="最小值 (Min)" value="min" />
            <el-option label="最大值 (Max)" value="max" />
            <el-option label="P50分位数" value="percentile_50" />
            <el-option label="P90分位数" value="percentile_90" />
            <el-option label="P95分位数" value="percentile_95" />
            <el-option label="P99分位数" value="percentile_99" />
          </el-select>
        </el-form-item>
        <el-form-item label="聚合字段" prop="field">
          <el-input v-model="form.field" placeholder="例如: response_time, 留空则计数" />
        </el-form-item>
        <el-form-item label="过滤条件">
          <el-input
            v-model="form.filter_condition"
            placeholder="例如: level == 'error'，留空不过滤"
          />
        </el-form-item>
        <el-form-item label="时间窗口(秒)" prop="window_seconds">
          <el-select v-model="form.window_seconds" style="width: 100%">
            <el-option label="1分钟" :value="60" />
            <el-option label="5分钟" :value="300" />
            <el-option label="15分钟" :value="900" />
            <el-option label="1小时" :value="3600" />
            <el-option label="6小时" :value="21600" />
            <el-option label="1天" :value="86400" />
          </el-select>
        </el-form-item>
        <el-form-item label="窗口类型">
          <el-radio-group v-model="form.window_type">
            <el-radio value="tumbling">滚动窗口</el-radio>
            <el-radio value="sliding">滑动窗口</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import * as api from '@/api'
import dayjs from 'dayjs'

const loading = ref(false)
const rules = ref([])
const results = ref([])
const datasourceOptions = ref([])
const selectedRule = ref(null)
const chartType = ref('line')
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const chartRef = ref(null)
let chart = null
let refreshTimer = null

const form = reactive({
  id: '',
  name: '',
  datasource_id: '',
  function: 'count',
  field: '',
  filter_condition: '',
  window_seconds: 60,
  window_type: 'tumbling',
  enabled: true,
  description: ''
})

const rulesForm = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  datasource_id: [{ required: true, message: '请选择数据源', trigger: 'change' }],
  function: [{ required: true, message: '请选择聚合函数', trigger: 'change' }],
  window_seconds: [{ required: true, message: '请选择时间窗口', trigger: 'change' }]
}

const formatTime = t => dayjs(t).format('MM-DD HH:mm:ss')

const formatWindow = seconds => {
  if (seconds < 60) return seconds + '秒'
  if (seconds < 3600) return (seconds / 60) + '分钟'
  if (seconds < 86400) return (seconds / 3600) + '小时'
  return (seconds / 86400) + '天'
}

const fetchRules = async () => {
  loading.value = true
  try {
    const res = await api.getAggregationRules()
    rules.value = res.data
    if (rules.value.length > 0 && !selectedRule.value) {
      selectRule(rules.value[0])
    }
  } finally {
    loading.value = false
  }
}

const fetchDatasources = async () => {
  try {
    const res = await api.getDatasources()
    datasourceOptions.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const fetchResults = async () => {
  if (!selectedRule.value) return
  try {
    const res = await api.getAggregationResults(selectedRule.value.id, 50)
    results.value = res.data
    updateChart()
  } catch (e) {
    console.error(e)
  }
}

const selectRule = row => {
  selectedRule.value = row
  nextTick(() => {
    if (!chart && chartRef.value) {
      chart = echarts.init(chartRef.value)
    }
    fetchResults()
  })
}

const updateChart = () => {
  if (!chart || !results.value.length) return

  const times = []
  const values = []

  const sorted = [...results.value].sort((a, b) => new Date(a.window_start) - new Date(b.window_start))
  sorted.forEach(r => {
    times.push(dayjs(r.window_start).format('MM-DD HH:mm'))
    values.push(parseFloat(r.value?.toFixed(2) || 0))
  })

  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: times, boundaryGap: chartType.value === 'bar' },
    yAxis: { type: 'value' },
    series: [
      {
        name: selectedRule.value?.name || '值',
        type: chartType.value,
        smooth: chartType.value === 'line',
        data: values,
        areaStyle: chartType.value === 'line' ? { opacity: 0.3 } : undefined,
        color: '#409EFF'
      }
    ]
  })
}

watch(chartType, () => {
  updateChart()
})

const openCreateDialog = () => {
  isEdit.value = false
  Object.assign(form, {
    id: '',
    name: '',
    datasource_id: '',
    function: 'count',
    field: '',
    filter_condition: '',
    window_seconds: 60,
    window_type: 'tumbling',
    enabled: true,
    description: ''
  })
  dialogVisible.value = true
}

const openEditDialog = row => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    name: row.name,
    datasource_id: row.datasource_id,
    function: row.function,
    field: row.field,
    filter_condition: row.filter_condition,
    window_seconds: row.window_seconds,
    window_type: row.window_type || 'tumbling',
    enabled: row.enabled,
    description: row.description
  })
  dialogVisible.value = true
}

const save = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    try {
      if (isEdit.value) {
        await api.updateAggregationRule(form.id, form)
        ElMessage.success('更新成功')
      } else {
        await api.createAggregationRule(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      fetchRules()
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '操作失败')
    }
  })
}

const deleteRule = row => {
  ElMessageBox.confirm(`确定删除聚合规则"${row.name}"吗?`, '确认删除', {
    type: 'warning'
  }).then(async () => {
    try {
      await api.deleteAggregationRule(row.id)
      ElMessage.success('删除成功')
      if (selectedRule.value?.id === row.id) {
        selectedRule.value = null
      }
      fetchRules()
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '删除失败')
    }
  }).catch(() => {})
}

const handleResize = () => {
  chart?.resize()
}

onMounted(() => {
  fetchRules()
  fetchDatasources()
  refreshTimer = setInterval(fetchResults, 10000)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.selected-info {
  font-size: 14px;
  font-weight: 400;
  color: #909399;
  margin-left: 8px;
}

.agg-chart {
  height: 300px;
  margin-bottom: 20px;
}

.empty-state {
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sub-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
}
</style>
