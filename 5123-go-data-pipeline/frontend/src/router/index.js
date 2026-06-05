import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '监控仪表板' }
  },
  {
    path: '/datasources',
    name: 'Datasources',
    component: () => import('@/views/Datasources.vue'),
    meta: { title: '数据源管理' }
  },
  {
    path: '/pipelines',
    name: 'Pipelines',
    component: () => import('@/views/Pipelines.vue'),
    meta: { title: '管道配置' }
  },
  {
    path: '/alerts',
    name: 'Alerts',
    component: () => import('@/views/Alerts.vue'),
    meta: { title: '告警规则' }
  },
  {
    path: '/aggregations',
    name: 'Aggregations',
    component: () => import('@/views/Aggregations.vue'),
    meta: { title: '聚合统计' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 日志分析平台` : '日志分析平台'
  next()
})

export default router
