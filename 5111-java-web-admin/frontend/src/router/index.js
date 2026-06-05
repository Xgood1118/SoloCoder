import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '首页概览', icon: 'HomeFilled' }
      },
      {
        path: 'meeting-rooms',
        name: 'MeetingRooms',
        component: () => import('@/views/meeting-room/MeetingRoomList.vue'),
        meta: { title: '会议室管理', icon: 'OfficeBuilding' }
      },
      {
        path: 'equipment',
        name: 'Equipment',
        component: () => import('@/views/equipment/EquipmentList.vue'),
        meta: { title: '设备管理', icon: 'Cpu' }
      },
      {
        path: 'reservations',
        name: 'Reservations',
        component: () => import('@/views/reservation/ReservationList.vue'),
        meta: { title: '预定管理', icon: 'Calendar' }
      },
      {
        path: 'reservations/create',
        name: 'CreateReservation',
        component: () => import('@/views/reservation/ReservationCreate.vue'),
        meta: { title: '创建预定', icon: 'Plus', hidden: true }
      },
      {
        path: 'reservations/batch',
        name: 'BatchReservation',
        component: () => import('@/views/reservation/BatchReservation.vue'),
        meta: { title: '批量预定', icon: 'Tickets', hidden: true }
      },
      {
        path: 'lock-logs',
        name: 'LockLogs',
        component: () => import('@/views/equipment/LockLogList.vue'),
        meta: { title: '锁定日志', icon: 'Document' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 会议室管理系统` : '会议室管理系统'
  next()
})

export default router
