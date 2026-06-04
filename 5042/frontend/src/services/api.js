import axios from 'axios';

const instance = axios.create({
  baseURL: '/api',
  headers: {
    'x-api-key': 'admin-api-key-change-in-production'
  }
});

instance.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

const api = {
  getHosts: () => instance.get('/hosts'),
  addHost: (data) => instance.post('/hosts', data),
  deleteHost: (id) => instance.delete(`/hosts/${id}`),
  
  getMetrics: (hostId, params) => instance.get(`/metrics/${hostId}`, { params }),
  getLatestMetrics: (hostId) => instance.get(`/metrics/latest/${hostId}`),
  
  getAlerts: (status) => instance.get('/alerts', { params: { status } }),
  acknowledgeAlert: (id) => instance.post(`/alerts/${id}/acknowledge`),
  resolveAlert: (id, note) => instance.post(`/alerts/${id}/resolve`, { note }),
  
  getRules: () => instance.get('/rules'),
  addRule: (data) => instance.post('/rules', data),
  deleteRule: (id) => instance.delete(`/rules/${id}`),
  
  getTemplates: () => instance.get('/templates'),
  addTemplate: (data) => instance.post('/templates', data),
  applyTemplate: (templateId, hostId) => instance.post(`/templates/${templateId}/apply/${hostId}`),
  
  getDashboards: () => instance.get('/dashboards'),
  addDashboard: (data) => instance.post('/dashboards', data),
  updateDashboard: (id, data) => instance.put(`/dashboards/${id}`, data)
};

export default api;
