<template>
  <div class="task-detail-page" v-loading="loading">
    <div class="page-header">
      <el-button @click="$router.back()" :icon="ArrowLeft" text>返回</el-button>
      <div class="header-actions">
        <el-button v-if="canEdit" type="primary" @click="$router.push(`/tasks/${taskId}/edit`)">编辑</el-button>
        <el-button v-if="canClaim" type="success" @click="claimTask">认领任务</el-button>
        <el-button v-if="isCreator" type="danger" @click="deleteTask">删除</el-button>
      </div>
    </div>

    <div class="task-content" v-if="task">
      <el-row :gutter="20">
        <el-col :span="16">
          <el-card shadow="never">
            <h2 class="task-title">{{ task.title }}</h2>
            <div class="task-meta">
              <el-tag :type="statusType(task.status)" effect="plain">{{ statusLabel(task.status) }}</el-tag>
              <el-tag :type="priorityType(task.priority)" size="small">{{ priorityLabel(task.priority) }}</el-tag>
              <span v-if="task.category_name" class="category-badge" :style="{ backgroundColor: task.category_color + '22', color: task.category_color }">
                {{ task.category_name }}
              </span>
              <span v-if="task.has_no_assignee" style="color: #f56c6c; font-size: 13px; margin-left: 8px;">⚠ 无负责人</span>
            </div>

            <div class="task-section">
              <h4>描述</h4>
              <p class="task-description">{{ task.description || '暂无描述' }}</p>
            </div>

            <div class="task-section" v-if="task.status === 'in_progress' || task.status === 'pending_review' || task.status === 'done'">
              <h4>进度</h4>
              <el-progress :percentage="task.progress" :stroke-width="12" :color="progressColor(task.progress)" />
              <div v-if="task.status === 'in_progress'" style="margin-top: 8px;">
                <el-slider v-model="progressValue" :min="0" :max="100" :step="5" @change="updateProgress" />
              </div>
            </div>

            <div class="task-section">
              <h4>状态流转</h4>
              <div class="status-actions">
                <el-button
                  v-for="action in availableActions"
                  :key="action.status"
                  :type="action.type"
                  size="small"
                  @click="changeStatus(action.status)"
                >
                  {{ action.label }}
                </el-button>
                <span v-if="availableActions.length === 0" style="color: #909399; font-size: 13px;">
                  当前状态无可用流转操作
                </span>
              </div>
            </div>

            <div class="task-section">
              <h4>参与人</h4>
              <div class="participants-list">
                <el-tag
                  v-for="p in task.participants"
                  :key="p.user_id"
                  closable
                  :type="p.user_id === task.assignee_id ? 'primary' : 'info'"
                  @close="removeParticipant(p.user_id)"
                  style="margin: 2px 4px"
                >
                  {{ p.real_name || p.username }}
                  <span v-if="p.user_id === task.creator_id" style="font-size: 11px; color: #909399;">（创建人）</span>
                  <span v-if="p.user_id === task.assignee_id" style="font-size: 11px; color: #67c23a;">（负责人）</span>
                </el-tag>
                <el-button size="small" @click="showAddParticipant = true" :icon="Plus" circle style="margin-left: 8px;" />
              </div>
            </div>

            <div class="task-section">
              <h4>评论 ({{ comments.length }})</h4>
              <div class="comment-input">
                <el-input
                  v-model="newComment"
                  type="textarea"
                  :rows="2"
                  placeholder="输入评论内容..."
                />
                <el-button type="primary" size="small" style="margin-top: 8px;" @click="addComment">提交评论</el-button>
              </div>
              <div class="comments-list">
                <div v-for="c in comments" :key="c.id" class="comment-item">
                  <div class="comment-header">
                    <span class="comment-author">{{ c.author_name }}</span>
                    <span class="comment-time">{{ formatDateTime(c.created_at) }}</span>
                    <el-button v-if="canDeleteComment(c)" type="danger" text size="small" @click="deleteComment(c.id)">删除</el-button>
                  </div>
                  <p class="comment-content">{{ c.content }}</p>
                </div>
                <el-empty v-if="comments.length === 0" description="暂无评论" :image-size="60" />
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card shadow="never" class="info-card">
            <h4>任务信息</h4>
            <div class="info-item">
              <label>负责人</label>
              <span>{{ task.assignee_name || '无' }}</span>
            </div>
            <div class="info-item">
              <label>创建人</label>
              <span>{{ task.creator_name }}</span>
            </div>
            <div class="info-item">
              <label>优先级</label>
              <span>{{ priorityLabel(task.priority) }}</span>
            </div>
            <div class="info-item">
              <label>截止时间</label>
              <span :class="{ 'overdue-text': isOverdue(task) }">{{ formatDateTime(task.due_date) || '未设置' }}</span>
            </div>
            <div class="info-item">
              <label>创建时间</label>
              <span>{{ formatDateTime(task.created_at) }}</span>
            </div>
            <div class="info-item">
              <label>更新时间</label>
              <span>{{ formatDateTime(task.updated_at) }}</span>
            </div>
          </el-card>

          <el-card shadow="never" class="log-card" style="margin-top: 16px;">
            <h4>活动日志</h4>
            <el-timeline>
              <el-timeline-item
                v-for="log in activityLogs"
                :key="log.id"
                :timestamp="formatDateTime(log.created_at)"
                placement="top"
              >
                <div class="log-item">
                  <strong>{{ log.username }}</strong> {{ log.action_detail }}
                </div>
              </el-timeline-item>
            </el-timeline>
            <el-empty v-if="activityLogs.length === 0" description="暂无日志" :image-size="40" />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-dialog v-model="showAddParticipant" title="添加参与人" width="400px">
      <el-select v-model="selectedUserId" placeholder="选择用户" filterable style="width: 100%">
        <el-option
          v-for="u in availableParticipants"
          :key="u.id"
          :label="u.real_name || u.username"
          :value="u.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="showAddParticipant = false">取消</el-button>
        <el-button type="primary" @click="addParticipant">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
