<template>
  <div class="alerts">
    <div class="page-header">
      <h2 class="page-title">告警规则</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        新增规则
      </el-button>
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <div class="card">
          <h3 class="card-title">
            <el-icon><Warning /></el-icon>
            告警规则列表
          </h3>
          <el-table :data="rules" v-loading="loading">
            <el-table-column prop="id" label="ID" width="100" />
            <el-table-column prop="name" label="名称" width="150" />
            <el-table-column label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="getSeverityTag(row.severity)">{{ row.severity }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="condition" label="条件" show-overflow-tooltip />
            <el-table-column label="时间窗口" width="120">
              <template #default="{ row }">
                {{ formatWindow(row.window_seconds) }}
              </template>
            </el-table-column>
            <el-table-column prop="threshold" label="阈值" width="100" />
            <el-table-column label="版本" width="80">
              <template #default="{ row }">
                v{{ row.version }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" @change="toggleEnabled(row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="openEditDialog(row)">
                  编辑
                </el-button>
                <el-button type="info" size="small" @click="showHistory(row)">
                  历史
                </el-button>
                <el-button type="danger" size="small" @click="deleteRule(row)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="card">
          <h3 class="card-title">
            <el-icon><Clock /></el-icon>
            最近告警历史
          </h3>
          <el-table :data="history" v-loading="historyLoading" size="small">
            <el-table-column label="级别" width="80">
              <template #default="{ row }">
                <span class="status-tag" :class="'status-' + row.severity">
                  {{ row.severity }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="rule_name" label="规则" show-overflow-tooltip />
            <el-table-column prop="value" label="值" width="80" />
            <el-table-column label="时间" width="140">
              <template #default="{ row }">
                {{ formatTime(row.triggered_at) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑告警规则' : '新增告警规则'" width="650px">
      <el-form :model="form" :rules="rulesForm" ref="formRef" label-width="120px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="级别" prop="severity">
          <el-select v-model="form.severity" style="width: 100%">
            <el-option label="低" value="low" />
            <el-option label="中" value="medium" />
            <el-option label="高" value="high" />
            <el-option label="严重" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="聚合规则" prop="aggregation_id">
          <el-select v-model="form.aggregation_id" placeholder="选择聚合规则" style="width: 100%">
            <el-option v-for="agg in aggregationOptions" :key="agg.id" :label="agg.name" :value="agg.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="条件表达式" prop="condition">
          <el-input
            v-model="form.condition"
            placeholder="例如: value > 100 或 value >= threshold"
          />
        </el-form-item>
        <el-form-item label="阈值" prop="threshold">
          <el-input-number v-model="form.threshold" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="时间窗口(秒)" prop="window_seconds">
          <el-select v-model="form.window_seconds" style="width: 100%">
            <el-option label="1分钟" :value="60" />
            <el-option label="5分钟" :value="300" />
            <el-option label="15分钟" :value="900" />
            <el-option label="1小时" :value="3600" />
            <el-option label="1天" :value="86400" />
          </el-select>
        </el-form-item>
        <el-form-item label="冷却时间(秒)" prop="cooldown_seconds">
          <el-input-number v-model="form.cooldown_seconds" :min="60" :max="86400" style="width: 100%" />
        </el-form-item>
        <el-form-item label="通知方式">
          <el-checkbox v-model="form.notify_email">邮件</el-checkbox>
          <el-checkbox v-model="form.notify_webhook">Webhook</el-checkbox>
        </el-form-item>
        <el-form-item v-if="form.notify_email" label="通知邮箱">
          <el-input v-model="form.email_addresses" placeholder="多个邮箱用逗号分隔" />
        </el-form-item>
        <el-form-item v-if="form.notify_webhook" label="Webhook地址">
          <el-input v-model="form.webhook_url" placeholder="https://..." />
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

    <el-dialog v-model="historyVisible" title="告警历史" width="700px">
      <el-table :data="ruleHistory" size="small">
        <el-table-column label="级别" width="80">
          <template #default="{ row }">
            <el-tag :type="getSeverityTag(row.severity)" size="small">{{ row.severity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="value" label="触发值" width="100" />
        <el-table-column prop="threshold" label="阈值" width="100" />
        <el-table-column prop="message" label="消息" show-overflow-tooltip />
        <el-table-column label="触发时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.triggered_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as api from '@/api'
import dayjs from 'dayjs'

const loading = ref(false)
const historyLoading = ref(false)
const rules = ref([])
const history = ref([])
const ruleHistory = ref([])
const aggregationOptions = ref([])
const dialogVisible = ref(false)
const historyVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const form = reactive({
  id: '',
  version: 1,
  name: '',
  severity: 'medium',
  aggregation_id: '',
  condition: '',
  threshold: 100,
  window_seconds: 60,
  cooldown_seconds: 300,
  enabled: true,
  notify_email: false,
  notify_webhook: false,
  email_addresses: '',
  webhook_url: '',
  description: ''
})

const rulesForm = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  severity: [{ required: true, message: '请选择级别', trigger: 'change' }],
  condition: [{ required: true, message: '请输入条件表达式', trigger: 'blur' }],
  threshold: [{ required: true, message: '请输入阈值', trigger: 'blur' }],
  window_seconds: [{ required: true, message: '请选择时间窗口', trigger: 'change' }]
}

const formatTime = t => dayjs(t).format('YYYY-MM-DD HH:mm:ss')

const formatWindow = seconds => {
  if (seconds < 60) return seconds + '秒'
  if (seconds < 3600) return (seconds / 60) + '分钟'
  if (seconds < 86400) return (seconds / 3600) + '小时'
  return (seconds / 86400) + '天'
}

const getSeverityTag = s => {
  const map = {
    low: 'info',
    medium: 'warning',
    high: 'danger',
    critical: 'danger'
  }
  return map[s] || 'info'
}

const fetchRules = async () => {
  loading.value = true
  try {
    const res = await api.getAlertRules()
    rules.value = res.data
  } finally {
    loading.value = false
  }
}

const fetchHistory = async () => {
  historyLoading.value = true
  try {
    const res = await api.getAlertHistory('', 20)
    history.value = res.data
  } finally {
    historyLoading.value = false
  }
}

const fetchAggregations = async () => {
  try {
    const res = await api.getAggregationRules()
    aggregationOptions.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const openCreateDialog = () => {
  isEdit.value = false
  Object.assign(form, {
    id: '',
    version: 1,
    name: '',
    severity: 'medium',
    aggregation_id: '',
    condition: '',
    threshold: 100,
    window_seconds: 60,
    cooldown_seconds: 300,
    enabled: true,
    notify_email: false,
    notify_webhook: false,
    email_addresses: '',
    webhook_url: '',
    description: ''
  })
  dialogVisible.value = true
}

const openEditDialog = row => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    version: row.version,
    name: row.name,
    severity: row.severity,
    aggregation_id: row.aggregation_id,
    condition: row.condition,
    threshold: row.threshold,
    window_seconds: row.window_seconds,
    cooldown_seconds: row.cooldown_seconds,
    enabled: row.enabled,
    notify_email: row.notify_email,
    notify_webhook: row.notify_webhook,
    email_addresses: row.email_addresses,
    webhook_url: row.webhook_url,
    description: row.description
  })
  dialogVisible.value = true
}

const showHistory = async row => {
  try {
    const res = await api.getAlertHistory(row.id, 50)
    ruleHistory.value = res.data
    historyVisible.value = true
  } catch (e) {
    ElMessage.error('获取历史失败')
  }
}

const toggleEnabled = async row => {
  try {
    await api.updateAlertRule(row.id, { ...row, version: row.version })
    ElMessage.success('状态已更新')
    fetchRules()
  } catch (e) {
    const msg = e.response?.data?.message || '更新失败'
    if (msg.includes('版本冲突')) {
      ElMessage.error('版本冲突，请刷新页面后重试')
    } else {
      ElMessage.error(msg)
    }
    row.enabled = !row.enabled
  }
}

const save = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    try {
      if (isEdit.value) {
        await api.updateAlertRule(form.id, { ...form })
        ElMessage.success('更新成功')
      } else {
        await api.createAlertRule(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      fetchRules()
    } catch (e) {
      const msg = e.response?.data?.message || '操作失败'
      if (msg.includes('版本冲突')) {
        ElMessage.error('版本冲突，请刷新页面后重试')
      } else {
        ElMessage.error(msg)
      }
    }
  })
}

const deleteRule = row => {
  ElMessageBox.confirm(`确定删除告警规则"${row.name}"吗?`, '确认删除', {
    type: 'warning'
  }).then(async () => {
    try {
      await api.deleteAlertRule(row.id)
      ElMessage.success('删除成功')
      fetchRules()
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '删除失败')
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchRules()
  fetchHistory()
  fetchAggregations()
})
</script>

<style scoped>
</style>
