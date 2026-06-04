const si = require('systeminformation');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
let config = {};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
  config = {
    serverUrl: process.env.SERVER_URL || 'http://localhost:8080',
    agentKey: process.env.AGENT_KEY || 'your-agent-key-here',
    interval: parseInt(process.env.INTERVAL || '60', 10),
    metrics: ['cpu', 'memory', 'disk', 'network', 'process']
  };
}

const api = axios.create({
  baseURL: config.serverUrl,
  headers: {
    'x-agent-key': config.agentKey,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

async function collectMetrics() {
  const metrics = [];
  const timestamp = new Date().toISOString();

  try {
    if (config.metrics.includes('cpu')) {
      try {
        const cpu = await si.currentLoad();
        metrics.push({ name: 'cpu_usage', value: parseFloat(cpu.currentLoad.toFixed(2)), timestamp });
      } catch (e) {
        console.log('CPU collect error:', e.message);
      }
    }

    if (config.metrics.includes('memory')) {
      try {
        const mem = await si.mem();
        const memUsage = ((mem.used / mem.total) * 100).toFixed(2);
        metrics.push({ name: 'memory_usage', value: parseFloat(memUsage), timestamp });
        metrics.push({ name: 'memory_used', value: parseFloat((mem.used / 1024 / 1024 / 1024).toFixed(2)), timestamp });
        metrics.push({ name: 'memory_total', value: parseFloat((mem.total / 1024 / 1024 / 1024).toFixed(2)), timestamp });
      } catch (e) {
        console.log('Memory collect error:', e.message);
      }
    }

    if (config.metrics.includes('disk')) {
      try {
        const disks = await si.fsSize();
        disks.forEach((disk) => {
          metrics.push({ name: `disk_usage`, value: parseFloat(disk.use.toFixed(2)), timestamp });
        });
      } catch (e) {
        console.log('Disk collect error:', e.message);
      }
    }

    if (config.metrics.includes('network')) {
      try {
        const network = await si.networkStats();
        if (network.length > 0) {
          const rx = network[0].rx_sec || 0;
          const tx = network[0].tx_sec || 0;
          metrics.push({ name: 'network_in', value: parseFloat((rx / 1024).toFixed(2)), timestamp });
          metrics.push({ name: 'network_out', value: parseFloat((tx / 1024).toFixed(2)), timestamp });
        }
      } catch (e) {
        console.log('Network collect error:', e.message);
      }
    }

    if (config.metrics.includes('process')) {
      try {
        const processes = await si.processes();
        metrics.push({ name: 'process_count', value: processes.all, timestamp });
        metrics.push({ name: 'process_running', value: processes.running, timestamp });
      } catch (e) {
        console.log('Process collect error:', e.message);
      }
    }

  } catch (error) {
    console.error('Error collecting metrics:', error.message);
  }

  return metrics;
}

async function sendMetrics(metrics) {
  try {
    const response = await api.post('/agent/metrics', { metrics });
    console.log(`[${new Date().toLocaleTimeString()}] Sent ${metrics.length} metrics - Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error('Error sending metrics:', error.message);
    return false;
  }
}

async function fetchConfig() {
  try {
    const response = await api.get('/agent/config');
    if (response.data.interval) {
      config.interval = response.data.interval;
    }
    console.log('Agent config updated');
  } catch (error) {
    console.error('Error fetching config:', error.message);
  }
}

async function run() {
  console.log('Starting monitoring agent...');
  console.log(`Server: ${config.serverUrl}`);
  console.log(`Interval: ${config.interval}s`);
  console.log(`Metrics: ${config.metrics.join(', ')}`);

  await fetchConfig();

  console.log('Collecting first batch of metrics...');
  const metrics = await collectMetrics();
  console.log(`Collected ${metrics.length} metrics`);
  await sendMetrics(metrics);

  setInterval(async () => {
    try {
      const m = await collectMetrics();
      await sendMetrics(m);
    } catch (e) {
      console.error('Interval error:', e.message);
    }
  }, config.interval * 1000);

  console.log('Agent running, metrics will be sent every', config.interval, 'seconds');
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

module.exports = { collectMetrics, sendMetrics };
