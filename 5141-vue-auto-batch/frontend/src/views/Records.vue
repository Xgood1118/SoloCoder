<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">处理记录</div>
    </div>

    <el-card shadow="never" style="margin-bottom: 20px">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="开始日期">
          <el-date-picker
            v-model="filterForm.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker
            v-model="filterForm.endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="文件名">
          <el-input
            v-model="filterForm.fileName"
            placeholder="输入文件名关键字"
            clearable
          />
        </el-form-item>
        <el-form-item label="处理结果">
          <el-select
            v-model="filterForm.result"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
            <el-option label="跳过" value="skipped" />
            <el-option label="重试中" value="retrying" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="records" v-loading="loading" max-height="600">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="file_name" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="file_path" label="文件路径" min-width="250" show-overflow-tooltip />
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
        <el-table-column prop="reason" label="原因/备注" min-width="150" show-overflow-tooltip />
        <el-table-column prop="rule_name" label="匹配规则" width="120" />
        <el-table-column prop="retry_count" label="重试次数" width="90" />
        <el-table-column prop="duration_ms" label="耗时" width="80">
          <template #default="{ row }">
            {{ row.duration_ms }}ms
          </template>
        </el-table-column>
        <el-table-column prop="md5" label="MD5" width="200" show-overflow-tooltip />
        <el-table-column prop="created_at" label="处理时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
      <div v-if="records.length === 0 && !loading" class="empty-state">
        <el-icon :size="48"><Document /></el-icon>
        <p>暂无处理记录</p>
      </div>
      <div v-if="records.length >= 1000" style="text-align: center; padding: 10px; color: #909399">
        最多显示最近 1000 条记录
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { recordsAPI } from '../api';

const loading = ref(false);
const records = ref([]);
const filterForm = reactive({
  startDate: '',
  endDate: '',
  fileName: '',
  result: '',
});

async function handleSearch() {
  loading.value = true;
  try {
    const params = {};
    if (filterForm.startDate) params.startDate = filterForm.startDate;
    if (filterForm.endDate) params.endDate = filterForm.endDate;
    if (filterForm.fileName) params.fileName = filterForm.fileName;
    if (filterForm.result) params.result = filterForm.result;

    const res = await recordsAPI.list(params);
    if (res.success) {
      records.value = res.data;
    }
  } catch (err) {
    console.error('Failed to fetch records:', err);
  } finally {
    loading.value = false;
  }
}

function handleReset() {
  filterForm.startDate = '';
  filterForm.endDate = '';
  filterForm.fileName = '';
  filterForm.result = '';
  handleSearch();
}

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

onMounted(() => {
  handleSearch();
});
</script>

<style scoped>
.filter-form {
  margin-bottom: 0;
}
</style>
