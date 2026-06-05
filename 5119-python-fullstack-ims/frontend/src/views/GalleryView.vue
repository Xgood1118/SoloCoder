<template>
  <div class="gallery-view">
    <div class="gallery-header">
      <h2>图片库</h2>
      <div class="gallery-actions">
        <el-input
          v-model="searchText"
          placeholder="搜索文件名..."
          clearable
          style="width: 250px"
          @keyup.enter="loadImages"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="selectedTagId" placeholder="按标签筛选" clearable style="width: 200px" @change="loadImages">
          <el-option v-for="tag in flatTags" :key="tag.id" :label="tag.full_path" :value="tag.id" />
        </el-select>
        <el-button type="primary" @click="loadImages">刷新</el-button>
      </div>
    </div>

    <div class="gallery-toolbar" v-if="selectedImages.length > 0">
      <el-tag type="info">已选 {{ selectedImages.length }} 张</el-tag>
      <el-button size="small" @click="showBatchTagDialog = true">批量打标签</el-button>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" @click="$router.push({ path: '/batch', query: { ids: selectedImages.join(',') } })">
        批量处理
      </el-button>
      <el-button size="small" @click="selectedImages = []">取消选择</el-button>
    </div>

    <div class="gallery-grid" v-loading="loading">
      <div
        v-for="img in images"
        :key="img.id"
        class="image-card"
        :class="{ selected: selectedImages.includes(img.id) }"
        @click.exact="toggleSelect(img.id)"
        @click.ctrl="toggleSelect(img.id)"
      >
        <div class="image-thumb">
          <el-image
            :src="thumbnailUrl(img.id)"
            fit="cover"
            lazy
            @click.stop="$router.push(`/image/${img.id}`)"
          >
            <template #error>
              <div class="image-placeholder">
                <el-icon :size="40"><Picture /></el-icon>
              </div>
            </template>
          </el-image>
        </div>
        <div class="image-info">
          <div class="image-name" :title="img.original_name">{{ img.original_name }}</div>
          <div class="image-meta">{{ img.width }}x{{ img.height }} · {{ formatSize(img.file_size) }}</div>
          <div class="image-tags">
            <el-tag v-for="tag in img.tags" :key="tag.id" size="small" type="info" class="mini-tag">
              {{ tag.name }}
            </el-tag>
          </div>
        </div>
        <div class="image-check" v-if="selectedImages.includes(img.id)">
          <el-icon color="#1890ff"><CircleCheckFilled /></el-icon>
        </div>
      </div>
    </div>

    <div class="gallery-empty" v-if="!loading && images.length === 0">
      <el-empty description="暂无图片，点击上传开始使用">
        <el-button type="primary" @click="$router.push('/upload')">上传图片</el-button>
      </el-empty>
    </div>

    <div class="gallery-pagination" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="loadImages"
      />
    </div>

    <el-dialog v-model="showBatchTagDialog" title="批量打标签" width="400px">
      <el-select v-model="batchTagIds" multiple placeholder="选择标签" style="width: 100%">
        <el-option v-for="tag in flatTags" :key="tag.id" :label="tag.full_path" :value="tag.id" />
      </el-select>
      <template #footer>
        <el-button @click="showBatchTagDialog = false">取消</el-button>
        <el-button type="primary" @click="applyBatchTag">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { imageApi, tagApi } from '../api'

const images = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchText = ref('')
const selectedTagId = ref(null)
const selectedImages = ref([])
const flatTags = ref([])
const showBatchTagDialog = ref(false)
const batchTagIds = ref([])

const thumbnailUrl = (id) => `/api/images/${id}/thumbnail`

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const loadImages = async () => {
  loading.value = true
  try {
    const { data } = await imageApi.list({
      page: currentPage.value,
      page_size: pageSize.value,
      search: searchText.value || undefined,
      tag_id: selectedTagId.value || undefined,
    })
    images.value = data.items
    total.value = data.total
  } catch (e) {
    ElMessage.error('加载图片失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const loadTags = async () => {
  try {
    const { data } = await tagApi.list({ flat: true })
    flatTags.value = data
  } catch (e) {
    console.error('Failed to load tags', e)
  }
}

const toggleSelect = (id) => {
  const idx = selectedImages.value.indexOf(id)
  if (idx >= 0) selectedImages.value.splice(idx, 1)
  else selectedImages.value.push(id)
}

const batchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定删除 ${selectedImages.value.length} 张图片？`, '确认删除', { type: 'warning' })
    for (const id of selectedImages.value) {
      await imageApi.delete(id)
    }
    ElMessage.success('删除成功')
    selectedImages.value = []
    loadImages()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败: ' + e.message)
  }
}

const applyBatchTag = async () => {
  if (batchTagIds.value.length === 0) {
    ElMessage.warning('请选择标签')
    return
  }
  try {
    await tagApi.batchTag({
      image_ids: selectedImages.value,
      tag_ids: batchTagIds.value,
      mode: 'add',
    })
    ElMessage.success('标签已应用')
    showBatchTagDialog.value = false
    batchTagIds.value = []
    loadImages()
  } catch (e) {
    ElMessage.error('打标签失败: ' + e.message)
  }
}

onMounted(() => {
  loadImages()
  loadTags()
})
</script>

<style scoped>
.gallery-view {
  max-width: 1400px;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.gallery-header h2 {
  margin: 0;
}

.gallery-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.gallery-toolbar {
  background: #fff;
  padding: 12px 20px;
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.image-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.image-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.image-card.selected {
  outline: 3px solid #1890ff;
}

.image-thumb {
  height: 180px;
  overflow: hidden;
}

.image-thumb .el-image {
  width: 100%;
  height: 100%;
}

.image-placeholder {
  width: 100%;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  color: #ccc;
}

.image-info {
  padding: 10px 12px;
}

.image-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-meta {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.image-tags {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mini-tag {
  font-size: 10px;
}

.image-check {
  position: absolute;
  top: 8px;
  right: 8px;
}

.gallery-empty {
  margin-top: 80px;
}

.gallery-pagination {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>
