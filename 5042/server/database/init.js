const Datastore = require('@seald-io/nedb');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = {
  hosts: new Datastore({ filename: path.join(dbDir, 'hosts.db'), autoload: true }),
  metrics: new Datastore({ filename: path.join(dbDir, 'metrics.db'), autoload: true }),
  alertRules: new Datastore({ filename: path.join(dbDir, 'alertRules.db'), autoload: true }),
  alerts: new Datastore({ filename: path.join(dbDir, 'alerts.db'), autoload: true }),
  templates: new Datastore({ filename: path.join(dbDir, 'templates.db'), autoload: true }),
  dashboards: new Datastore({ filename: path.join(dbDir, 'dashboards.db'), autoload: true }),
  notificationChannels: new Datastore({ filename: path.join(dbDir, 'notificationChannels.db'), autoload: true })
};

db.metrics.ensureIndex({ fieldName: 'host_id' });
db.metrics.ensureIndex({ fieldName: 'metric_name' });
db.metrics.ensureIndex({ fieldName: 'timestamp' });

function promisifyCursor(cursor) {
  return new Promise((resolve, reject) => {
    cursor.exec((err, docs) => {
      if (err) reject(err);
      else resolve(docs);
    });
  });
}

function promisifyDb(db, method, ...args) {
  return new Promise((resolve, reject) => {
    db[method](...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function initDatabase() {
  const templateCount = await promisifyDb(db.templates, 'count', {});
  
  if (templateCount === 0) {
    const templates = [
      {
        name: 'Linux基础监控',
        description: 'Linux服务器基础监控项配置',
        config: {
          metrics: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_in', 'network_out', 'process_count'],
          rules: [
            { metric_name: 'cpu_usage', threshold: 80, operator: '>', duration: 300 },
            { metric_name: 'memory_usage', threshold: 90, operator: '>', duration: 180 },
            { metric_name: 'disk_usage', threshold: 85, operator: '>', duration: 600 }
          ]
        },
        created_at: new Date().toISOString()
      },
      {
        name: 'Windows基础监控',
        description: 'Windows服务器基础监控项配置',
        config: {
          metrics: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_in', 'network_out', 'process_count'],
          rules: [
            { metric_name: 'cpu_usage', threshold: 80, operator: '>', duration: 300 },
            { metric_name: 'memory_usage', threshold: 90, operator: '>', duration: 180 }
          ]
        },
        created_at: new Date().toISOString()
      }
    ];

    for (const tpl of templates) {
      await promisifyDb(db.templates, 'insert', tpl);
    }
  }

  const hostCount = await promisifyDb(db.hosts, 'count', {});
  if (hostCount === 0) {
    const agentKey = crypto.randomBytes(32).toString('hex');
    await promisifyDb(db.hosts, 'insert', {
      hostname: 'localhost',
      ip: '127.0.0.1',
      os: process.platform,
      status: 'online',
      agent_key: agentKey,
      created_at: new Date().toISOString(),
      last_heartbeat: null
    });
  }

  console.log('Database initialized successfully');
}

module.exports = { db, initDatabase, promisifyDb, promisifyCursor };
