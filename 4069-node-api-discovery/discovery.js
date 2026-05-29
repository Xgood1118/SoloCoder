const registry = require('./registry');

class ServiceDiscovery {
  getAvailableInstances(namespace, serviceName, tags = null, tagMode = 'AND') {
    const instances = registry.findInstances(namespace, serviceName, tags, tagMode);
    return instances.filter(i => 
      i.current_state === 'healthy' && 
      i.sub_state !== 'degraded' && 
      i.sub_state !== 'dead' &&
      i.current_state !== 'draining'
    );
  }

  weightedRandom(instances) {
    if (instances.length === 0) return null;
    
    const totalWeight = instances.reduce((sum, i) => sum + (i.metadata.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    let selected = null;
    for (const instance of instances) {
      random -= (instance.metadata.weight || 1);
      if (random <= 0) {
        selected = instance;
        break;
      }
    }
    
    if (!selected) {
      selected = instances[instances.length - 1];
    }
    
    selected.metadata.weight = Math.max(0, (selected.metadata.weight || 1) - 1);
    instances.forEach(i => {
      if (i !== selected) {
        i.metadata.weight = (i.metadata.weight || 1) + 0.5;
      }
    });
    
    selected.last_strategy = 'weighted_random';
    return selected;
  }

  roundRobin(instances) {
    if (instances.length === 0) return null;
    
    instances.sort((a, b) => a.instance_id.localeCompare(b.instance_id));
    
    const firstInstance = instances[0];
    let index = firstInstance.round_robin_index || 0;
    const selected = instances[index % instances.length];
    
    instances.forEach(i => {
      i.round_robin_index = (index + 1) % instances.length;
      i.last_strategy = 'round_robin';
    });
    
    return selected;
  }

  leastConnections(instances) {
    if (instances.length === 0) return null;
    
    const instancesWithLatency = instances.map(instance => {
      const recentHistory = instance.health_history.slice(-5);
      let avgLatency = Infinity;
      
      if (recentHistory.length > 0) {
        const totalLatency = recentHistory.reduce((sum, h) => sum + h.latency_ms, 0);
        avgLatency = totalLatency / recentHistory.length;
      }
      
      if (instance.metrics.length > 0) {
        const recentMetrics = instance.metrics.slice(-1)[0];
        avgLatency = (avgLatency + recentMetrics.avg_latency_ms) / 2;
      }
      
      return { instance, avgLatency };
    });
    
    instancesWithLatency.sort((a, b) => a.avgLatency - b.avgLatency);
    
    const bestInstances = instancesWithLatency.filter(i => 
      i.avgLatency === instancesWithLatency[0].avgLatency
    );
    
    const selected = bestInstances[Math.floor(Math.random() * bestInstances.length)].instance;
    selected.last_strategy = 'least_connections';
    return selected;
  }

  discover(namespace, serviceName, strategy = 'weighted_random', tags = null, tagMode = 'AND') {
    const instances = this.getAvailableInstances(namespace, serviceName, tags, tagMode);
    
    if (instances.length === 0) {
      if (tags && tags.length > 0) {
        return { error: 'no instances match tags', code: 404 };
      }
      return { error: 'no healthy instances available', code: 404 };
    }
    
    let selected;
    switch (strategy) {
      case 'round_robin':
        selected = this.roundRobin(instances);
        break;
      case 'least_connections':
        selected = this.leastConnections(instances);
        break;
      case 'weighted_random':
      default:
        selected = this.weightedRandom(instances);
        break;
    }
    
    if (!selected) {
      return { error: 'no healthy instances available', code: 404 };
    }
    
    return {
      instance_id: selected.instance_id,
      service_name: selected.service_name,
      host: selected.host,
      port: selected.port,
      tags: selected.tags,
      metadata: selected.metadata,
      strategy_used: strategy
    };
  }

  discoverAll(namespace, serviceName, tags = null, tagMode = 'AND') {
    const instances = this.getAvailableInstances(namespace, serviceName, tags, tagMode);
    
    if (instances.length === 0) {
      if (tags && tags.length > 0) {
        return { error: 'no instances match tags', code: 404 };
      }
      return { error: 'no healthy instances available', code: 404 };
    }
    
    return instances.map(i => ({
      instance_id: i.instance_id,
      service_name: i.service_name,
      host: i.host,
      port: i.port,
      tags: i.tags,
      metadata: i.metadata,
      current_state: i.current_state,
      sub_state: i.sub_state
    }));
  }
}

module.exports = new ServiceDiscovery();
