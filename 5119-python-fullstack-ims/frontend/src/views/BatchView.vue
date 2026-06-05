<template>
  <div class="batch-view">
    <h2>批量处理</h2>

    <el-card>
      <el-form :model="batchForm" label-width="100px">
        <el-form-item label="选择图片">
          <el-select
            v-model="batchForm.image_ids"
            multiple
            filterable
            placeholder="选择要处理的图片"
            style="width: 100%"
          >
            <el-option
              v-for="img in allImages"
              :key="img.id"
              :label="`#${img.id} - ${img.original_name}`"
              :value="img.id"
            />
          </el-select>
          <div style="margin-top: 8px; color: #999; font-size: 12px">
            从图库页面勾选图片后点击"批量处理"可自动填充
          </div>
        </el-form-item>

        <el-form-item label="操作类型">
          <el-select v-model="batchForm.operation" @change="onOperationChange">
            <el-option label="调整尺寸" value="resize" />
            <el-option label="格式转换" value="convert_format" />
            <el-option label="添加水印" value="add_watermark" />
            <el-option label="提取 EXIF" value="extract_exif" />
            <el-option label="重新生成缩略图" value="regenerate_thumbnail" />
          </el-select>
        </el-form-item>

        <el-form-item label="参数" v-if="batchForm.operation === 'resize'">
          <el-input-number v-model="batchForm.params.width" :min="1" placeholder="宽度" />
          <span style="margin: 0 8px">×</span>
          <el-input-number v-model="batchForm.params.height" :min="1" placeholder="高度" />
          <el-checkbox v-model="batchForm.params.keep_aspect" style="margin-left: 16px">保持比例</el-checkbox>
        </el-form-item>

        <el-form-item label="目标格式" v-if="batchForm.operation === 'convert_format'">
          <el-select v-model="batchForm.params.target_format">
            <el-option label="JPEG" value="jpeg" />
            <el-option label="PNG" value="png" />
            <el-option label="WEBP" value="webp" />
            <el-option label="BMP" value="bmp" />
          </el-select>
          <el-slider v-model="batchForm.params.quality" :min="1" :max="100" style="width: 200px; margin-left: 16px" />
          <span style="margin-left: 8px">质量: {{ batchForm.params.quality }}%</span>
        </el-form-item>

        <el-form-item label="水印文本" v-if="batchForm.operation === 'add_watermark'">
          <el-input v-model="batchForm.params.text" placeholder="水印文本" style="width: 300px" />
        </el-form-item>
        <el-form-item label="水印位置" v-if="batchForm.operation === 'add_watermark'">
          <el-select v-model="batchForm.params.position">
            <el-option label="左上" value="top_left" />
            <el-option label="右上" value="top_right" />
            <el-option label="左下" value="bottom_left" />
            <el-option label="右下" value="bottom_right" />
            <el-option label="居中" value="center" />
          </el-select>
        </el-form-item>
        <el-form-item label="水印透明度" v-if="batchForm.operation === 'add_watermark'">
          <el-slider v-model="batchForm.params.opacity" :min="0" :max="255" style="width: 300px" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" :disabled="batchForm.image_ids.length === 0" @click="submitBatch">
            开始处理 ({{ batchForm.image_ids.length }} 张)
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="currentTask" style="margin-top: 20px">
      <h3>任务进度</h3>
      <el-descriptions :column="3" border size="small" style="margin: 12px 0">
        <el-descriptions-item label="任务ID">{{ currentTask.id }}</el-descriptions-item>
        <el-descriptions-item label="操作">{{ currentTask.task_type }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(currentTask.status)">{{ statusText(currentTask.status) }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <el-progress
        :percentage="taskProgress"
        :format="() => `${currentTask.completed}/${currentTask.total}`"
      />
    </el-card>

    <el-card style="margin-top: 20px">
      <h3>历史任务</h3>
      <el-table :data="tasks" stripe size="small" style="margin-top: 12px">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="task_type" label="操作" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="120">
          <template #default="{ row }">
            {{ row.completed }}/{{ row.total }}
          </template>
        </el-table-column>
        <el-table-column prop="failed" label="失败" width="60" />
        <el-table-column prop="created_at" label="创建时间" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { batchApi, imageApi } from '../api'

const route = useRoute()

const allImages = ref([])
const batchForm = ref({
  image_ids: [],
  operation: 'resize',
  params: { width: 800, height: 600, keep_aspect: true, target_format: 'jpeg', quality: 85, text: '© IMS', position: 'bottom_right', opacity: 128 },
})
const submitting = ref(false)
const currentTask = ref(null)
const tasks = ref([])
let pollTimer = null

const taskProgress = computed(() => {
  if (!currentTask.value || currentTask.value.total === 0) return 0
  return Math.round((currentTask.value.completed / currentTask.value.total) * 100)
})

const statusType = (s) => ({ running: 'warning', completed: 'success', failed: 'danger', pending: 'info' }[s] || 'info')
const statusText = (s) => ({ running: '进行中', completed: '已完成', failed: '失败', pending: '等待中' }[s] || s)

const onOperationChange = () => {
  batchForm.value.params = { width: 800, height: 600, keep_aspect: true, target_format: 'jpeg', quality: 85, text: '© IMS', position: 'bottom_right', opacity: 128 }
}

const loadImages = async () => {
  try {
    const { data } = await imageApi.list({ page: 1, page_size: 200 })
    allImages.value = data.items
  } catch (e) {
    console.error(e)
  }
}

const loadTasks = async () => {
  try {
    const { data } = await batchApi.taskList({ limit: 20 })
    tasks.value = data
  } catch (e) {
    console.error(e)
  }
}

const submitBatch = async () => {
  if (batchForm.value.image_ids.length === 0) {
    ElMessage.warning('请选择图片')
    return
  }
  submitting.value = true
  try {
    const { data } = await batchApi.process({
      image_ids: batchForm.value.image_ids,
      operation: batchForm.value.operation,
      params: batchForm.value.params,
    })
    currentTask.value = data
    startPolling(data.id)
    ElMessage.success('任务已创建')
  } catch (e) {
    ElMessage.error('创建任务失败: ' + e.message)
  } finally {
    submitting.value = false
  }
}

const startPolling = (taskId) => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    try {
      const { data } = await batchApi.taskDetail(taskId)
      currentTask.value = data
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(pollTimer)
        pollTimer = null
        loadTasks()
      }
    } catch (e) {
      console.error(e)
    }
  }, 1000)
}

onMounted(() => {
  loadImages()
  loadTasks()
  if (route.query.ids) {
    batchForm.value.image_ids = route.query.ids.split(',').map(Number)
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.batch-view {
  max-width: 900px;
}

h3 {
  margin: 0 0 8px;
}
</style>
