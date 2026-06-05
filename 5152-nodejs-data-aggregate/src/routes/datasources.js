const express = require('express');
const dsModel = require('../models/datasource');
const { validateDatasourceConnection, getAdapter } = require('../datasource');
const { encrypt, decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, type, connection, queryPermissions, maxConcurrent } = req.body;

    if (!name || !type || !connection) {
      return res.status(400).json({ error: 'name, type, and connection are required' });
    }

    const encryptedConnection = {
      ...connection,
      password: connection.password ? encrypt(connection.password) : undefined,
    };

    const validation = await validateDatasourceConnection(type, connection).catch((e) => ({
      valid: false,
      error: e.message,
    }));

    if (validation && !validation.valid && validation.valid !== undefined) {
      return res.status(400).json({
        error: 'Connection validation failed',
        reason: validation.error || 'Unknown error',
      });
    }

    const ds = dsModel.createDatasource({
      name,
      type,
      connection: encryptedConnection,
      queryPermissions,
      maxConcurrent,
    });

    ds.connection = {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      baseUrl: connection.baseUrl,
    };

    logger.info(`Datasource created: ${ds.id} (${ds.name})`);
    res.status(201).json(ds);
  } catch (err) {
    logger.error('Failed to create datasource', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const datasources = dsModel.getAllDatasources();
  const safe = datasources.map((ds) => ({
    ...ds,
    connection: {
      host: ds.connection.host,
      port: ds.connection.port,
      database: ds.connection.database,
      baseUrl: ds.connection.baseUrl,
    },
  }));
  res.json(safe);
});

router.get('/:id', (req, res) => {
  const ds = dsModel.getDatasource(req.params.id);
  if (!ds) return res.status(404).json({ error: 'Datasource not found' });
  const safe = {
    ...ds,
    connection: {
      host: ds.connection.host,
      port: ds.connection.port,
      database: ds.connection.database,
      baseUrl: ds.connection.baseUrl,
    },
  };
  res.json(safe);
});

router.put('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.connection && updates.connection.password) {
      updates.connection.password = encrypt(updates.connection.password);
    }

    if (updates.connection) {
      const plainConnection = { ...updates.connection };
      if (req.body.connection.password) {
        plainConnection.password = req.body.connection.password;
      }
    }

    const ds = dsModel.updateDatasource(req.params.id, updates);
    logger.info(`Datasource updated: ${ds.id}`);
    res.json(ds);
  } catch (err) {
    logger.error('Failed to update datasource', err);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const deleted = dsModel.deleteDatasource(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Datasource not found' });
  logger.info(`Datasource deleted: ${req.params.id}`);
  res.json({ message: 'Datasource deleted' });
});

router.patch('/:id/status', (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    const ds = dsModel.setEnabled(req.params.id, enabled);
    logger.info(`Datasource ${ds.id} ${enabled ? 'enabled' : 'disabled'}`);
    res.json(ds);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/:id/validate', async (req, res) => {
  const ds = dsModel.getDatasource(req.params.id);
  if (!ds) return res.status(404).json({ error: 'Datasource not found' });

  const plainConnection = { ...ds.connection };
  if (plainConnection.password) {
    plainConnection.password = decrypt(plainConnection.password);
  }

  try {
    const result = await validateDatasourceConnection(ds.type, plainConnection);
    res.json({ valid: true, details: result });
  } catch (err) {
    res.json({ valid: false, error: err.message });
  }
});

router.get('/:id/stats', (req, res) => {
  const ds = dsModel.getDatasource(req.params.id);
  if (!ds) return res.status(404).json({ error: 'Datasource not found' });
  res.json({
    id: ds.id,
    totalQueries: ds.totalQueries,
    totalFailures: ds.totalFailures,
    errorRate: dsModel.getErrorRate(ds.id),
    consecutiveFailures: ds.consecutiveFailures,
    enabled: ds.enabled,
  });
});

module.exports = router;
