<template>
  <div class="categories-page">
    <div class="page-header">
      <h3>分类管理</h3>
      <el-button type="primary" @click="showAddDialog">新建分类</el-button>
    </div>

    <el-card shadow="never">
      <el-table :data="categories" stripe style="width: 100%">
        <el-table-column label="颜色" width="80" align="center">
          <template #default="{ row }">
            <span class="color-dot" :style="{ backgroundColor: row.color }"></span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="sort_weight" label="排序权重" width="120" align="center" />
        <el-table-column prop="created_at" label="创建时间" width="180" align="center">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="editCategory(row)">编辑</el-button>
            <el-button text type="danger" size="small" @click="deleteCategory(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分类' : '新建分类'" width="440px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="颜色" prop="color">
          <el-color-picker v-model="form.color" show-alpha :predefine="predefineColors" />
        </el-form-item>
        <el-form-item label="排序权重" prop="sort_weight">
          <el-input-number v-model="form.sort_weight" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

const categories = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const form = reactive({ name: '', color: '#409EFF', sort_weight: 0 })
const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  color: [{ required: true, message: '请选择颜色', trigger: 'change' }],
}

const predefineColors = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
  '#00BCD4', '#9C27B0', '#FF9800', '#795548', '#607D8B',
]

function formatDateTime(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('zh-CN')
}

async function loadCategories() {
  const res = await api.get('/categories/')
  categories.value = res.data
}

function showAddDialog() {
  editingId.value = null
  form.name = ''
  form.color = '#409EFF'
  form.sort_weight = 0
  dialogVisible.value = true
}

function editCategory(row) {
  editingId.value = row.id
  form.name = row.name
  form.color = row.color
  form.sort_weight = row.sort_weight
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  const data = { name: form.name, color: form.color, sort_weight: form.sort_weight }
  if (editingId.value) {
    await api.put(`/categories/${editingId.value}`, data)
    ElMessage.success('分类已更新')
  } else {
    await api.post('/categories/', data)
    ElMessage.success('分类已创建')
  }
  dialogVisible.value = false
  loadCategories()
}

async function deleteCategory(row) {
  await ElMessageBox.confirm(`确认删除分类"${row.name}"？`, '确认删除', { type: 'warning' })
  await api.delete(`/categories/${row.id}`)
  ElMessage.success('分类已删除')
  loadCategories()
}

onMounted(() => {
  loadCategories()
})
</script>

<style scoped>
.categories-page {
  padding: 0;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}
.color-dot {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #ebeef5;
}
</style>
