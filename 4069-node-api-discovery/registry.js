const crypto = require('crypto');

class ServiceRegistry {
  constructor() {
    this.data = new Map();
    this.operationLogs = [];
    this.healthListeners = [];
  }

  generateId() {
    return crypto.randomUUID();
  }

  logOperation(type, data) {
    this.operationLogs.push({
      timestamp: Date.now(),
      type,
      data
    });
  }

  onHealthChange(listener) {
    this.healthListeners.push(listener);
  }

  emitHealthChange(instanceId, oldState, newState) {
    this.healthListeners.forEach(listener => listener(instanceId, oldState, newState));
  }

  getNamespace(namespace, create = false) {
    if (!this.data.has(namespace)) {
      if (!create) return null;
      this.data.set(namespace, new Map());
    }
    return this.data.get(namespace);
  }

  getService(namespace, serviceName, create = false) {
    const ns = this.getNamespace(namespace, create);
    if (!ns) return null;
    if (!ns.has(serviceName)) {
      if (!create) return null;
      ns.set(serviceName, new Map());
    }
    return ns.get(serviceName);
  }

  registerInstance(namespace, name, host, port, tags = [], metadata = {}) {
    const service = this.getService(namespace, name, true);
    
    let existingInstanceId = null;
    for (const [id, instance] of service) {
      if (instance.host === host && instance.port === port) {
        existingInstanceId = id;
        break;
      }
    }

    const now = Date.now();
    
    if (existingInstanceId) {
      const instance = service.get(existingInstanceId);
      const oldState = instance.current_state;
      instance.tags = tags;
      instance.metadata = { ...instance.metadata, ...metadata };
      instance.updated_at = now;
      this.logOperation('update', { namespace, name, instanceId: existingInstanceId });
      return { instanceId: existingInstanceId, created: false, instance };
    }

    const instanceId = this.generateId();
    const instance = {
      instance_id: instanceId,
      service_name: name,
      namespace,
      host,
      port,
      tags,
      metadata: {
        weight: 1,
        ...metadata
      },
      current_state: 'pending',
      sub_state: null,
      last_transition_at: now,
      health_history: [],
      consecutive_success: 0,
      consecutive_failures: 0,
      total_failures: 0,
      dependencies: [],
      metrics: [],
      created_at: now,
      updated_at: now,
      last_strategy: 'weighted_random',
      round_robin_index: 0
    };

    service.set(instanceId, instance);
    this.logOperation('register', { namespace, name, instanceId });
    return { instanceId, created: true, instance };
  }

  getInstance(namespace, instanceId) {
    const ns = this.data.get(namespace);
    if (!ns) return null;
    
    for (const [serviceName, service] of ns) {
      if (service.has(instanceId)) {
        return service.get(instanceId);
      }
    }
    return null;
  }

  getInstanceAnyNamespace(instanceId) {
    for (const [namespace, ns] of this.data) {
      for (const [serviceName, service] of ns) {
        if (service.has(instanceId)) {
          return service.get(instanceId);
        }
      }
    }
    return null;
  }

  findInstances(namespace, serviceName, tags = null, tagMode = 'AND') {
    const service = this.getService(namespace, serviceName);
    if (!service) return [];

    let instances = Array.from(service.values());

    if (tags && tags.length > 0) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      instances = instances.filter(instance => {
        if (tagMode === 'AND') {
          return tagArray.every(tag => instance.tags.includes(tag));
        } else {
          return tagArray.some(tag => instance.tags.includes(tag));
        }
      });
    }

