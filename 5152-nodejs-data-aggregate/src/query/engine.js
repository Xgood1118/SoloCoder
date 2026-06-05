const { mergeResults, reorderFields, groupResults } = require('./merger');
const { decrypt } = require('../utils/encryption');

class QueryEngine {
  constructor(deps) {
    this.datasourceModel = deps.datasourceModel;
    this.adapterFactory = deps.adapterFactory;
    this.cacheManager = deps.cacheManager;
    this.concurrencyController = deps.concurrencyController;
    this.errorTracker = deps.errorTracker;
    this.cacheEnabled = deps.cacheEnabled !== false;
    this.poolCache = new Map();
  }

  _getPool(datasourceId) {
    if (this.poolCache.has(datasourceId)) {
      return this.poolCache.get(datasourceId);
    }
    return null;
  }

  async _ensurePool(ds) {
    if (this.poolCache.has(ds.id)) {
      return this.poolCache.get(ds.id);
    }

    const adapter = this.adapterFactory.getAdapter(ds.type);
    const plainConnection = { ...ds.connection };
    if (plainConnection.password) {
      plainConnection.password = decrypt(plainConnection.password);
    }

    let pool;
    if (ds.type === 'mysql') {
      pool = adapter.createPool(plainConnection);
    } else if (ds.type === 'postgresql') {
      pool = adapter.createPool(plainConnection);
    } else if (ds.type === 'mongodb') {
      pool = await adapter.createClient(plainConnection);
    } else if (ds.type === 'rest_api') {
      pool = adapter.createClient(plainConnection);
    }

    this.poolCache.set(ds.id, { pool, type: ds.type, adapter });
    return { pool, type: ds.type, adapter };
  }

  async _executeSubQuery(ds, subQuery) {
    const { pool, type, adapter } = await this._ensurePool(ds);
    const params = subQuery.queryParams || [];

    if (type === 'mysql' || type === 'postgresql') {
      const rows = await adapter.query(pool, subQuery.query, params);
      return rows;
    } else if (type === 'mongodb') {
      const result = await adapter.query(pool, subQuery.collection || 'data', subQuery.query, subQuery.options || {});
      return result;
    } else if (type === 'rest_api') {
      const result = await adapter.query(pool, subQuery.path || '/', subQuery.queryParams || {});
      return result;
    }

    throw new Error(`Unsupported datasource type: ${type}`);
  }

  async execute(aggregationQuery) {
    const startTime = Date.now();
    const { queryString, subQueries, joinConfig, fieldOrder, groupBy } = aggregationQuery;
    const datasourceIds = subQueries.map((sq) => sq.datasourceId);

    const cacheAvailable = this.cacheEnabled && this.cacheManager.isAvailable();
    if (cacheAvailable) {
      const cacheKey = this.cacheManager.generateKey(queryString, datasourceIds);
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return { ...cached.result, fromCache: true };
      }
    }

    const enabledSubQueries = [];
    for (const sq of subQueries) {
      const ds = this.datasourceModel.getDatasource(sq.datasourceId);
      if (!ds) continue;
      if (!ds.enabled) continue;
      enabledSubQueries.push({ subQuery: sq, ds });
    }

    const subQueryPromises = enabledSubQueries.map(async ({ subQuery, ds }) => {
      const subStartTime = Date.now();
      let release;
      try {
        release = await this.concurrencyController.acquire(subQuery.datasourceId);
        const data = await this._executeSubQuery(ds, subQuery);
        const timeMs = Date.now() - subStartTime;
        this.errorTracker.recordSuccess(subQuery.datasourceId);
        return { datasourceId: subQuery.datasourceId, data, timeMs, rowCount: Array.isArray(data) ? data.length : 0, status: 'success', error: null };
      } catch (err) {
        const timeMs = Date.now() - subStartTime;
        this.errorTracker.recordError(subQuery.datasourceId, err);
        return { datasourceId: subQuery.datasourceId, data: null, timeMs, rowCount: 0, status: 'failed', error: err.message };
      } finally {
        if (release) release();
      }
    });

    const settled = await Promise.allSettled(subQueryPromises);

    const fulfilledResults = [];
    const subQueryStats = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        const val = result.value;
        subQueryStats.push({
          datasourceId: val.datasourceId,
          status: val.status,
          timeMs: val.timeMs,
          rowCount: val.rowCount,
          error: val.error,
        });
        if (val.status === 'success') {
          fulfilledResults.push({ datasourceId: val.datasourceId, data: val.data });
        }
      } else {
        subQueryStats.push({
          datasourceId: 'unknown',
          status: 'failed',
          timeMs: 0,
          rowCount: 0,
          error: result.reason?.message || String(result.reason),
        });
      }
    }

    let mergedData;

    if (fulfilledResults.length === 0) {
      mergedData = [];
    } else if (fulfilledResults.length === 1) {
      mergedData = fulfilledResults[0].data.map((row) => ({
        ...row,
        _source: [fulfilledResults[0].datasourceId],
      }));
    } else {
      mergedData = mergeResults(fulfilledResults, joinConfig);
    }

    if (groupBy && groupBy.length > 0) {
      mergedData = groupResults(mergedData, groupBy);
    }

    if (fieldOrder && fieldOrder.length > 0) {
      mergedData = reorderFields(mergedData, fieldOrder);
    }

    const executionTimeMs = Date.now() - startTime;

    const queryResult = {
      data: mergedData,
      meta: {
        totalRows: Array.isArray(mergedData) ? mergedData.length : 0,
        executionTimeMs,
        subQueryStats,
      },
      fromCache: false,
    };

    if (cacheAvailable) {
      const cacheKey = this.cacheManager.generateKey(queryString, datasourceIds);
      const primaryDsType = this.datasourceModel.getDatasource(datasourceIds[0])?.type || 'mysql';
      await this.cacheManager.set(cacheKey, queryResult, primaryDsType);
    }

    return queryResult;
  }

  getCacheStats() {
    return this.cacheManager.getHitRate();
  }

  async clearCache() {
    this.cacheManager.resetStats();
  }
}

function createQueryEngine(deps) {
  return new QueryEngine(deps);
}

module.exports = { createQueryEngine, QueryEngine };
