<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">处理监控</div>
      <div class="header-actions">
        <el-button
          v-if="!queueInfo.isPaused"
          type="warning"
          @click="handlePause"
        >
          <el-icon><VideoPause /></el-icon>
          暂停处理
        </el-button>
        <el-button
          v-else
          type="success"
          @click="handleResume"
        >
          <el-icon><VideoPlay /></el-icon>
          恢复处理
        </el-button>
        <el-button @click="refreshData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="card-grid">
      <div class="stat-card">
        <div class="label">总处理</div>
        <div class="value">{{ stats.total }}</div>
      </div>
      <div class="stat-card success">
        <div class="label">成功</div>
        <div class="value">{{ stats.success }}</div>
      </div>
      <div class="stat-card failed">
        <div class="label">失败</div>
        <div class="value">{{ stats.failed }}</div>
      </div>
      <div class="stat-card skipped">
        <div class="label">跳过(去重)</div>
        <div class="value">{{ stats.skipped }}</div>
      </div>
      <div class="stat-card processing">
        <div class="label">重试中</div>
        <div class="value">{{ stats.retrying }}</div>
      </div>
      <div class="stat-card">
        <div class="label">队列中</div>
        <div class="value">{{ queueInfo.queueSize }} / {{ queueInfo.maxQueueSize }}</div>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-header">
        <div>
          <span class="progress-filename">
            {{ queueInfo.currentFile || '等待文件...' }}
          </span>
        </div>
        <div class="progress-time">
          <template v-if="queueInfo.currentFile">
            已耗时: {{ formatDuration(queueInfo.currentElapsed) }}
          </template>
        </div>
      </div>
      <el-progress
        :percentage="queueInfo.currentProgress"
        :status="queueInfo.currentFile ? 'success' : ''"
        :stroke-width="12"
      />
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="never" class="mb-20">
          <template #header>
            <div class="card-header">
              <span>待处理队列</span>
              <el-tag size="small">{{ queueInfo.queuedFiles.length }} 个文件</el-tag>
            </div>
          </template>
          <div v-if="queueInfo.queuedFiles.length === 0" class="empty-state">
            <el-icon :size="48"><FolderOpened /></el-icon>
            <p>队列为空</p>
          </div>
          <el-table
            v-else
            :data="queueInfo.queuedFiles.slice(0, 10)"
            size="small"
            max-height="300"
          >
            <el-table-column prop="fileName" label="文件名" />
            <el-table-column prop="fileSize" label="大小" width="100">
              <template #default="{ row }">
                {{ formatSize(row.fileSize) }}
              </template>
            </el-table-column>
            <el-table-column prop="ruleName" label="匹配规则" />
            <el-table-column prop="retryCount" label="重试" width="60" />
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never" class="mb-20">
          <template #header>
            <div class="card-header">
              <span>重试队列</span>
              <el-tag size="small" type="warning">{{ queueInfo.retryItems?.length || 0 }} 个文件</el-tag>
            </div>
          </template>
          <div v-if="!queueInfo.retryItems?.length" class="empty-state">
            <el-icon :size="48"><Clock /></el-icon>
            <p>没有待重试的文件</p>
          </div>
          <el-table
            v-else
            :data="queueInfo.retryItems"
            size="small"
            max-height="300"
          >
            <el-table-column prop="file_name" label="文件名" />
            <el-table-column prop="retry_remaining" label="剩余重试" width="90" />
            <el-table-column prop="next_retry_at" label="下次重试" width="170">
              <template #default="{ row }">
                {{ formatTime(row.next_retry_at) }}
              </template>
            </el-table-column>
            <el-table-column prop="last_error" label="错误原因" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>最近处理记录</span>
        </div>
      </template>
      <div v-if="latestRecords.length === 0" class="empty-state">
        <el-icon :size="48"><Document /></el-icon>
        <p>暂无处理记录</p>
      </div>
      <el-table
        v-else
        :data="latestRecords.slice(0, 20)"
        size="small"
      >
        <el-table-column prop="file_name" label="文件名" />
        <el-table-column prop="file_size" label="大小" width="100">
          <template #default="{ row }">
            {{ formatSize(row.file_size) }}
          </template>
        </el-table-column>
        <el-table-column prop="result" label="结果" width="100">
          <template #default="{ row }">
            <span :class="['status-badge', row.result]">
              {{ resultText(row.result) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" show-overflow-tooltip />
        <el-table-column prop="rule_name" label="规则" width="120" />
        <el-table-column prop="duration_ms" label="耗时" width="80">
          <template #default="{ row }">
            {{ row.duration_ms }}ms
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import { useAppStore } from '../stores/app';
import { queueAPI, recordsAPI } from '../api';
import { ElMessage } from 'element-plus';

const appStore = useAppStore();

const queueInfo = computed(() => appStore.queueInfo);
const stats = computed(() => appStore.stats);
const latestRecords = computed(() => appStore.latestRecords);

async function handlePause() {
  await queueAPI.pause();
  ElMessage.success('已暂停处理');
}

async function handleResume() {
  await queueAPI.resume();
  ElMessage.success('已恢复处理');
}

async function refreshData() {
  await Promise.all([
    appStore.refreshQueue(),
    appStore.refreshStats(),
  ]);
  ElMessage.success('已刷新');
}

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  }
  return `${seconds}秒`;
}

function formatTime(time) {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
}

function resultText(result) {
  const map = {
    success: '成功',
    failed: '失败',
    skipped: '跳过',
    retrying: '重试中',
  };
  return map[result] || result;
}
</script>

<style scoped>
.mb-20 {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}
</style>