    return instances;
  }

  getAllInstances(namespace = null) {
    const results = [];
    
    for (const [nsName, ns] of this.data) {
      if (namespace && nsName !== namespace) continue;
      for (const [serviceName, service] of ns) {
        for (const [instanceId, instance] of service) {
          results.push(instance);
        }
      }
    }
    
    return results;
  }

  updateInstanceState(instanceId, newState, subState = null) {
    const instance = this.getInstanceAnyNamespace(instanceId);
    if (!instance) return false;

    const oldState = instance.current_state;
    const oldSubState = instance.sub_state;
    
    if (oldState === newState && oldSubState === subState) return false;

    instance.current_state = newState;
    instance.sub_state = subState;
    instance.last_transition_at = Date.now();
    
    this.logOperation('state_change', { 
      instanceId, 
      oldState, 
      newState, 
      oldSubState, 
      subState 
    });
    
    this.emitHealthChange(instanceId, oldState, newState);
    return true;
  }

  addHealthRecord(instanceId, status, latencyMs) {
    const instance = this.getInstanceAnyNamespace(instanceId);
    if (!instance) return false;

    instance.health_history.push({
      timestamp: Date.now(),
      status,
      latency_ms: latencyMs
    });

    if (instance.health_history.length > 50) {
      instance.health_history.shift();
    }

    if (status === 'pass') {
      instance.consecutive_success++;
      instance.consecutive_failures = 0;
    } else {
      instance.consecutive_failures++;
      instance.consecutive_success = 0;
      instance.total_failures++;
    }

    return true;
  }

  removeInstance(namespace, instanceId) {
    const ns = this.data.get(namespace);
    if (!ns) return false;

    for (const [serviceName, service] of ns) {
      if (service.has(instanceId)) {
        service.delete(instanceId);
        if (service.size === 0) {
          ns.delete(serviceName);
        }
        this.logOperation('unregister', { namespace, instanceId });
        return true;
      }
    }
    return false;
  }

  setDependencies(namespace, serviceName, dependencies) {
    const service = this.getService(namespace, serviceName);
    if (!service) return false;

    for (const [instanceId, instance] of service) {
      instance.dependencies = dependencies;
    }

    this.logOperation('set_dependencies', { namespace, serviceName, dependencies });
    return true;
  }

  getServiceDependencies(namespace, serviceName) {
    const service = this.getService(namespace, serviceName);
    if (!service || service.size === 0) return [];
    
    const firstInstance = Array.from(service.values())[0];
    return firstInstance.dependencies || [];
  }

  getDependents(namespace, serviceName) {
    const dependents = [];
    const ns = this.data.get(namespace);
    if (!ns) return dependents;

    for (const [sName, service] of ns) {
      if (sName === serviceName) continue;
      for (const [instanceId, instance] of service) {
        const deps = instance.dependencies || [];
        if (deps.some(d => d.name === serviceName)) {
          dependents.push({
            service_name: sName,
            instance_id: instanceId,
            dependencies: deps
          });
          break;
        }
      }
    }

    return dependents;
  }

  updateMetadata(instanceId, metadataPatch) {
    const instance = this.getInstanceAnyNamespace(instanceId);
    if (!instance) return false;

    instance.metadata = {
      ...instance.metadata,
      ...metadataPatch
    };
    instance.updated_at = Date.now();
    
    this.logOperation('metadata_update', { instanceId, metadataPatch });
    return true;
  }

  addMetrics(instanceId, requestsCount, avgLatencyMs, errorCount) {
    const instance = this.getInstanceAnyNamespace(instanceId);
    if (!instance) return false;

    instance.metrics.push({
      timestamp: Date.now(),
      requests_count: requestsCount,
      avg_latency_ms: avgLatencyMs,
      error_count: errorCount
    });

    if (instance.metrics.length > 60) {
      instance.metrics.shift();
    }

    return true;
  }

  getNamespaces() {
    return Array.from(this.data.keys());
  }

  getHealthyCount(namespace, serviceName) {
    const instances = this.findInstances(namespace, serviceName);
    return instances.filter(i => 
      i.current_state === 'healthy' && i.sub_state !== 'degraded' && i.sub_state !== 'dead'
    ).length;
  }

  exportData() {
    const result = {};
    
    for (const [namespace, ns] of this.data) {
      result[namespace] = {};
      for (const [serviceName, service] of ns) {
        result[namespace][serviceName] = {};
        for (const [instanceId, instance] of service) {
          result[namespace][serviceName][instanceId] = JSON.parse(JSON.stringify(instance));
        }
      }
    }

    return {
      data: result,
      operation_logs: this.operationLogs,
      exported_at: Date.now()
    };
  }

  importData(exportData) {
    this.data.clear();
    this.operationLogs = [];

    if (!exportData || !exportData.data) return false;

    for (const [namespace, nsData] of Object.entries(exportData.data)) {
      const ns = new Map();
      for (const [serviceName, serviceData] of Object.entries(nsData)) {
        const service = new Map();
        for (const [instanceId, instance] of Object.entries(serviceData)) {
          service.set(instanceId, instance);
        }
        ns.set(serviceName, service);
      }
      this.data.set(namespace, ns);
    }

    if (exportData.operation_logs) {
      this.operationLogs = exportData.operation_logs;
    }

    this.logOperation('import', { timestamp: Date.now() });
    return true;
  }
}

module.exports = new ServiceRegistry();
