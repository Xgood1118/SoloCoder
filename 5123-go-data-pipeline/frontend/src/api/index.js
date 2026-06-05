import request from '@/utils/request'

export const healthCheck = () => request.get('/health')

export const getDatasources = () => request.get('/datasources')
export const getDatasource = id => request.get(`/datasources/${id}`)
export const createDatasource = data => request.post('/datasources', data)
export const updateDatasource = (id, data) => request.put(`/datasources/${id}`, data)
export const deleteDatasource = id => request.delete(`/datasources/${id}`)
export const startDatasource = id => request.post(`/datasources/${id}/start`)
export const stopDatasource = id => request.post(`/datasources/${id}/stop`)
export const getDatasourceMetrics = id => request.get(`/datasources/${id}/metrics`)

export const getPipelines = () => request.get('/pipelines')
export const getPipeline = id => request.get(`/pipelines/${id}`)
export const createPipeline = data => request.post('/pipelines', data)
export const updatePipeline = (id, data) => request.put(`/pipelines/${id}`, data)
export const deletePipeline = id => request.delete(`/pipelines/${id}`)
export const startPipeline = id => request.post(`/pipelines/${id}/start`)
export const stopPipeline = id => request.post(`/pipelines/${id}/stop`)
export const getPipelineMetrics = id => request.get(`/pipelines/${id}/metrics`)

export const getAlertRules = () => request.get('/alerts/rules')
export const getAlertRule = id => request.get(`/alerts/rules/${id}`)
export const createAlertRule = data => request.post('/alerts/rules', data)
export const updateAlertRule = (id, data) => request.put(`/alerts/rules/${id}`, data)
export const deleteAlertRule = id => request.delete(`/alerts/rules/${id}`)
export const getAlertHistory = (ruleId = '', limit = 100) => 
  request.get('/alerts/history', { params: { rule_id: ruleId, limit } })

export const getAggregationRules = () => request.get('/aggregations/rules')
export const getAggregationRule = id => request.get(`/aggregations/rules/${id}`)
export const createAggregationRule = data => request.post('/aggregations/rules', data)
export const updateAggregationRule = (id, data) => request.put(`/aggregations/rules/${id}`, data)
export const deleteAggregationRule = id => request.delete(`/aggregations/rules/${id}`)
export const getAggregationResults = (id, limit = 100) => 
  request.get(`/aggregations/rules/${id}/results`, { params: { limit } })

export const getMonitorStatus = () => request.get('/monitor/status')
export const getMonitorOverview = () => request.get('/monitor/overview')
export const getMonitorAlerts = (limit = 50) => 
  request.get('/monitor/alerts', { params: { limit } })
