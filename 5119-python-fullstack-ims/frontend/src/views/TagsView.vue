<template>
  <div class="tags-view">
    <h2>标签管理</h2>

    <div class="tags-layout">
      <div class="tags-tree-panel">
        <div class="panel-header">
          <span>标签树</span>
          <el-button type="primary" size="small" @click="showCreateDialog = true">新建标签</el-button>
        </div>
        <el-tree
          :data="tagTree"
          :props="{ children: 'children', label: 'name' }"
          node-key="id"
          default-expand-all
          highlight-current
          @node-click="handleNodeClick"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <span>{{ data.name }}</span>
              <span class="tree-node-count">({{ data.image_count || 0 }})</span>
              <span class="tree-node-actions">
                <el-button size="small" link @click.stop="editTag(data)"><el-icon><Edit /></el-icon></el-button>
                <el-button size="small" link type="danger" @click.stop="deleteTag(data)"><el-icon><Delete /></el-icon></el-button>
              </span>
            </span>
          </template>
        </el-tree>
      </div>

      <div class="tags-detail-panel">
        <div v-if="currentTag">
          <h3>{{ currentTag.full_path }}</h3>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="ID">{{ currentTag.id }}</el-descriptions-item>
            <el-descriptions-item label="名称">{{ currentTag.name }}</el-descriptions-item>
            <el-descriptions-item label="层级">{{ currentTag.level }}</el-descriptions-item>
            <el-descriptions-item label="图片数">{{ currentTag.image_count }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ currentTag.created_at }}</el-descriptions-item>
          </el-descriptions>
        </div>
        <el-empty v-else description="选择一个标签查看详情" />
      </div>
    </div>

    <el-dialog v-model="showCreateDialog" :title="editingTag ? '编辑标签' : '新建标签'" width="450px">
      <el-form :model="tagForm" label-width="80px">
        <el-form-item label="标签名">
          <el-input v-model="tagForm.name" placeholder="输入标签名" />
        </el-form-item>
        <el-form-item label="父标签">
          <el-tree-select
            v-model="tagForm.parent_id"
            :data="tagTreeForSelect"
            :props="{ children: 'children', label: 'name', value: 'id' }"
            clearable
            check-strictly
            placeholder="选择父标签（可选）"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelEdit">取消</el-button>
        <el-button type="primary" @click="saveTag">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { tagApi } from '../api'

const tagTree = ref([])
const currentTag = ref(null)
const showCreateDialog = ref(false)
const editingTag = ref(null)
const tagForm = ref({ name: '', parent_id: null })

const tagTreeForSelect = computed(() => tagTree.value)

const loadTags = async () => {
  try {
    const { data } = await tagApi.tree()
    tagTree.value = data
  } catch (e) {
    ElMessage.error('加载标签失败: ' + e.message)
  }
}

const handleNodeClick = (data) => {
  currentTag.value = data
}

const editTag = (data) => {
  editingTag.value = data
  tagForm.value = { name: data.name, parent_id: data.parent_id }
  showCreateDialog.value = true
}

const deleteTag = async (data) => {
  try {
    await ElMessageBox.confirm(`确定删除标签 "${data.name}"？`, '确认删除', { type: 'warning' })
    await tagApi.delete(data.id)
    ElMessage.success('删除成功')
    if (currentTag.value?.id === data.id) currentTag.value = null
    loadTags()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败: ' + e.message)
  }
}

const saveTag = async () => {
  if (!tagForm.value.name.trim()) {
    ElMessage.warning('请输入标签名')
    return
  }
  try {
    if (editingTag.value) {
      await tagApi.update(editingTag.value.id, tagForm.value)
      ElMessage.success('更新成功')
    } else {
      await tagApi.create(tagForm.value)
      ElMessage.success('创建成功')
    }
    showCreateDialog.value = false
    editingTag.value = null
    tagForm.value = { name: '', parent_id: null }
    loadTags()
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  }
}

const cancelEdit = () => {
  showCreateDialog.value = false
  editingTag.value = null
  tagForm.value = { name: '', parent_id: null }
}

onMounted(loadTags)
</script>

<style scoped>
.tags-layout {
  display: flex;
  gap: 24px;
  margin-top: 20px;
}

.tags-tree-panel {
  flex: 0 0 400px;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
}

.tags-detail-panel {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.tree-node-count {
  color: #999;
  font-size: 12px;
}

.tree-node-actions {
  margin-left: auto;
  display: none;
}

.tree-node:hover .tree-node-actions {
  display: inline-flex;
}
</style>
