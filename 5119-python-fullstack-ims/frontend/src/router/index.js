import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Gallery',
    component: () => import('../views/GalleryView.vue'),
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('../views/UploadView.vue'),
  },
  {
    path: '/tags',
    name: 'Tags',
    component: () => import('../views/TagsView.vue'),
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/SearchView.vue'),
  },
  {
    path: '/batch',
    name: 'Batch',
    component: () => import('../views/BatchView.vue'),
  },
  {
    path: '/scripts',
    name: 'Scripts',
    component: () => import('../views/ScriptsView.vue'),
  },
  {
    path: '/image/:id',
    name: 'ImageDetail',
    component: () => import('../views/ImageDetailView.vue'),
    props: true,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
