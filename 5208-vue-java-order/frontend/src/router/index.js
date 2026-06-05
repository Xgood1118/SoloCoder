import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/orders'
  },
  {
    path: '/orders',
    name: 'OrderList',
    component: () => import('../views/OrderList.vue')
  },
  {
    path: '/orders/create',
    name: 'OrderCreate',
    component: () => import('../views/OrderCreate.vue')
  },
  {
    path: '/orders/:id',
    name: 'OrderDetail',
    component: () => import('../views/OrderDetail.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
