const { v4: uuidv4 } = require('uuid');

const VALID_TYPES = ['mysql', 'postgresql', 'mongodb', 'rest_api'];
const datasources = new Map();

function createDatasource(raw) {
  const { name, type, connection, queryPermissions, maxConcurrent } = raw;

  if (!name || typeof name !== 'string') {
    throw new Error('Datasource name is required');
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid datasource type: ${type}. Valid types: ${VALID_TYPES.join(', ')}`);
  }
  if (!connection || typeof connection !== 'object') {
    throw new Error('Connection info is required');
  }

  const id = uuidv4();
  const ds = {
    id,
    name,
    type,
    connection,
    queryPermissions: queryPermissions || [],
    maxConcurrent: maxConcurrent || null,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    consecutiveFailures: 0,
    totalQueries: 0,
    totalFailures: 0,
  };

  datasources.set(id, ds);
  return ds;
}

function updateDatasource(id, updates) {
  const ds = datasources.get(id);
  if (!ds) throw new Error(`Datasource not found: ${id}`);

  if (updates.type && !VALID_TYPES.includes(updates.type)) {
    throw new Error(`Invalid datasource type: ${updates.type}`);
  }

  Object.assign(ds, updates, { updatedAt: new Date().toISOString() });
  return ds;
}

function getDatasource(id) {
  return datasources.get(id);
}

function getAllDatasources() {
  return Array.from(datasources.values());
}

function getEnabledDatasources() {
  return Array.from(datasources.values()).filter((ds) => ds.enabled);
}

function deleteDatasource(id) {
  return datasources.delete(id);
}

function setEnabled(id, enabled) {
  const ds = datasources.get(id);
  if (!ds) throw new Error(`Datasource not found: ${id}`);
  ds.enabled = enabled;
  ds.updatedAt = new Date().toISOString();
  return ds;
}

function incrementFailure(id) {
  const ds = datasources.get(id);
  if (!ds) return;
  ds.consecutiveFailures += 1;
  ds.totalQueries += 1;
  ds.totalFailures += 1;
}

function incrementSuccess(id) {
  const ds = datasources.get(id);
  if (!ds) return;
  ds.consecutiveFailures = 0;
  ds.totalQueries += 1;
}

function getErrorRate(id) {
  const ds = datasources.get(id);
  if (!ds || ds.totalQueries === 0) return 0;
  return ds.totalFailures / ds.totalQueries;
}

module.exports = {
  createDatasource,
  updateDatasource,
  getDatasource,
  getAllDatasources,
  getEnabledDatasources,
  deleteDatasource,
  setEnabled,
  incrementFailure,
  incrementSuccess,
  getErrorRate,
  VALID_TYPES,
};
