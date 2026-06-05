<template>
  <div class="task-edit-page">
    <div class="page-header">
      <el-button @click="$router.back()" :icon="ArrowLeft" text>返回</el-button>
      <h3>{{ isEdit ? '编辑任务' : '新建任务' }}</h3>
    </div>

    <el-card shadow="never" v-loading="loading">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px" style="max-width: 700px;">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入任务标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="请输入任务描述" maxlength="2000" show-word-limit />
        </el-form-item>
        <el-form-item label="紧急程度" prop="priority">
          <el-radio-group v-model="form.priority">
            <el-radio-button value="low">低</el-radio-button>
            <el-radio-button value="medium_low">中低</el-radio-button>
            <el-radio-button value="medium">中</el-radio-button>
            <el-radio-button value="high">高</el-radio-button>
            <el-radio-button value="urgent">紧急</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="截止时间" prop="due_date">
          <el-date-picker v-model="form.due_date" type="datetime" placeholder="选择截止时间" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="所属分类" prop="category_id">
          <el-select v-model="form.category_id" placeholder="选择分类" clearable style="width: 100%;">
            <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px;" :style="{ backgroundColor: cat.color }"></span>
              {{ cat.name }}
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="负责人" prop="assignee_id">
          <el-select v-model="form.assignee_id" placeholder="选择负责人" clearable style="width: 100%;">
            <el-option v-for="u in users" :key="u.id" :label="u.real_name || u.username" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">{{ isEdit ? '保存修改' : '创建任务' }}</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import api from '../api'

const route = useRoute()
const router = useRouter()
const taskId = computed(() => route.params.id)
const isEdit = computed(() => !!taskId.value)
const formRef = ref(null)
const loading = ref(false)
const submitting = ref(false)
const categories = ref([])
const users = ref([])

const form = reactive({
  title: '',
  description: '',
  priority: 'medium',
  due_date: null,
  category_id: null,
  assignee_id: null,
})

const rules = {
  title: [
    { required: true, message: '请输入任务标题', trigger: 'blur' },
    { max: 200, message: '标题不能超过200个字符', trigger: 'blur' },
  ],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }],
}

async function loadCategories() {
  const res = await api.get('/categories/')
  categories.value = res.data
}

async function loadUsers() {
  const res = await api.get('/users/')
  users.value = res.data
}

async function loadTask() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const res = await api.get(`/tasks/${taskId.value}`)
    const t = res.data
    form.title = t.title
    form.description = t.description
    form.priority = t.priority
    form.due_date = t.due_date ? new Date(t.due_date) : null
    form.category_id = t.category_id
    form.assignee_id = t.assignee_id
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const data = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      due_date: form.due_date ? form.due_date.toISOString() : null,
      category_id: form.category_id,
      assignee_id: form.assignee_id,
    }
    if (isEdit.value) {
      await api.put(`/tasks/${taskId.value}`, data)
      ElMessage.success('任务已更新')
    } else {
      const res = await api.post('/tasks/', data)
      ElMessage.success('任务已创建')
      router.replace(`/tasks/${res.data.id}`)
      return
    }
    router.back()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadCategories()
  loadUsers()
  loadTask()
})
</script>

<style scoped>
.task-edit-page {
  padding: 0;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.page-header h3 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}
</style>
