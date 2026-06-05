<template>
  <div class="upload-view">
    <h2>上传图片</h2>

    <el-upload
      class="upload-dragger"
      drag
      multiple
      :auto-upload="false"
      :on-change="handleFileChange"
      :file-list="fileList"
      accept="image/*"
    >
      <el-icon :size="60" color="#c0c4cc"><UploadFilled /></el-icon>
      <div class="el-upload__text">将图片拖到此处，或<em>点击上传</em></div>
      <template #tip>
        <div class="el-upload__tip">支持 jpg/png/gif/bmp/webp/tiff 格式，单文件最大 50MB</div>
      </template>
    </el-upload>

    <div class="upload-actions" v-if="fileList.length > 0">
      <el-button @click="fileList = []">清空列表</el-button>
      <el-button type="primary" :loading="uploading" @click="startUpload">
        开始上传 ({{ fileList.length }} 张)
      </el-button>
    </div>

    <div class="upload-progress" v-if="uploading">
      <el-progress :percentage="uploadProgress" :format="() => `${uploadedCount}/${fileList.length}`" />
    </div>

    <div class="upload-results" v-if="uploadResults.length > 0">
      <h3>上传结果</h3>
      <el-table :data="uploadResults" stripe size="small">
        <el-table-column prop="original_name" label="文件名" min-width="200" />
        <el-table-column prop="width" label="宽度" width="80" />
        <el-table-column prop="height" label="高度" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { imageApi } from '../api'

const fileList = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadedCount = ref(0)
const uploadResults = ref([])

const handleFileChange = (file, newFileList) => {
  fileList.value = newFileList
}

const startUpload = async () => {
  if (fileList.value.length === 0) return

  uploading.value = true
  uploadProgress.value = 0
  uploadedCount.value = 0
  uploadResults.value = []

  const files = fileList.value.map((f) => f.raw)

  if (files.length === 1) {
    try {
      const { data } = await imageApi.upload(files[0])
      uploadResults.value.push({ ...data, status: 'success' })
      uploadedCount.value = 1
      uploadProgress.value = 100
      ElMessage.success('上传成功')
    } catch (e) {
      uploadResults.value.push({ original_name: files[0].name, status: 'failed' })
      ElMessage.error('上传失败: ' + e.message)
    }
  } else {
    try {
      const { data } = await imageApi.uploadBatch(files)
      data.forEach((item) => {
        uploadResults.value.push({ ...item, status: 'success' })
      })
      uploadedCount.value = data.length
      uploadProgress.value = 100
      ElMessage.success(`成功上传 ${data.length} 张图片`)
    } catch (e) {
      ElMessage.error('批量上传失败: ' + e.message)
    }
  }

  uploading.value = false
  fileList.value = []
}
</script>

<style scoped>
.upload-view {
  max-width: 800px;
  margin: 0 auto;
}

.upload-dragger {
  margin: 24px 0;
}

.upload-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.upload-progress {
  margin-top: 20px;
}

.upload-results {
  margin-top: 24px;
}

.upload-results h3 {
  margin-bottom: 12px;
}
</style>
