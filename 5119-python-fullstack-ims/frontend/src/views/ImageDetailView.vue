<template>
  <div class="image-detail">
    <div class="detail-header">
      <el-button @click="$router.back()"><el-icon><ArrowLeft /></el-icon> 返回</el-button>
      <h2>{{ image.original_name }}</h2>
      <div class="detail-actions">
        <el-button type="primary" @click="findSimilar">查找相似图片</el-button>
        <el-button @click="downloadImage">下载</el-button>
        <el-button type="danger" @click="deleteImage">删除</el-button>
      </div>
    </div>

    <div class="detail-body" v-loading="loading">
      <div class="detail-preview">
        <el-image :src="`/api/images/${id}/download`" fit="contain" style="max-height: 600px">
          <template #error>
            <div class="preview-placeholder">
              <el-icon :size="60"><Picture /></el-icon>
              <p>无法预览</p>
            </div>
          </template>
        </el-image>
      </div>

      <div class="detail-sidebar">
        <el-card>
          <template #header>基本信息</template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="文件名">{{ image.original_name }}</el-descriptions-item>
            <el-descriptions-item label="分辨率">{{ image.width }} × {{ image.height }}</el-descriptions-item>
            <el-descriptions-item label="格式">{{ image.format }}</el-descriptions-item>
            <el-descriptions-item label="色彩模式">{{ image.mode }}</el-descriptions-item>
            <el-descriptions-item label="文件大小">{{ formatSize(image.file_size) }}</el-descriptions-item>
            <el-descriptions-item label="上传时间">{{ image.uploaded_at }}</el-descriptions-item>
            <el-descriptions-item label="已索引">
              <el-tag :type="image.is_indexed ? 'success' : 'info'" size="small">
                {{ image.is_indexed ? '是' : '否' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top: 16px">
          <template #header>EXIF 信息</template>
          <el-descriptions v-if="image.exif" :column="1" size="small">
            <el-descriptions-item label="相机厂商">{{ image.exif.camera_make || '-' }}</el-descriptions-item>
            <el-descriptions-item label="相机型号">{{ image.exif.camera_model || '-' }}</el-descriptions-item>
            <el-descriptions-item label="拍摄时间">{{ image.exif.datetime_original || '-' }}</el-descriptions-item>
            <el-descriptions-item label="曝光时间">{{ image.exif.exposure_time || '-' }}</el-descriptions-item>
            <el-descriptions-item label="光圈">{{ image.exif.f_number || '-' }}</el-descriptions-item>
            <el-descriptions-item label="ISO">{{ image.exif.iso_speed || '-' }}</el-descriptions-item>
            <el-descriptions-item label="焦距">{{ image.exif.focal_length || '-' }}</el-descriptions-item>
            <el-descriptions-item label="GPS">
              <span v-if="image.exif.gps_latitude">
                {{ image.exif.gps_latitude.toFixed(4) }}, {{ image.exif.gps_longitude.toFixed(4) }}
              </span>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="无 EXIF 数据" :image-size="40" />
        </el-card>

        <el-card style="margin-top: 16px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>标签</span>
              <el-button size="small" @click="showTagDialog = true">管理标签</el-button>
            </div>
          </template>
          <div class="image-tags">
            <el-tag
              v-for="tag in image.tags"
              :key="tag.id"
              closable
              @close="removeTag(tag.id)"
              style="margin: 2px"
            >
              {{ tag.name }}
            </el-tag>
            <el-empty v-if="image.tags.length === 0" description="暂无标签" :image-size="30" />
          </div>
        </el-card>
      </div>
    </div>

    <el-dialog v-model="showTagDialog" title="添加标签" width="400px">
      <el-select v-model="addTagIds" multiple placeholder="选择标签" style="width: 100%">
        <el-option v-for="tag in allTags" :key="tag.id" :label="tag.full_path" :value="tag.id" />
      </el-select>
      <template #footer>
        <el-button @click="showTagDialog = false">取消</el-button>
        <el-button type="primary" @click="addTags">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { imageApi, tagApi } from '../api'

const route = useRoute()
const router = useRouter()
const id = parseInt(route.params.id)

const image = ref({ tags: [], exif: null })
const loading = ref(false)
const showTagDialog = ref(false)
const addTagIds = ref([])
const allTags = ref([])

const formatSize = (bytes) => {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const loadImage = async () => {
  loading.value = true
  try {
    const { data } = await imageApi.get(id)
    image.value = data
  } catch (e) {
    ElMessage.error('加载图片失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const loadTags = async () => {
  try {
    const { data } = await tagApi.list({ flat: true })
    allTags.value = data
  } catch (e) {
    console.error(e)
  }
}

const findSimilar = () => {
  router.push({ path: '/search', query: { imageId: id } })
}

const downloadImage = () => {
  window.open(`/api/images/${id}/download`, '_blank')
}

const deleteImage = async () => {
  try {
    await ElMessageBox.confirm('确定删除此图片？', '确认', { type: 'warning' })
    await imageApi.delete(id)
    ElMessage.success('已删除')
    router.push('/')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败: ' + e.message)
  }
}

const removeTag = async (tagId) => {
  try {
    await tagApi.batchTag({ image_ids: [id], tag_ids: [tagId], mode: 'remove' })
    ElMessage.success('标签已移除')
    loadImage()
  } catch (e) {
    ElMessage.error('移除标签失败: ' + e.message)
  }
}

const addTags = async () => {
  if (addTagIds.value.length === 0) return
  try {
    await tagApi.batchTag({ image_ids: [id], tag_ids: addTagIds.value, mode: 'add' })
    ElMessage.success('标签已添加')
    showTagDialog.value = false
    addTagIds.value = []
    loadImage()
  } catch (e) {
    ElMessage.error('添加标签失败: ' + e.message)
  }
}

onMounted(() => {
  loadImage()
  loadTags()
})
</script>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.detail-header h2 {
  flex: 1;
  margin: 0;
  font-size: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.detail-body {
  display: flex;
  gap: 24px;
}

.detail-preview {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.detail-preview .el-image {
  max-width: 100%;
  max-height: 600px;
}

.preview-placeholder {
  text-align: center;
  color: #ccc;
}

.detail-sidebar {
  flex: 0 0 360px;
}

.image-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
