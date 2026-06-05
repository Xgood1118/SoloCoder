<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-title">
        <el-icon :size="28" color="#409EFF"><Shop /></el-icon>
        <h1>电商订单管理后台</h1>
      </div>
      <div class="header-user">
        <el-tag type="info">管理员: admin</el-tag>
      </div>
    </el-header>
    <el-container>
      <el-aside width="220px" class="app-aside">
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/orders">
            <el-icon><List /></el-icon>
            <span>订单管理</span>
          </el-menu-item>
          <el-menu-item index="/orders/create">
            <el-icon><Plus /></el-icon>
            <span>代客下单</span>
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => {
  if (route.path.startsWith('/orders/') && route.path !== '/orders/create') {
    return '/orders'
  }
  return route.path
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
}

.app-container {
  height: 100vh;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 60px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h1 {
  font-size: 20px;
  color: #303133;
  font-weight: 600;
}

.app-aside {
  background-color: #304156;
}

.app-aside :deep(.el-menu) {
  border-right: none;
}

.app-main {
  background: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
