<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">匹配规则</div>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>
        添加规则
      </el-button>
    </div>

    <el-card shadow="never" style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>规则匹配关系</span>
          <el-radio-group v-model="relation" @change="handleRelationChange">
            <el-radio-button value="any">任一满足</el-radio-button>
            <el-radio-button value="all">全部满足</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <el-alert
        type="info"
        show-icon
        :closable="false"
      >
        <template #title>
          <template v-if="relation === 'any'">
            只要文件匹配任意一条启用的规则，就会被加入处理队列。
          </template>
          <template v-else>
            文件必须匹配所有启用的规则，才会被加入处理队列。
          </template>
        </template>
      </el-alert>
    </el-card>

    <el-card shadow="never">
      <el-table :data="rules" v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="规则名称" width="150" />
        <el-table-column prop="file_pattern" label="文件名模式" width="150">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.file_pattern }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="文件大小范围" width="160">
          <template #default="{ row }">
            {{ formatSize(row.min_size) }} - {{ formatSize(row.max_size) }}
          </template>
        </el-table-column>
        <el-table-column label="修改时间范围" width="160">
          <template #default="{ row }">
            {{ row.start_time || '不限' }} - {{ row.end_time || '不限' }}
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled === 1"
              @change="(val) => handleToggleEnabled(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              type="danger"
              link
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="rules.length === 0" class="empty-state">
        <el-icon :size="48"><Filter /></el-icon>
        <p>暂无匹配规则</p>
        <p style="font-size: 13px">未配置规则时，所有文件都会被处理</p>
      </div>
    </el-card>

    <el-dialog
      v-model="showAddDialog"
      :title="editingRule ? '编辑规则' : '添加规则'"
      width="600px"
    >
      <el-form :model="ruleForm" label-width="120px">
        <el-form-item label="规则名称" required>
          <el-input
            v-model="ruleForm.name"
            placeholder="请输入规则名称"
          />
        </el-form-item>
        <el-form-item label="文件名模式" required>
          <el-input
            v-model="ruleForm.file_pattern"
            placeholder="如: *.log, app_*.txt"
          />
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            支持 Glob 通配符: * 匹配任意字符, ? 匹配单个字符
          </div>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最小字节">
              <el-input-number
                v-model="ruleForm.min_size"
                :min="0"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大字节">
              <el-input-number
                v-model="ruleForm.max_size"
                :min="0"
                :placeholder="不限"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-time-picker
                v-model="ruleForm.start_time"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="不限"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-time-picker
                v-model="ruleForm.end_time"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="不限"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { useAppStore } from '../stores/app';
import { rulesAPI } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';

const appStore = useAppStore();

const rules = computed(() => appStore.rules);
const relation = computed({
  get: () => appStore.ruleRelation,
  set: (val) => { appStore.ruleRelation = val; },
});

const loading = ref(false);
const saving = ref(false);
const showAddDialog = ref(false);
const editingRule = ref(null);
const ruleForm = reactive({
  name: '',
  file_pattern: '',
  min_size: 0,
  max_size: null,
  start_time: null,
  end_time: null,
});

async function handleRelationChange(val) {
  try {
    await rulesAPI.setRelation(val);
    ElMessage.success('已更新匹配关系');
  } catch (err) {
    ElMessage.error('更新失败');
    await appStore.refreshRules();
  }
}

function handleEdit(row) {
  editingRule.value = row;
  ruleForm.name = row.name;
  ruleForm.file_pattern = row.file_pattern;
  ruleForm.min_size = row.min_size;
  ruleForm.max_size = row.max_size;
  ruleForm.start_time = row.start_time;
  ruleForm.end_time = row.end_time;
  showAddDialog.value = true;
}

async function handleToggleEnabled(row, val) {
  try {
    await rulesAPI.update(row.id, { enabled: val ? 1 : 0 });
    ElMessage.success(val ? '已启用' : '已禁用');
    await appStore.refreshRules();
  } catch (err) {
    ElMessage.error('操作失败');
    await appStore.refreshRules();
  }
}

async function handleSave() {
  if (!ruleForm.name.trim()) {
    ElMessage.warning('请输入规则名称');
    return;
  }
  if (!ruleForm.file_pattern.trim()) {
    ElMessage.warning('请输入文件名模式');
    return;
  }

  saving.value = true;
  try {
    if (editingRule.value) {
      const res = await rulesAPI.update(editingRule.value.id, ruleForm);
      if (res.success) {
        ElMessage.success('更新成功');
      } else {
        ElMessage.error(res.error || '更新失败');
      }
    } else {
      const res = await rulesAPI.add(ruleForm);
      if (res.success) {
        ElMessage.success('添加成功');
      } else {
        ElMessage.error(res.error || '添加失败');
      }
    }
    showAddDialog.value = false;
    resetForm();
    await appStore.refreshRules();
  } catch (err) {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除规则 "${row.name}" 吗？`,
      '确认删除',
      { type: 'warning' }
    );
    const res = await rulesAPI.remove(row.id);
    if (res.success) {
      ElMessage.success('删除成功');
      await appStore.refreshRules();
    } else {
      ElMessage.error(res.error || '删除失败');
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
}

function resetForm() {
  editingRule.value = null;
  ruleForm.name = '';
  ruleForm.file_pattern = '';
  ruleForm.min_size = 0;
  ruleForm.max_size = null;
  ruleForm.start_time = null;
  ruleForm.end_time = null;
}

function formatSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === 0) return '不限';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(time) {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
