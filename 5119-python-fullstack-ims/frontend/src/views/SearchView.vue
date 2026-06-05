<template>
  <div class="search-view">
    <h2>相似图检索</h2>

    <el-card class="search-card">
      <div class="search-methods">
        <el-radio-group v-model="searchMethod">
          <el-radio-button value="upload">上传图片检索</el-radio-button>
          <el-radio-button value="existing">从图库选择</el-radio-button>
        </el-radio-group>
      </div>

      <div v-if="searchMethod === 'upload'" class="search-upload">
        <el-upload
          drag
          :auto-upload="false"
          :on-change="handleUploadChange"
          :limit="1"
          accept="image/*"
        >
          <el-icon :size="40" color="#c0c4cc"><UploadFilled /></el-icon>
          <div class="el-upload__text">拖拽或点击上传图片进行检索</div>
        </el-upload>
      </div>

      <div v-if="searchMethod === 'existing'" class="search-existing">
        <el-input-number v-model="existingImageId" :min="1" placeholder="输入图片 ID" />
        <el-button type="primary" @click="searchByExisting">检索</el-button>
      </div>

      <div class="search-params">
        <el-form inline>
          <el-form-item label="返回数量">
            <el-input-number v-model="topK" :min="1" :max="100" />
          </el-form-item>
          <el-form-item label="相似度阈值">
            <el-slider v-model="thresholdPercent" :min="0" :max="100" style="width: 200px" />
            <span style="margin-left: 8px; color: #999">{{ (thresholdPercent / 100).toFixed(2) }}</span>
          </el-form-item>
        </el-form>
      </div>

      <el-button
        v-if="searchMethod === 'upload' && uploadFile"
        type="primary"
        size="large"
        :loading="searching"
        @click="searchByUpload"
      >
        开始检索
      </el-button>
    </el-card>

    <div class="search-results" v-if="results.length > 0">
      <h3>检索结果 ({{ results.length }} 张相似图片)</h3>
      <div class="results-grid">
        <div
          v-for="item in results"
          :key="item.image_id"
          class="result-card"
          @click="$router.push(`/image/${item.image_id}`)"
        >
          <el-image :src="`/api/images/${item.image_id}/thumbnail`" fit="cover" lazy>
            <template #error>
              <div class="result-placeholder"><el-icon :size="30"><Picture /></el-icon></div>
            </template>
          </el-image>
          <div class="result-info">
            <div class="result-id">ID: {{ item.image_id }}</div>
            <el-progress
              :percentage="Math.round(item.similarity * 100)"
              :stroke-width="8"
              :format="() => (item.similarity * 100).toFixed(1) + '%'"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { searchApi } from '../api'

const searchMethod = ref('upload')
const uploadFile = ref(null)
const existingImageId = ref(null)
const topK = ref(10)
const thresholdPercent = ref(0)
const searching = ref(false)
const results = ref([])

const handleUploadChange = (file) => {
  uploadFile.value = file.raw
}

const searchByUpload = async () => {
  if (!uploadFile.value) {
    ElMessage.warning('请先选择图片')
    return
  }
  searching.value = true
  try {
    const formData = new FormData()
    formData.append('file', uploadFile.value)
    const { data } = await searchApi.similarUpload(formData, {
      top_k: topK.value,
      threshold: thresholdPercent.value / 100,
    })
    results.value = data.results
    if (data.results.length === 0) ElMessage.info('未找到相似图片')
  } catch (e) {
    ElMessage.error('检索失败: ' + e.message)
  } finally {
    searching.value = false
  }
}

const searchByExisting = async () => {
  if (!existingImageId.value) {
    ElMessage.warning('请输入图片 ID')
    return
  }
  searching.value = true
  try {
    const { data } = await searchApi.similarGet(existingImageId.value, {
      top_k: topK.value,
      threshold: thresholdPercent.value / 100,
    })
    results.value = data.results
    if (data.results.length === 0) ElMessage.info('未找到相似图片')
  } catch (e) {
    ElMessage.error('检索失败: ' + e.message)
  } finally {
    searching.value = false
  }
}
</script>

<style scoped>
.search-card {
  max-width: 700px;
  margin-top: 20px;
}

.search-methods {
  margin-bottom: 20px;
}

.search-upload {
  margin-bottom: 16px;
}

.search-existing {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.search-params {
  margin-bottom: 20px;
}

.search-results {
  margin-top: 24px;
}

.search-results h3 {
  margin-bottom: 16px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.result-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.result-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.result-card .el-image {
  width: 100%;
  height: 160px;
}

.result-placeholder {
  width: 100%;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  color: #ccc;
}

.result-info {
  padding: 10px 12px;
}

.result-id {
  font-size: 13px;
  margin-bottom: 6px;
  color: #333;
}
</style>
