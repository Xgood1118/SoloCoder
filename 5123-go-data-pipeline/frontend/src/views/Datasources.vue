<template>
  <div class="datasources">
    <div class="page-header">
      <h2 class="page-title">数据源管理</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        新增数据源
      </el-button>
    </div>

    <div class="card">
      <el-table :data="datasources" v-loading="loading">
        <el-table-column prop="id" label="ID" width="120" />
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeTag(row.type)">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-tag" :class="'status-' + row.status">
              {{ row.status }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="record_count" label="记录数" width="100" />
        <el-table-column prop="error_count" label="错误数" width="100" />
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'running'" type="success" size="small" @click="startDS(row.id)">
              启动
            </el-button>
            <el-button v-else type="warning" size="small" @click="stopDS(row.id)">
              停止
            </el-button>
            <el-button type="primary" size="small" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="deleteDS(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑数据源' : '新增数据源'" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入数据源名称" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择数据源类型" style="width: 100%">
            <el-option label="文件目录" value="file" />
            <el-option label="Kafka" value="kafka" />
            <el-option label="Elasticsearch" value="elasticsearch" />
            <el-option label="HTTP推送" value="http" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item v-if="form.type === 'file'" label="配置">
          <div class="config-fields">
            <el-form-item label="目录路径">
              <el-input v-model="form.config.path" placeholder="/var/logs" />
            </el-form-item>
            <el-form-item label="文件模式">
              <el-input v-model="form.config.pattern" placeholder="*.log" />
            </el-form-item>
          </div>
        </el-form-item>
        <el-form-item v-if="form.type === 'kafka'" label="配置">
          <div class="config-fields">
            <el-form-item label="Broker地址">
              <el-input v-model="form.config.brokers" placeholder="localhost:9092" />
            </el-form-item>
            <el-form-item label="Topic">
              <el-input v-model="form.config.topic" placeholder="logs" />
            </el-form-item>
            <el-form-item label="消费组">
              <el-input v-model="form.config.group_id" placeholder="log-pipeline" />
            </el-form-item>
          </div>
        </el-form-item>
        <el-form-item v-if="form.type === 'elasticsearch'" label="配置">
          <div class="config-fields">
            <el-form-item label="ES地址">
              <el-input v-model="form.config.addresses" placeholder="http://localhost:9200" />
            </el-form-item>
            <el-form-item label="索引">
              <el-input v-model="form.config.index" placeholder="logs-*" />
            </el-form-item>
            <el-form-item label="查询间隔(秒)">
              <el-input-number v-model="form.config.interval_seconds" :min="5" :max="3600" />
            </el-form-item>
          </div>
        </el-form-item>
        <el-form-item v-if="form.type === 'http'" label="配置">
          <div class="config-fields">
            <el-form-item label="监听端口">
              <el-input-number v-model="form.config.port" :min="1024" :max="65535" />
            </el-form-item>
            <el-form-item label="路径">
              <el-input v-model="form.config.path" placeholder="/ingest" />
            </el-form-item>
          </div>
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as api from '@/api'
import dayjs from 'dayjs'

const loading = ref(false)
const datasources = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const form = reactive({
  id: '',
  name: '',
  type: '',
  description: '',
  config: {}
})

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }]
}

const formatTime = t => dayjs(t).format('YYYY-MM-DD HH:mm:ss')

const getTypeTag = type => {
  const map = {
    file: 'info',
    kafka: 'warning',
    elasticsearch: 'success',
    http: 'primary'
  }
  return map[type] || ''
}

const fetchDatasources = async () => {
  loading.value = true
  try {
    const res = await api.getDatasources()
    datasources.value = res.data
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  isEdit.value = false
  Object.assign(form, {
    id: '',
    name: '',
    type: '',
    description: '',
    config: {}
  })
  dialogVisible.value = true
}

const openEditDialog = row => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    config: { ...row.config }
  })
  dialogVisible.value = true
}

const save = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    try {
      if (isEdit.value) {
        await api.updateDatasource(form.id, form)
        ElMessage.success('更新成功')
      } else {
        await api.createDatasource(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      fetchDatasources()
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '操作失败')
    }
  })
}

const startDS = async id => {
  try {
    await api.startDatasource(id)
    ElMessage.success('启动成功')
    fetchDatasources()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '启动失败')
  }
}

const stopDS = async id => {
  try {
    await api.stopDatasource(id)
    ElMessage.success('停止成功')
    fetchDatasources()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '停止失败')
  }
}

const deleteDS = row => {
  ElMessageBox.confirm(`确定删除数据源"${row.name}"吗?`, '确认删除', {
    type: 'warning'
  }).then(async () => {
    try {
      await api.deleteDatasource(row.id)
      ElMessage.success('删除成功')
      fetchDatasources()
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '删除失败')
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchDatasources()
})
</script>

<style scoped>
.config-fields {
  width: 100%;
}

.config-fields :deep(.el-form-item) {
  margin-bottom: 12px;
}
</style>
