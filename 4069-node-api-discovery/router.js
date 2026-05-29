const registry = require('./registry');

class ServiceRouter {
  constructor() {
    this.dependencyInterval = parseInt(process.env.DEPENDENCY_INTERVAL_MS, 10) || 30000;
    this.dependencyTimer = null;
  }

  setDependencies(namespace, serviceName, dependencies) {
    for (const dep of dependencies) {
      if (!registry.getService(namespace, dep.name)) {
        return {
          error: `Dependency service ${dep.name} not found in namespace ${namespace}`,
          code: 400
        };
      }
    }

    registry.setDependencies(namespace, serviceName, dependencies);
    this.checkServiceDependencies(namespace, serviceName);
    return { success: true };
  }

  deleteDependencies(namespace, serviceName) {
    registry.setDependencies(namespace, serviceName, []);
    
    const instances = registry.findInstances(namespace, serviceName);
    for (const instance of instances) {
      if (instance.sub_state === 'degraded') {
        registry.updateInstanceState(instance.instance_id, 'healthy', null);
      }
    }
    
    return { success: true };
  }

  checkServiceDependencies(namespace, serviceName) {
    const dependencies = registry.getServiceDependencies(namespace, serviceName);
    if (dependencies.length === 0) return;

    let allDepsSatisfied = true;
    const depStatus = [];

    for (const dep of dependencies) {
      const healthyCount = registry.getHealthyCount(namespace, dep.name);
      const satisfied = healthyCount >= dep.min_healthy;
      if (!satisfied) {
        allDepsSatisfied = false;
      }
      depStatus.push({
        name: dep.name,
        min_healthy: dep.min_healthy,
        current_healthy: healthyCount,
        satisfied
      });
    }

    const instances = registry.findInstances(namespace, serviceName);
    for (const instance of instances) {
      if (instance.current_state === 'healthy' || instance.sub_state === 'degraded') {
        if (!allDepsSatisfied) {
          registry.updateInstanceState(instance.instance_id, 'healthy', 'degraded');
        } else if (instance.sub_state === 'degraded') {
          registry.updateInstanceState(instance.instance_id, 'healthy', null);
        }
      }
    }

    return {
      service: serviceName,
      namespace,
      all_deps_satisfied: allDepsSatisfied,
      dependencies: depStatus
    };
  }

  checkAllDependencies() {
    const results = [];
    const namespaces = registry.getNamespaces();

    for (const namespace of namespaces) {
      const ns = registry.getNamespace(namespace);
      if (!ns) continue;

      for (const [serviceName] of ns) {
        const result = this.checkServiceDependencies(namespace, serviceName);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  startDependencyChecker() {
    if (this.dependencyTimer) return;
    this.dependencyTimer = setInterval(() => this.checkAllDependencies(), this.dependencyInterval);
    console.log(`Dependency checker started, interval: ${this.dependencyInterval}ms`);
  }

  stopDependencyChecker() {
    if (this.dependencyTimer) {
      clearInterval(this.dependencyTimer);
      this.dependencyTimer = null;
      console.log('Dependency checker stopped');
    }
  }

  canRemoveInstance(namespace, instanceId) {
    const instance = registry.getInstance(namespace, instanceId);
    if (!instance) return { canRemove: false, error: 'Instance not found', code: 404 };

    const dependents = registry.getDependents(namespace, instance.service_name);
    if (dependents.length > 0) {
      const depInfo = dependents.map(d => {
        const dep = d.dependencies.find(dep => dep.name === instance.service_name);
        const currentHealthy = registry.getHealthyCount(namespace, instance.service_name);
        return {
          dependent_service: d.service_name,
          min_healthy: dep ? dep.min_healthy : 0,
          current_healthy: currentHealthy,
          after_removal: currentHealthy - 1
        };
      });

      const wouldViolate = depInfo.some(d => d.after_removal < d.min_healthy);
      if (wouldViolate) {
        return {
          canRemove: false,
          error: 'Cannot remove instance: service has dependents that require minimum healthy instances',
          code: 409,
          details: depInfo
        };
      }
    }

    return { canRemove: true };
  }

  batchRegister(namespace, services) {
    const results = [];
    
    for (const svc of services) {
      if (!svc.name || !svc.host || typeof svc.port !== 'number') {
        return {
          error: 'Invalid service data: name, host, and port are required',
          code: 400
        };
      }
    }

    for (const svc of services) {
      const result = registry.registerInstance(
        namespace,
        svc.name,
        svc.host,
        svc.port,
        svc.tags || [],
        svc.metadata || {}
      );
      results.push({
        name: svc.name,
        instance_id: result.instanceId,
        created: result.created
      });
    }

    return { results };
  }

  batchUnregister(namespace, instanceIds) {
    const results = [];
    const errors = [];

    for (const instanceId of instanceIds) {
      const checkResult = this.canRemoveInstance(namespace, instanceId);
      if (!checkResult.canRemove) {
        errors.push({
          instance_id: instanceId,
          error: checkResult.error,
          details: checkResult.details
        });
        continue;
      }

      const removed = registry.removeInstance(namespace, instanceId);
      results.push({
        instance_id: instanceId,
        removed
      });
    }

    if (errors.length > 0) {
      return {
        error: 'Some instances could not be removed',
        code: 409,
        success: results,
        failed: errors
      };
    }

    return { results };
  }

  getNamespaces() {
    return registry.getNamespaces();
  }

  exportData() {
    return registry.exportData();
  }

  importData(data) {
    return registry.importData(data);
  }
}

module.exports = new ServiceRouter();
