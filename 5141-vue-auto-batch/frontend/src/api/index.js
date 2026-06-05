import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const directoriesAPI = {
  list: () => api.get('/directories'),
  add: (path) => api.post('/directories', { path }),
  remove: (id) => api.delete(`/directories/${id}`),
  scan: (id) => api.post(`/directories/${id}/scan`),
};

export const rulesAPI = {
  list: () => api.get('/rules'),
  add: (data) => api.post('/rules', data),
  update: (id, data) => api.put(`/rules/${id}`, data),
  remove: (id) => api.delete(`/rules/${id}`),
  setRelation: (relation) => api.post('/rules/relation', { relation }),
};

export const queueAPI = {
  get: () => api.get('/queue'),
  pause: () => api.post('/queue/pause'),
  resume: () => api.post('/queue/resume'),
};

export const recordsAPI = {
  list: (params) => api.get('/records', { params }),
  stats: (params) => api.get('/stats', { params }),
};

export const reportAPI = {
  download: (params) =>
    api.get('/report/download', {
      params,
      responseType: 'blob',
    }),
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.post('/settings', data),
};

export const dedupAPI = {
  list: (params) => api.get('/deduplication', { params }),
};

export default api;
