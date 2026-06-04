const path = require('path');
const fs = require('fs');

module.exports = {
  server: {
    port: process.env.PORT || 8443,
    host: process.env.HOST || '0.0.0.0',
    tls: {
      key: fs.readFileSync(path.join(__dirname, '../../certs/server-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../../certs/server-cert.pem')),
      rejectUnauthorized: false
    }
  },
  agent: {
    defaultInterval: 60,
    minInterval: 1,
    maxInterval: 3600
  },
  alert: {
    checkInterval: 30,
    defaultChannels: ['email', 'dingtalk']
  },
  retention: {
    metricsDays: 30,
    alertsDays: 90
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'monitor-secret-key-change-in-production',
    expiresIn: '24h'
  }
};
