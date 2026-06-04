const { db, promisifyDb } = require('../database/init');

async function authenticateAgent(req, res, next) {
  const agentKey = req.headers['x-agent-key'];
  
  if (!agentKey) {
    return res.status(401).json({ error: 'Agent key required' });
  }

  try {
    const host = await promisifyDb(db.hosts, 'findOne', { agent_key: agentKey });
    
    if (!host) {
      return res.status(401).json({ error: 'Invalid agent key' });
    }
    if (host.status !== 'online') {
      return res.status(403).json({ error: 'Agent is disabled' });
    }
    
    req.agentHost = host;
    await promisifyDb(db.hosts, 'update', 
      { _id: host._id }, 
      { $set: { last_heartbeat: new Date().toISOString() } }
    );
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
}

function authenticateApi(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === 'admin-api-key-change-in-production') {
    req.user = { id: 1, role: 'admin' };
    return next();
  }
  next();
}

module.exports = { authenticateAgent, authenticateApi };
