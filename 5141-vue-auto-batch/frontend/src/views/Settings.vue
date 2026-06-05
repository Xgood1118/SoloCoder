<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">系统设置</div>
      <el-button type="primary" @click="handleSave" :loading="saving">
        <el-icon><Check /></el-icon>
        保存设置
      </el-button>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="never" style="margin-bottom: 20px">
          <template #header>
            <span>处理设置</span>
          </template>
          <el-form :model="settingsForm" label-width="150px">
            <el-form-item label="目标输出目录">
              <el-input
                v-model="settingsForm.target_directory"
                placeholder="处理后的文件输出目录，留空则不输出"
              />
              <div style="font-size: 12px; color: #909399; margin-top: 4px">
                配置后处理成功的文件将写入此目录
              </div>
            </el-form-item>
            <el-form-item label="最大重试次数">
              <el-input-number
                v-model="settingsForm.max_retries"
                :min="0"
                :max="10"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="重试间隔(秒)">
              <el-input-number
                v-model="settingsForm.retry_interval"
                :min="1"
                :max="3600"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="队列最大容量">
              <el-input-number
                v-model="settingsForm.queue_max_size"
                :min="10"
                :max="10000"
                style="width: 100%"
              />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" style="margin-bottom: 20px">
          <template #header>
            <span>数据保留设置</span>
          </template>
          <el-form :model="settingsForm" label-width="150px">
            <el-form-item label="记录保留天数">
              <el-input-number
                v-model="settingsForm.retention_days"
                :min="1"
                :max="365"
                style="width: 100%"
              />
              <div style="font-size: 12px; color: #909399; margin-top: 4px">
                超过此天数的处理记录将被自动清理
              </div>
            </el-form-item>
            <el-form-item label="去重记录保留天数">
              <el-input-number
                v-model="settingsForm.dedup_retention_days"
                :min="1"
                :max="365"
                style="width: 100%"
              />
              <div style="font-size: 12px; color: #909399; margin-top: 4px">
                超过此天数的去重记录将被自动清理
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never" style="margin-bottom: 20px">
          <template #header>
            <span>处理步骤</span>
          </template>
          <el-alert
            type="info"
            show-icon
            :closable="false"
            style="margin-bottom: 20px"
          >
            配置文件处理过程中的过滤和转换步骤，按顺序执行。
          </el-alert>
          <div
            v-for="(step, index) in processingSteps"
            :key="index"
            class="step-item"
          >
            <el-card shadow="never" class="step-card">
              <div class="step-header">
                <span class="step-index">步骤 {{ index + 1 }}</span>
                <el-button
                  type="danger"
                  size="small"
                  link
                  @click="removeStep(index)"
                >
                  删除
                </el-button>
              </div>
              <el-form :model="step" label-width="100px">
                <el-form-item label="步骤类型">
                  <el-select v-model="step.type" style="width: 100%">
                    <el-option label="正则替换" value="regex" />
                    <el-option label="内容过滤(grep)" value="grep" />
                    <el-option label="去除空白" value="trim" />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="step.type === 'regex' || step.type === 'grep'" label="匹配模式">
                  <el-input v-model="step.pattern" placeholder="输入匹配模式" />
                </el-form-item>
                <el-form-item v-if="step.type === 'regex'" label="替换为">
                  <el-input v-model="step.replacement" placeholder="输入替换内容" />
                </el-form-item>
                <el-form-item v-if="step.type === 'regex'" label="标志">
                  <el-input v-model="step.flags" placeholder="如: g, gi" />
                </el-form-item>
              </el-form>
            </el-card>
          </div>
          <el-button type="primary" plain style="width: 100%" @click="addStep">
            <el-icon><Plus /></el-icon>
            添加处理步骤
          </el-button>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span>去重记录</span>
          </template>
          <el-table :data="dedupItems" size="small" max-height="300" v-loading="dedupLoading">
            <el-table-column prop="md5" label="MD5哈希" width="200" show-overflow-tooltip />
            <el-table-column prop="file_path" label="文件路径" show-overflow-tooltip />
            <el-table-column prop="created_at" label="创建时间" width="170">
              <template #default="{ row }">
                {{ formatTime(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
          <div class="dedup-pagination">
            <el-pagination
              v-model:current-page="dedupPage"
              :page-size="dedupPageSize"
              :total="dedupTotal"
              layout="prev, pager, next"
              small
              @current-change="loadDedup"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { settingsAPI, dedupAPI } from '../api';
import { ElMessage } from 'element-plus';

const saving = ref(false);
const dedupLoading = ref(false);
const dedupPage = ref(1);
const dedupPageSize = ref(10);
const dedupTotal = ref(0);
const dedupItems = ref([]);

const settingsForm = reactive({
  max_retries: 3,
  retry_interval: 30,
  target_directory: '',
  queue_max_size: 100,
  retention_days: 30,
  dedup_retention_days: 30,
});

const processingSteps = ref([]);

function addStep() {
  processingSteps.value.push({
    type: 'regex',
    pattern: '',
    replacement: '',
    flags: 'g',
  });
}

function removeStep(index) {
  processingSteps.value.splice(index, 1);
}

async function loadSettings() {
  try {
    const res = await settingsAPI.get();
    if (res.success) {
      Object.assign(settingsForm, {
        max_retries: parseInt(res.data.max_retries, 10),
        retry_interval: parseInt(res.data.retry_interval, 10),
        target_directory: res.data.target_directory || '',
        queue_max_size: parseInt(res.data.queue_max_size, 10),
        retention_days: parseInt(res.data.retention_days, 10),
        dedup_retention_days: parseInt(res.data.dedup_retention_days, 10),
      });
      try {
        const steps = JSON.parse(res.data.processing_steps || '[]');
        processingSteps.value = steps.length > 0 ? steps : [];
      } catch (e) {
        processingSteps.value = [];
      }
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function loadDedup() {
  dedupLoading.value = true;
  try {
    const res = await dedupAPI.list({
      page: dedupPage.value,
      pageSize: dedupPageSize.value,
    });
    if (res.success) {
      dedupItems.value = res.data.items;
      dedupTotal.value = res.data.total;
    }
  } catch (err) {
    console.error('Failed to load dedup:', err);
  } finally {
    dedupLoading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const data = {
      ...settingsForm,
      processing_steps: JSON.stringify(processingSteps.value),
    };
    const res = await settingsAPI.update(data);
    if (res.success) {
      ElMessage.success('设置已保存');
    } else {
      ElMessage.error(res.error || '保存失败');
    }
  } catch (err) {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

function formatTime(time) {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
}

onMounted(() => {
  loadSettings();
  loadDedup();
});
</script>

<style scoped>
.step-item {
  margin-bottom: 16px;
}

.step-card {
  border: 1px dashed #dcdfe6;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.step-index {
  font-weight: 600;
  color: #409eff;
}

.dedup-pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
