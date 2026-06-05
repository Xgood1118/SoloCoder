<template>
  <div class="pipelines">
    <div class="page-header">
      <h2 class="page-title">管道配置</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        新增管道
      </el-button>
    </div>

    <div class="card">
      <el-table :data="pipelines" v-loading="loading">
        <el-table-column prop="id" label="ID" width="120" />
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="datasource_id" label="数据源ID" width="150" />
        <el-table-column label="处理器链" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="processor-chain">
              <el-tag v-for="(p, idx) in row.processors" :key="idx" size="small" style="margin-right: 4px">
                {{ p.type }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-tag" :class="'status-' + row.status">
              {{ row.status }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="input_count" label="输入" width="80" />
        <el-table-column prop="output_count" label="输出" width="80" />
        <el-table-column prop="error_count" label="错误" width="80" />
        <el-table-column label="平均延迟(ms)" width="120">
          <template #default="{ row }">
            {{ row.avg_latency_ms?.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'running'" type="success" size="small" @click="startPipe(row.id)">
              启动
            </el-button>
            <el-button v-else type="warning" size="small" @click="stopPipe(row.id)">
              停止
            </el-button>
            <el-button type="primary" size="small" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="deletePipe(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑管道' : '新增管道'" width="700px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入管道名称" />
        </el-form-item>
        <el-form-item label="数据源" prop="datasource_id">
          <el-select v-model="form.datasource_id" placeholder="请选择数据源" style="width: 100%">
            <el-option v-for="ds in datasourceOptions" :key="ds.id" :label="ds.name" :value="ds.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="处理器链">
          <div class="processors-editor">
            <div v-for="(p, idx) in form.processors" :key="idx" class="processor-item">
              <el-select v-model="p.type" placeholder="处理器类型" style="width: 180px; margin-right: 8px">
                <el-option label="JSON解析" value="json_parser" />
                <el-option label="正则解析" value="regex_parser" />
                <el-option label="过滤" value="filter" />
                <el-option label="转换" value="transform" />
                <el-option label="增强" value="enhancer" />
              </el-select>
              <el-input
                v-if="p.type === 'json_parser'"
                v-model="p.config.field_mapping"
                placeholder="字段映射JSON"
                style="flex: 1; margin-right: 8px"
              />
              <el-input
                v-if="p.type === 'regex_parser'"
                v-model="p.config.pattern"
                placeholder="正则表达式"
                style="flex: 1; margin-right: 8px"
              />
              <el-input
                v-if="p.type === 'filter'"
                v-model="p.config.condition"
                placeholder="过滤条件: level == 'error'"
                style="flex: 1; margin-right: 8px"
              />
              <el-input
                v-if="p.type === 'transform'"
                v-model="p.config.script"
                placeholder="转换脚本"
                style="flex: 1; margin-right: 8px"
              />
              <el-input
                v-if="p.type === 'enhancer'"
                v-model="p.config.fields"
                placeholder="增强字段JSON"
                style="flex: 1; margin-right: 8px"
              />
              <el-button type="danger" size="small" @click="removeProcessor(idx)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button type="primary" plain size="small" @click="addProcessor" style="margin-top: 8px">
              <el-icon><Plus /></el-icon>
              添加处理器
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="池大小">
          <el-input-number v-model="form.pool_size" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="缓冲区大小">
          <el-input-number v-model="form.buffer_size" :min="100" :max="100000" />
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

const loading = ref(false)
const pipelines = ref([])
const datasourceOptions = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const form = reactive({
  id: '',
  name: '',
  datasource_id: '',
  description: '',
  processors: [],
  pool_size: 10,
  buffer_size: 1000
})

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  datasource_id: [{ required: true, message: '请选择数据源', trigger: 'change' }]
}

const fetchPipelines = async () => {
  loading.value = true
  try {
    const res = await api.getPipelines()
    pipelines.value = res.data
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

const openCreateDialog = () => {
  isEdit.value = false
  Object.assign(form, {
    id: '',
    name: '',
    datasource_id: '',
    description: '',
    processors: [],
    pool_size: 10,
    buffer_size: 1000
  })
  dialogVisible.value = true
}

const openEditDialog = row => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    name: row.name,
    datasource_id: row.datasource_id,
    description: row.description,
    processors: JSON.parse(JSON.stringify(row.processors || [])),
    pool_size: row.pool_size || 10,
    buffer_size: row.buffer_size || 1000
  })
  dialogVisible.value = true
}

const addProcessor = () => {
  form.processors.push({
    type: '',
    config: {}
  })
}

const removeProcessor = idx => {
  form.processors.splice(idx, 1)
}

const save = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async valid => {
    if (!valid) return
    try {
      if (isEdit.value) {
        await api.updatePipeline(form.id, form)
        ElMessage.success('更新成功')
      } else {
        await api.createPipeline(form)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      fetchPipelines()
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '操作失败')
    }
  })
}

const startPipe = async id => {
  try {
    await api.startPipeline(id)
    ElMessage.success('启动成功')
    fetchPipelines()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '启动失败')
  }
}

const stopPipe = async id => {
  try {
    await api.stopPipeline(id)
    ElMessage.success('停止成功')
    fetchPipelines()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '停止失败')
  }
}

const deletePipe = row => {
  ElMessageBox.confirm(`确定删除管道"${row.name}"吗?`, '确认删除', {
    type: 'warning'
  }).then(async () => {
    try {
      await api.deletePipeline(row.id)
      ElMessage.success('删除成功')
      fetchPipelines()
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '删除失败')
    }
  }).catch(() => {})
}

onMounted(() => {
  fetchPipelines()
  fetchDatasources()
})
</script>

<style scoped>
.processor-chain {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.processor-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.processors-editor {
  width: 100%;
}
</style>