import api from '../api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const taskId = computed(() => route.params.id)

const task = ref(null)
const comments = ref([])
const activityLogs = ref([])
const users = ref([])
const loading = ref(true)
const newComment = ref('')
const progressValue = ref(0)
const showAddParticipant = ref(false)
const selectedUserId = ref('')

const isCreator = computed(() => task.value?.creator_id === userStore.user?.id)
const isAssignee = computed(() => task.value?.assignee_id === userStore.user?.id)
const canEdit = computed(() => isCreator.value || isAssignee.value)
const canClaim = computed(() => task.value?.has_no_assignee && !isAssignee.value)

const availableParticipants = computed(() => {
  if (!task.value || !users.value) return []
  const participantIds = task.value.participants.map(p => p.user_id)
  return users.value.filter(u => !participantIds.includes(u.id))
})

const availableActions = computed(() => {
  if (!task.value) return []
  const actions = []
  const s = task.value.status
  if (s === 'todo') {
    actions.push({ status: 'in_progress', label: '开始处理', type: 'primary' })
  } else if (s === 'in_progress') {
    actions.push({ status: 'pending_review', label: '提交审核', type: 'warning' })
  } else if (s === 'pending_review') {
    if (userStore.user?.id === task.value.creator_id) {
      actions.push({ status: 'done', label: '审核通过', type: 'success' })
    }
  }
  if (s !== 'closed') {
    actions.push({ status: 'closed', label: '关闭', type: 'info' })
  }
  return actions
})

function priorityLabel(p) { return { urgent: '紧急', high: '高', medium: '中', medium_low: '中低', low: '低' }[p] || p }
function priorityType(p) { return { urgent: 'danger', high: 'danger', medium: 'warning', medium_low: 'info', low: 'info' }[p] || '' }
function statusLabel(s) { return { todo: '待办', in_progress: '进行中', pending_review: '待审核', done: '已完成', closed: '已关闭' }[s] || s }
function statusType(s) { return { todo: 'info', in_progress: '', pending_review: 'warning', done: 'success', closed: 'info' }[s] || '' }
function progressColor(p) { return p >= 80 ? '#67c23a' : p >= 40 ? '#e6a23c' : '#409eff' }

function formatDateTime(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('zh-CN')
}

