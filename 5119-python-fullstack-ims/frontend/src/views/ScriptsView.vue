<template>
  <div class="scripts-view">
    <h2>自定义过滤脚本</h2>

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      style="margin: 16px 0"
    >
      <template #title>
        脚本运行在受限沙箱环境中，禁止访问文件系统、网络和系统模块。
        脚本中可使用 <code>images</code> 变量（图片数据列表），结果需赋值给 <code>result</code> 变量。
      </template>
    </el-alert>

    <el-card>
      <h3>编写脚本</h3>
      <el-input
        v-model="scriptContent"
        type="textarea"
        :rows="12"
        placeholder="编写 Python 过滤脚本..."
        style="margin-top: 12px; font-family: 'Consolas', 'Courier New', monospace"
      />

      <div class="script-examples">
        <span>示例：</span>
        <el-button size="small" @click="loadExample('resolution')">筛选高分辨率</el-button>
        <el-button size="small" @click="loadExample('camera')">按相机型号筛选</el-button>
        <el-button size="small" @click="loadExample('size')">按文件大小筛选</el-button>
        <el-button size="small" @click="loadExample('gps')">有GPS信息的图片</el-button>
      </div>

      <div class="script-actions">
        <el-button @click="dryRun">试运行 (10张)</el-button>
        <el-button type="primary" :loading="executing" @click="executeScript">
          执行脚本
        </el-button>
      </div>
    </el-card>

    <el-card v-if="result" style="margin-top: 20px">
      <h3>执行结果</h3>
      <el-descriptions :column="2" border size="small" style="margin-top: 12px">
        <el-descriptions-item label="状态">
          <el-tag :type="result.success ? 'success' : 'danger'">{{ result.success ? '成功' : '失败' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="匹配数量">{{ result.matched_ids.length }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="result.error" style="margin-top: 12px">
        <el-alert type="error" :closable="false" :title="result.error" />
      </div>

      <div v-if="result.log" style="margin-top: 12px">
        <h4>输出日志</h4>
        <pre class="script-log">{{ result.log }}</pre>
      </div>

      <div v-if="result.matched_ids.length > 0" style="margin-top: 12px">
        <h4>匹配图片 ID</h4>
        <div class="matched-ids">
          <el-tag v-for="id in result.matched_ids" :key="id" size="small" style="margin: 2px" @click="$router.push(`/image/${id}`)">
            #{{ id }}
          </el-tag>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { scriptApi } from '../api'

const scriptContent = ref('')
const executing = ref(false)
const result = ref(null)

const examples = {
  resolution: `# 筛选分辨率大于 2000x2000 的图片
result = [img for img in images if img.get("width", 0) > 2000 and img.get("height", 0) > 2000]
print(f"Found {len(result)} high-resolution images")`,

  camera: `# 筛选相机型号包含 Canon 的图片
result = [img for img in images if img.get("exif") and img["exif"].get("camera_model") and "Canon" in img["exif"]["camera_model"]]
print(f"Found {len(result)} Canon images")`,

  size: `# 筛选文件大小超过 5MB 的图片
result = [img for img in images if img.get("file_size", 0) > 5 * 1024 * 1024]
print(f"Found {len(result)} large images")`,

  gps: `# 筛选有 GPS 信息的图片
result = [img for img in images if img.get("exif") and img["exif"].get("gps_latitude") is not None]
print(f"Found {len(result)} images with GPS data")`,
}

const loadExample = (key) => {
  scriptContent.value = examples[key]
}

const dryRun = async () => {
  if (!scriptContent.value.trim()) {
    ElMessage.warning('请编写脚本')
    return
  }
  executing.value = true
  try {
    const { data } = await scriptApi.dryRun({ script: scriptContent.value })
    result.value = data
  } catch (e) {
    ElMessage.error('执行失败: ' + e.message)
  } finally {
    executing.value = false
  }
}

const executeScript = async () => {
  if (!scriptContent.value.trim()) {
    ElMessage.warning('请编写脚本')
    return
  }
  executing.value = true
  try {
    const { data } = await scriptApi.execute({ script: scriptContent.value })
    result.value = data
  } catch (e) {
    ElMessage.error('执行失败: ' + e.message)
  } finally {
    executing.value = false
  }
}
</script>

<style scoped>
.scripts-view {
  max-width: 900px;
}

.script-examples {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.script-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.script-log {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Consolas', monospace;
}

.matched-ids {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

h3 {
  margin: 0;
}

h4 {
  margin: 0 0 8px;
}
</style>
