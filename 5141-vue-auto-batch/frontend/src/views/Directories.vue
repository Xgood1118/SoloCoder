<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">目录管理</div>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>
        添加目录
      </el-button>
    </div>

    <el-alert
      v-if="errorDirectories.length > 0"
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 20px"
    >
      <template #title>
        有 {{ errorDirectories.length }} 个目录存在问题，请检查路径或权限
      </template>
    </el-alert>

    <el-card shadow="never">
      <el-table :data="directories" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="path" label="目录路径" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <span :class="['status-badge', row.status]">
              {{ row.status === 'active' ? '正常' : '异常' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="error" label="错误信息" show-overflow-tooltip />
        <el-table-column prop="created_at" label="添加时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              @click="handleScan(row)"
            >
              扫描现有文件
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
      <div v-if="directories.length === 0" class="empty-state">
        <el-icon :size="48"><Folder /></el-icon>
        <p>暂无监控目录</p>
      </div>
    </el-card>

    <el-dialog v-model="showAddDialog" title="添加监控目录" width="500px">
      <el-form :model="addForm" label-width="100px">
        <el-form-item label="目录路径">
          <el-input
            v-model="addForm.path"
            placeholder="请输入目录绝对路径"
          />
        </el-form-item>
        <el-alert
          type="info"
          show-icon
          :closable="false"
          style="margin-bottom: 0"
        >
          系统将实时监听该目录下的文件变化（创建、修改、重命名）。
          请确保目录存在且具有读取权限。
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAdd">
          确认添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { useAppStore } from '../stores/app';
import { directoriesAPI } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';

const appStore = useAppStore();

const directories = computed(() => appStore.directories);
const errorDirectories = computed(() => appStore.errorDirectories);

const loading = ref(false);
const adding = ref(false);
const showAddDialog = ref(false);
const addForm = reactive({
  path: '',
});

async function handleAdd() {
  if (!addForm.path.trim()) {
    ElMessage.warning('请输入目录路径');
    return;
  }
  adding.value = true;
  try {
    const res = await directoriesAPI.add(addForm.path.trim());
    if (res.success) {
      ElMessage.success('添加成功');
      showAddDialog.value = false;
      addForm.path = '';
      await appStore.refreshDirectories();
    } else {
      ElMessage.error(res.error || '添加失败');
    }
  } catch (err) {
    ElMessage.error('添加失败');
  } finally {
    adding.value = false;
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除监控目录 "${row.path}" 吗？`,
      '确认删除',
      { type: 'warning' }
    );
    const res = await directoriesAPI.remove(row.id);
    if (res.success) {
      ElMessage.success('删除成功');
      await appStore.refreshDirectories();
    } else {
      ElMessage.error(res.error || '删除失败');
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
}

async function handleScan(row) {
  try {
    const res = await directoriesAPI.scan(row.id);
    if (res.success) {
      ElMessage.success('已开始扫描现有文件');
    } else {
      ElMessage.error(res.error || '扫描失败');
    }
  } catch (err) {
    ElMessage.error('扫描失败');
  }
}

function formatTime(time) {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
}
</script>
