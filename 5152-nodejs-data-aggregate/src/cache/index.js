const Redis = require('ioredis');
const crypto = require('crypto');
const logger = require('../utils/logger');

class CacheManager {
  constructor(config) {
    this.redisConfig = config.redis || config || {};
    this.ttlByDatasourceType = config.ttlByDatasourceType || {};
    this.client = null;
    this.connected = false;
    this.hits = 0;
    this.misses = 0;
  }

  isAvailable() {
    return this.connected && this.client !== null;
  }

  async init() {
    try {
      this.client = new Redis({
        host: this.redisConfig.host || '127.0.0.1',
        port: this.redisConfig.port || 6379,
        password: this.redisConfig.password || null,
        db: this.redisConfig.db || 0,
        enableReadyCheck: true,
        connectTimeout: 3000,
        commandTimeout: 2000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryDelayOnFailover: 5000,
        reconnectOnError(err) {
          const targetError = 'ECONNREFUSED';
          if (err.message.includes(targetError)) {
            return 5000;
          }
          return 2;
        },
        retryStrategy(times) {
          if (times > 5) {
            return 30000;
          }
          return Math.min(times * 2000, 10000);
        },
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.connected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis ready');
        this.connected = true;
      });

      this.client.on('error', (err) => {
        logger.warn(`Redis connection error: ${err.message}`);
        this.connected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.connected = false;
      });

      try {
        await this.client.connect();
        this.connected = true;
      } catch (err) {
        logger.warn(`Redis connection failed, running in degraded mode: ${err.message}`);
        this.connected = false;
      }

      return { connected: this.connected };
    } catch (err) {
      logger.warn(`Cache manager init failed, running in degraded mode: ${err.message}`);
      this.connected = false;
      return { connected: false, error: err.message };
    }
  }

  generateKey(queryString, datasourceIds) {
    const sortedDatasourceIds = [...datasourceIds].sort().join(',');
    const raw = `${queryString}||${sortedDatasourceIds}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async get(key) {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      const data = await this.client.get(key);
      if (data === null) {
        this.misses += 1;
        return null;
      }
      this.hits += 1;
      return JSON.parse(data);
    } catch (err) {
      logger.warn(`Cache get failed: ${err.message}`);
      this.misses += 1;
      return null;
    }
  }

  async set(key, value, datasourceType) {
    if (!this.isAvailable()) {
      return;
    }
    try {
      const ttl = this.ttlByDatasourceType[datasourceType] || 300;
      const payload = {
        result: value,
        timestamp: new Date().toISOString(),
        datasourceIds: [],
      };
      await this.client.set(key, JSON.stringify(payload), 'EX', ttl);
    } catch (err) {
      logger.warn(`Cache set failed: ${err.message}`);
    }
  }

  getHitRate() {
    const total = this.hits + this.misses;
    const rate = total === 0 ? 0 : this.hits / total;
    return { hits: this.hits, misses: this.misses, rate, available: this.isAvailable() };
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }

  async close() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

function createCacheManager(config) {
  return new CacheManager(config);
}

module.exports = { createCacheManager, CacheManager };
