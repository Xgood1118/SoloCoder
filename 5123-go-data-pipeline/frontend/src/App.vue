<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo">
          <el-icon :size="28"><DataAnalysis /></el-icon>
          <span class="title">日志分析平台</span>
        </div>
        <div class="header-right">
          <span class="status-badge" :class="statusClass">
            <el-icon :size="16"><CircleCheck /></el-icon>
            <span>{{ statusText }}</span>
          </span>
        </div>
      </div>
    </el-header>
    <el-container>
      <el-aside width="220px" class="app-aside">
        <el-menu
          :default-active="activeMenu"
          router
          class="sidebar-menu"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/dashboard">
            <el-icon><Monitor /></el-icon>
            <span>监控仪表板</span>
          </el-menu-item>
          <el-menu-item index="/datasources">
            <el-icon><Collection /></el-icon>
            <span>数据源管理</span>
          </el-menu-item>
          <el-menu-item index="/pipelines">
            <el-icon><Connection /></el-icon>
            <span>管道配置</span>
          </el-menu-item>
          <el-menu-item index="/alerts">
            <el-icon><Warning /></el-icon>
            <span>告警规则</span>
          </el-menu-item>
          <el-menu-item index="/aggregations">
            <el-icon><TrendCharts /></el-icon>
            <span>聚合统计</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElNotification } from 'element-plus'
import { CircleCheck } from '@element-plus/icons-vue'
import request from '@/utils/request'

const route = useRoute()
const activeMenu = ref('/dashboard')
const systemStatus = ref('running')
const statusTimer = ref(null)

const statusClass = ref('status-running')
const statusText = ref('系统运行中')

const checkStatus = async () => {
  try {
    const res = await request.get('/health')
    if (res.code === 0) {
      systemStatus.value = 'running'
      statusClass.value = 'status-running'
      statusText.value = '系统运行中'
    }
  } catch (e) {
    systemStatus.value = 'error'
    statusClass.value = 'status-error'
    statusText.value = '系统异常'
  }
}

onMounted(() => {
  activeMenu.value = route.path
  checkStatus()
  statusTimer.value = setInterval(checkStatus, 5000)
})

onUnmounted(() => {
  if (statusTimer.value) {
    clearInterval(statusTimer.value)
  }
})
</script>

<style>
.app-container {
  height: 100vh;
}

.app-header {
  background: linear-gradient(90deg, #1e3c72, #2a5298);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo .title {
  font-size: 20px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
}

.status-running {
  background: rgba(103, 194, 58, 0.9);
  color: white;
}

.status-error {
  background: rgba(245, 108, 108, 0.9);
  color: white;
}

.app-aside {
  background: #304156;
}

.sidebar-menu {
  border-right: none;
  height: calc(100vh - 60px);
}

.app-main {
  background: #f0f2f5;
  padding: 24px;
  overflow-y: auto;
}
</style>
