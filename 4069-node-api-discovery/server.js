const http = require('http');
const url = require('url');
const registry = require('./registry');
const healthChecker = require('./health');
const serviceDiscovery = require('./discovery');
const serviceRouter = require('./router');

const PORT = parseInt(process.env.PORT, 10) || 8080;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json'
  });
  res.end(JSON.stringify(data));
}

function getNamespace(query) {
  return query.namespace || 'default';
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  try {
    if (method === 'POST' && pathname === '/api/v1/services') {
      const body = await parseBody(req);
      const namespace = getNamespace(query);
      const { name, host, port, tags, metadata } = body;

      if (!name || !host || typeof port !== 'number') {
        return sendJson(res, 400, { error: 'name, host, and port are required' });
      }

      const result = registry.registerInstance(namespace, name, host, port, tags || [], metadata || {});
      return sendJson(res, result.created ? 201 : 200, {
        instance_id: result.instanceId,
        created: result.created
      });
    }

    if (method === 'GET' && pathname === '/api/v1/services') {
      const namespace = getNamespace(query);
      const name = query.name;
      const tagsParam = query.tags;

      let instances;
      if (name) {
        let tags = null;
        let tagMode = 'AND';
        if (tagsParam) {
          if (tagsParam.includes(',')) {
            tags = tagsParam.split(',');
            tagMode = 'OR';
          } else {
            tags = [tagsParam];
          }
        }
        instances = registry.findInstances(namespace, name, tags, tagMode);
      } else {
        instances = registry.getAllInstances(namespace);
      }

      return sendJson(res, 200, instances);
    }

    if (method === 'GET' && pathname.startsWith('/api/v1/services/')) {
      const parts = pathname.split('/');
      if (parts.length === 5) {
        const instanceId = parts[4];
        const instance = registry.getInstanceAnyNamespace(instanceId);

        if (!instance) {
          return sendJson(res, 404, { error: 'Instance not found' });
        }

        return sendJson(res, 200, instance);
      }
    }

    if (method === 'GET' && pathname.startsWith('/api/v1/services/') && pathname.endsWith('/metadata')) {
      const instanceId = pathname.split('/')[4];
      const instance = registry.getInstanceAnyNamespace(instanceId);

      if (!instance) {
        return sendJson(res, 404, { error: 'Instance not found' });
      }

      return sendJson(res, 200, instance.metadata);
    }

    if (method === 'PATCH' && pathname.startsWith('/api/v1/services/') && pathname.endsWith('/metadata')) {
      const instanceId = pathname.split('/')[4];
      const body = await parseBody(req);

      if (!registry.updateMetadata(instanceId, body)) {
        return sendJson(res, 404, { error: 'Instance not found' });
      }

      const instance = registry.getInstanceAnyNamespace(instanceId);
      return sendJson(res, 200, instance.metadata);
    }

    if (method === 'PUT' && pathname.startsWith('/api/v1/services/') && pathname.endsWith('/state')) {
      const instanceId = pathname.split('/')[4];
      const body = await parseBody(req);
      const { state, sub_state } = body;

      const validStates = ['pending', 'healthy', 'unhealthy', 'removed', 'draining'];
      if (!validStates.includes(state)) {
        return sendJson(res, 400, { error: 'Invalid state' });
      }

      if (!registry.updateInstanceState(instanceId, state, sub_state || null)) {
        return sendJson(res, 404, { error: 'Instance not found' });
      }

      const instance = registry.getInstanceAnyNamespace(instanceId);
      return sendJson(res, 200, {
        instance_id: instanceId,
        current_state: instance.current_state,
        sub_state: instance.sub_state,
        last_transition_at: instance.last_transition_at
      });
    }

    if (method === 'PUT' && pathname.startsWith('/api/v1/services/') && pathname.endsWith('/dependencies')) {
      const serviceId = pathname.split('/')[4];
      const body = await parseBody(req);
      const namespace = getNamespace(query);

      const instance = registry.getInstance(namespace, serviceId);
      if (!instance) {
        return sendJson(res, 404, { error: 'Service instance not found' });
      }

      const result = serviceRouter.setDependencies(namespace, instance.service_name, body.dependencies || []);
      if (result.error) {
        return sendJson(res, result.code, { error: result.error });
      }

      return sendJson(res, 200, { success: true });
    }

    if (method === 'DELETE' && pathname.startsWith('/api/v1/services/') && pathname.endsWith('/dependencies')) {
      const serviceId = pathname.split('/')[4];
      const namespace = getNamespace(query);

      const instance = registry.getInstance(namespace, serviceId);
      if (!instance) {
        return sendJson(res, 404, { error: 'Service instance not found' });
      }

      serviceRouter.deleteDependencies(namespace, instance.service_name);
      return sendJson(res, 200, { success: true });
    }

    if (method === 'POST' && pathname.startsWith('/api/v1/services/') && pathname.endsWith('/metrics')) {
      const instanceId = pathname.split('/')[4];
      const body = await parseBody(req);
      const { requests_count, avg_latency_ms, error_count } = body;

      if (!registry.addMetrics(instanceId, requests_count, avg_latency_ms, error_count)) {
        return sendJson(res, 404, { error: 'Instance not found' });
      }

      return sendJson(res, 200, { success: true });
    }

    if (method === 'GET' && pathname.startsWith('/api/v1/discover/')) {
      const serviceName = pathname.split('/')[4];
      const namespace = getNamespace(query);
      const strategy = query.strategy || 'weighted_random';
      const tagsParam = query.tags;

      let tags = null;
      let tagMode = 'AND';
      if (tagsParam) {
        if (tagsParam.includes(',')) {
          tags = tagsParam.split(',');
          tagMode = 'OR';
        } else {
          tags = [tagsParam];
        }
      }

      const result = serviceDiscovery.discover(namespace, serviceName, strategy, tags, tagMode);
      if (result.error) {
        return sendJson(res, result.code, { error: result.error });
      }

      return sendJson(res, 200, result);
    }

    if (method === 'POST' && pathname === '/api/v1/services/batch') {
      const body = await parseBody(req);
      const namespace = getNamespace(query);
      const services = body.services;

      if (!Array.isArray(services)) {
        return sendJson(res, 400, { error: 'services array is required' });
      }

      const result = serviceRouter.batchRegister(namespace, services);
      if (result.error) {
        return sendJson(res, result.code, { error: result.error });
      }

      return sendJson(res, 201, result);
    }

    if (method === 'POST' && pathname === '/api/v1/services/bulk-unregister') {
      const body = await parseBody(req);
      const namespace = getNamespace(query);
      const instanceIds = body.instance_ids;

      if (!Array.isArray(instanceIds)) {
        return sendJson(res, 400, { error: 'instance_ids array is required' });
      }

      const result = serviceRouter.batchUnregister(namespace, instanceIds);
      if (result.error) {
        return sendJson(res, result.code, { error: result.error, success: result.success, failed: result.failed });
      }

      return sendJson(res, 200, result);
    }

    if (method === 'GET' && pathname === '/api/v1/namespaces') {
      const namespaces = serviceRouter.getNamespaces();
      return sendJson(res, 200, { namespaces });
    }

    if (method === 'GET' && pathname === '/api/v1/export') {
      const data = serviceRouter.exportData();
      return sendJson(res, 200, data);
    }

    if (method === 'POST' && pathname === '/api/v1/import') {
      const body = await parseBody(req);
      serviceRouter.importData(body);
      return sendJson(res, 200, { success: true });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Error:', err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Service discovery server listening on port ${PORT}`);
  healthChecker.start();
  serviceRouter.startDependencyChecker();
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  healthChecker.stop();
  serviceRouter.stopDependencyChecker();
  server.close();
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  healthChecker.stop();
  serviceRouter.stopDependencyChecker();
  server.close();
});
