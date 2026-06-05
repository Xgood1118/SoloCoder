require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 3000,
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-prod',
  },
  concurrency: {
    globalMaxConcurrent: parseInt(process.env.GLOBAL_MAX_CONCURRENT, 10) || 20,
    defaultDatasourceMaxConcurrent: parseInt(process.env.DATASOURCE_MAX_CONCURRENT, 10) || 5,
    queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS, 10) || 30000,
  },
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttlByDatasourceType: {
      mysql: 300,
      postgresql: 300,
      mongodb: 180,
      rest_api: 60,
    },
  },
  alert: {
    consecutiveFailureThreshold: parseInt(process.env.ALERT_FAILURE_THRESHOLD, 10) || 5,
  },
};
