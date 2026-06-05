<template>
  <div class="app">
    <header class="header">
      <h1 class="title">🖼️ 图片批量处理工具</h1>
    </header>

    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.icon }} {{ tab.label }}
      </button>
    </nav>

    <main class="content">
      <ResizePage v-if="activeTab === 'resize'" />
      <ConvertPage v-if="activeTab === 'convert'" />
      <WatermarkPage v-if="activeTab === 'watermark'" />
      <ExifPage v-if="activeTab === 'exif'" />
    </main>

    <footer class="footer">
      <span>Powered by Rust + Tauri + image-rs</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ResizePage from './components/ResizePage.vue'
import ConvertPage from './components/ConvertPage.vue'
import WatermarkPage from './components/WatermarkPage.vue'
import ExifPage from './components/ExifPage.vue'

const activeTab = ref('resize')

const tabs = [
  { key: 'resize', label: '批量缩放', icon: '📐' },
  { key: 'convert', label: '格式转换', icon: '🔄' },
  { key: 'watermark', label: '加水印', icon: '💧' },
  { key: 'exif', label: 'EXIF 处理', icon: '📋' },
]
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #0a0a16;
  color: #eee;
}

#app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0a16;
}

.header {
  padding: 16px 24px;
  background: linear-gradient(135deg, #0f3460, #16213e);
  border-bottom: 1px solid #0f3460;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 12px 24px 0;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
  overflow-x: auto;
}

.tab-btn {
  padding: 10px 18px;
  background: transparent;
  border: none;
  color: #8888aa;
  font-size: 14px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: #e94560;
}

.tab-btn.active {
  color: #e94560;
  border-bottom-color: #e94560;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.footer {
  padding: 10px 24px;
  background: #16213e;
  border-top: 1px solid #0f3460;
  font-size: 11px;
  color: #666688;
  text-align: right;
}
</style>