function isOverdue(t) {
  if (!t.due_date || t.status === 'done' || t.status === 'closed') return false
  return new Date(t.due_date) < new Date()
}

function canDeleteComment(c) {
  return c.user_id === userStore.user?.id || task.value?.creator_id === userStore.user?.id
}

async function loadTask() {
  loading.value = true
  try {
    const res = await api.get(`/tasks/${taskId.value}`)
    task.value = res.data
    progressValue.value = res.data.progress
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  const res = await api.get(`/tasks/${taskId.value}/comments`)
  comments.value = res.data
}

async function loadLogs() {
  const res = await api.get(`/tasks/${taskId.value}/logs`)
  activityLogs.value = res.data
}

async function loadUsers() {
  const res = await api.get('/users/')
  users.value = res.data
}

async function claimTask() {
  await api.post(`/tasks/${taskId.value}/claim`)
  ElMessage.success('认领成功')
  loadTask()
  loadLogs()
}

async function changeStatus(status) {
  if (status === 'closed') {
    await ElMessageBox.confirm('确认关闭此任务？关闭后不可恢复。', '确认操作', { type: 'warning' })
  }
  await api.post(`/tasks/${taskId.value}/status`, { status })
  ElMessage.success('状态已更新')
  loadTask()
  loadLogs()
}

async function updateProgress(val) {
  await api.post(`/tasks/${taskId.value}/progress`, { progress: val })
  loadTask()
  loadLogs()
}

async function addComment() {
  if (!newComment.value.trim()) {
    ElMessage.warning('请输入评论内容后再提交')
    return
  }
  await api.post(`/tasks/${taskId.value}/comments`, { content: newComment.value })
  newComment.value = ''
  loadComments()
}

async function deleteComment(commentId) {
  await ElMessageBox.confirm('确认删除此评论？', '确认')
  await api.delete(`/tasks/${taskId.value}/comments/${commentId}`)
  loadComments()
}

async function addParticipant() {
  if (!selectedUserId.value) {
    ElMessage.warning('请选择用户')
    return
  }
  await api.post(`/tasks/${taskId.value}/participants/${selectedUserId.value}`)
  showAddParticipant.value = false
  selectedUserId.value = ''
  ElMessage.success('已添加参与人')
  loadTask()
  loadLogs()
}

async function removeParticipant(userId) {
  await ElMessageBox.confirm('确认移除此参与人？', '确认')
  await api.delete(`/tasks/${taskId.value}/participants/${userId}`)
  ElMessage.success('已移除参与人')
  loadTask()
  loadLogs()
}

async function deleteTask() {
  await ElMessageBox.confirm('确认删除此任务？此操作不可恢复。', '确认删除', { type: 'error' })
  await api.delete(`/tasks/${taskId.value}`)
  ElMessage.success('任务已删除')
  router.push('/')
}

onMounted(() => {
  loadTask()
  loadComments()
  loadLogs()
  loadUsers()
})
</script>

<style scoped>
.task-detail-page {
  padding: 0;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.task-title {
  margin: 0 0 12px 0;
  font-size: 22px;
  color: #303133;
}
.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}
.category-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
}
.task-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}
.task-section h4 {
  margin: 0 0 12px 0;
  color: #303133;
  font-size: 15px;
}
.task-description {
  color: #606266;
  line-height: 1.7;
  white-space: pre-wrap;
}
.status-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.participants-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.comment-input {
  margin-bottom: 16px;
}
.comment-item {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.comment-author {
  font-weight: 500;
  color: #303133;
  font-size: 14px;
}
.comment-time {
  color: #909399;
  font-size: 12px;
}
.comment-content {
  margin: 4px 0 0 0;
  color: #606266;
  line-height: 1.6;
}
.info-card h4 {
  margin: 0 0 16px 0;
}
.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}
.info-item label {
  color: #909399;
}
.info-item span {
  color: #303133;
}
.log-card h4 {
  margin: 0 0 16px 0;
}
.log-item {
  font-size: 13px;
  color: #606266;
}
.log-item strong {
  color: #303133;
}
.overdue-text {
  color: #f56c6c;
  font-weight: bold;
}
</style>
