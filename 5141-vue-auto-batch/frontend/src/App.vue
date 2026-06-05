<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon :size="24" color="#409eff"><Document /></el-icon>
        <span class="logo-text">日志批量处理</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        router
        background-color="#001529"
        text-color="#b9c0cc"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/">
          <el-icon><Odometer /></el-icon>
          <span>处理监控</span>
        </el-menu-item>
        <el-menu-item index="/directories">
          <el-icon><Folder /></el-icon>
          <span>目录管理</span>
        </el-menu-item>
        <el-menu-item index="/rules">
          <el-icon><Filter /></el-icon>
          <span>匹配规则</span>
        </el-menu-item>
        <el-menu-item index="/records">
          <el-icon><List /></el-icon>
          <span>处理记录</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><DataLine /></el-icon>
          <span>报表统计</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <span class="breadcrumb">{{ currentPageTitle }}</span>
        </div>
        <div class="header-right">
          <el-tag v-if="queueInfo.isPaused" type="warning">已暂停</el-tag>
          <el-tag v-else type="success">运行中</el-tag>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from './stores/app';

const route = useRoute();
const appStore = useAppStore();

const activeMenu = computed(() => route.path);
const queueInfo = computed(() => appStore.queueInfo);

const pageTitles = {
  '/': '处理监控',
  '/directories': '目录管理',
  '/rules': '匹配规则',
  '/records': '处理记录',
  '/reports': '报表统计',
  '/settings': '系统设置',
};

const currentPageTitle = computed(() => pageTitles[route.path] || '日志批量处理系统');

let eventSource = null;

onMounted(() => {
  appStore.fetchInitialData();

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.host;
  eventSource = new EventSource(`/api/events`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      appStore.handleSSEEvent(data);
    } catch (e) {
      console.error('SSE parse error:', e);
    }
  };

  eventSource.onerror = (err) => {
    console.error('SSE error:', err);
  };
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>

<style scoped>
.layout-container {
  height: 100%;
}

.sidebar {
  background-color: #001529;
  overflow-y: auto;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: white;
  border-bottom: 1px solid #1f3148;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu .el-menu-item {
  height: 50px;
  line-height: 50px;
}

.header {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 60px;
}

.breadcrumb {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.main-content {
  padding: 0;
  background: #f5f7fa;
}
</style>
