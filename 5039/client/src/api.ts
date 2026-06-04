import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const articlesApi = {
  getList: (params?: any) => api.get('/articles', { params }),
  get: (id: string) => api.get(`/articles/${id}`),
  getVersions: (id: string) => api.get(`/articles/${id}/versions`),
  restoreVersion: (id: string, versionId: string) => api.post(`/articles/${id}/restore-version/${versionId}`),
  getRelated: (id: string) => api.get(`/articles/${id}/related`),
  create: (data: any) => api.post('/articles', data),
  update: (id: string, data: any) => api.put(`/articles/${id}`, data),
  publish: (id: string) => api.post(`/articles/${id}/publish`),
  delete: (id: string, permanent?: boolean) => api.delete(`/articles/${id}`, { params: { permanent } }),
  restore: (id: string) => api.post(`/articles/${id}/restore`),
};

export const categoriesApi = {
  getList: () => api.get('/categories'),
  get: (id: string) => api.get(`/categories/${id}`),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

export const tagsApi = {
  getList: () => api.get('/tags'),
  get: (id: string) => api.get(`/tags/${id}`),
  create: (data: any) => api.post('/tags', data),
  update: (id: string, data: any) => api.put(`/tags/${id}`, data),
  delete: (id: string) => api.delete(`/tags/${id}`),
};

export const templatesApi = {
  getList: () => api.get('/templates'),
  get: (id: string) => api.get(`/templates/${id}`),
  create: (data: any) => api.post('/templates', data),
  update: (id: string, data: any) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
};

export const approvalsApi = {
  getList: (params?: any) => api.get('/approvals', { params }),
  get: (id: string) => api.get(`/approvals/${id}`),
  create: (data: any) => api.post('/approvals', data),
  approve: (id: string, note?: string) => api.post(`/approvals/${id}/approve`, { approval_note: note }),
  reject: (id: string, note?: string) => api.post(`/approvals/${id}/reject`, { approval_note: note }),
};

export const logsApi = {
  getList: (params?: any) => api.get('/logs', { params }),
};

export default api;
