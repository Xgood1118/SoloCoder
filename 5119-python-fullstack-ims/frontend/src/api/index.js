import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.detail || error.message || 'Unknown error'
    return Promise.reject(new Error(msg))
  }
)

export const imageApi = {
  upload: (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    })
  },
  uploadBatch: (files, onProgress) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    return api.post('/images/upload/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    })
  },
  list: (params) => api.get('/images/', { params }),
  get: (id) => api.get(`/images/${id}`),
  delete: (id) => api.delete(`/images/${id}`),
  thumbnail: (id) => `/api/images/${id}/thumbnail`,
  download: (id) => `/api/images/${id}/download`,
}

export const tagApi = {
  create: (data) => api.post('/tags/', data),
  list: (params) => api.get('/tags/', { params }),
  tree: () => api.get('/tags/tree'),
  get: (id) => api.get(`/tags/${id}`),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`),
  batchTag: (data) => api.post('/tags/batch-tag', data),
  batchReplace: (data) => api.post('/tags/batch-replace-tag', data),
}

export const searchApi = {
  similar: (data) => api.post('/search/similar', data),
  similarUpload: (formData, params) =>
    api.post('/search/similar/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params,
    }),
  similarGet: (id, params) => api.get(`/search/similar/${id}`, { params }),
}

export const batchApi = {
  process: (data) => api.post('/batch/process', data),
  taskProgress: (id) => api.get(`/batch/tasks/${id}/progress`),
  taskDetail: (id) => api.get(`/batch/tasks/${id}`),
  taskList: (params) => api.get('/batch/tasks', { params }),
}

export const scriptApi = {
  execute: (data) => api.post('/scripts/execute', data),
  dryRun: (data) => api.post('/scripts/execute/dry-run', data),
}

export const healthApi = {
  check: () => api.get('/health'),
}

export default api
