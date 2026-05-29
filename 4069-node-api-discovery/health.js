const net = require('net');
const registry = require('./registry');

class HealthChecker {
  constructor() {
    this.interval = parseInt(process.env.HEALTH_INTERVAL_MS, 10) || 15000;
    this.timeout = 3000;
    this.timer = null;
    this.running = false;
  }

  async checkTcpPort(host, port) {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      
      socket.setTimeout(this.timeout);
      
      socket.on('connect', () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ status: 'pass', latency });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ status: 'fail', latency: this.timeout });
      });
      
      socket.on('error', () => {
        const latency = Date.now() - start;
        resolve({ status: 'fail', latency });
      });
      
      socket.connect(port, host);
    });
  }

  processStateChange(instance, checkResult) {
    const { instance_id, current_state, sub_state, consecutive_success, consecutive_failures } = instance;

    if (current_state === 'removed') return;

    if (current_state === 'pending') {
      if (checkResult.status === 'pass') {
        registry.updateInstanceState(instance_id, 'healthy', null);
      } else if (consecutive_failures >= 2) {
        registry.updateInstanceState(instance_id, 'unhealthy', null);
      }
    } else if (current_state === 'healthy') {
      if (sub_state === 'dead') return;
      
      if (checkResult.status === 'fail' && consecutive_failures >= 3) {
        registry.updateInstanceState(instance_id, 'unhealthy', null);
      }
      
      if (consecutive_failures >= 10) {
        registry.updateInstanceState(instance_id, 'unhealthy', 'dead');
      }
    } else if (current_state === 'unhealthy') {
      if (sub_state === 'dead') return;
      
      if (checkResult.status === 'pass' && consecutive_success >= 2) {
        registry.updateInstanceState(instance_id, 'healthy', null);
      }
      
      if (consecutive_failures >= 10) {
        registry.updateInstanceState(instance_id, 'unhealthy', 'dead');
      }
    } else if (current_state === 'draining') {
      return;
    }
  }

  async checkInstance(instance) {
    const result = await this.checkTcpPort(instance.host, instance.port);
    registry.addHealthRecord(instance.instance_id, result.status, result.latency);
    
    const updatedInstance = registry.getInstanceAnyNamespace(instance.instance_id);
    if (updatedInstance) {
      this.processStateChange(updatedInstance, result);
    }
    
    return result;
  }

  async runChecks() {
    if (this.running) return;
    this.running = true;

    try {
      const allInstances = registry.getAllInstances();
      const instancesToCheck = allInstances.filter(i => 
        i.current_state !== 'removed' && i.sub_state !== 'dead'
      );

      for (const instance of instancesToCheck) {
        await this.checkInstance(instance);
      }
    } catch (error) {
      console.error('Health check error:', error);
    } finally {
      this.running = false;
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.runChecks(), this.interval);
    console.log(`Health checker started, interval: ${this.interval}ms`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('Health checker stopped');
    }
  }
}

module.exports = new HealthChecker();
