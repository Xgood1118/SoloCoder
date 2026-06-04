const express = require('express');
const http = require('http');
const cors = require('cors');
const { initDatabase } = require('./database/init');
const notificationService = require('./services/notificationService');

const agentRoutes = require('./routes/agent');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 8200;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

app.use('/agent', agentRoutes);
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initDatabase();
notificationService.init({});

const server = http.createServer(app);

const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Monitor server running on http://${HOST}:${PORT}`);
});

module.exports = { app, server, wss };
