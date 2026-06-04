const { db, promisifyDb } = require('../database/init');
const notificationService = require('./notificationService');

const alertState = {};

function checkThreshold(value, threshold, operator) {
  switch (operator) {
    case '>': return value > threshold;
    case '>=': return value >= threshold;
    case '<': return value < threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    default: return value > threshold;
  }
}

function checkAlertRule(hostId, rule, metricValue) {
  const key = `${hostId}-${rule._id}`;
  
  if (!alertState[key]) {
    alertState[key] = {
      consecutiveCount: 0,
      firstTriggerTime: null,
      isTriggered: false
    };
  }

  const state = alertState[key];
  const isOverThreshold = checkThreshold(metricValue, rule.threshold, rule.operator);

  if (isOverThreshold) {
    state.consecutiveCount++;
    if (!state.firstTriggerTime) {
      state.firstTriggerTime = Date.now();
    }

    const durationReached = (Date.now() - state.firstTriggerTime) >= rule.duration * 1000;
    const consecutiveReached = state.consecutiveCount >= rule.consecutive_count;

    if ((durationReached || consecutiveReached) && !state.isTriggered) {
      state.isTriggered = true;
      return true;
    }
  } else {
    state.consecutiveCount = 0;
    state.firstTriggerTime = null;
    if (state.isTriggered) {
      state.isTriggered = false;
      resolveAlert(hostId, rule._id);
    }
  }

  return false;
}

async function triggerAlert(hostId, rule, metricValue) {
  const existing = await promisifyDb(db.alerts, 'findOne', { 
    host_id: hostId, 
    rule_id: rule._id, 
    status: 'triggered' 
  });
  
  if (existing) return null;

  const alert = await promisifyDb(db.alerts, 'insert', {
    host_id: hostId,
    rule_id: rule._id,
    metric_name: rule.metric_name,
    metric_value: metricValue,
    threshold: rule.threshold,
    status: 'triggered',
    triggered_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    acknowledged_by: null,
    resolved_by: null,
    note: ''
  });
  
  notificationService.sendAlertNotification({
    alertId: alert._id,
    hostId,
    metricName: rule.metric_name,
    metricValue,
    threshold: rule.threshold
  });
  
  return alert._id;
}

async function resolveAlert(hostId, ruleId) {
  await promisifyDb(db.alerts, 'update', 
    { host_id: hostId, rule_id: ruleId, status: 'triggered' },
    { $set: { status: 'resolved', resolved_at: new Date().toISOString() } },
    { multi: true }
  );
}

async function processMetric(hostId, metricName, metricValue) {
  const rules = await promisifyDb(db.alertRules, 'find', { 
    metric_name: metricName, 
    enabled: 1,
    $or: [{ host_id: hostId }, { host_id: null }]
  });

  for (const rule of rules) {
    if (checkAlertRule(hostId, rule, metricValue)) {
      await triggerAlert(hostId, rule, metricValue);
    }
  }
}

async function acknowledgeAlert(alertId, userId) {
  const result = await promisifyDb(db.alerts, 'update', 
    { _id: alertId, status: 'triggered' },
    { $set: { 
      status: 'acknowledged', 
      acknowledged_at: new Date().toISOString(), 
      acknowledged_by: userId 
    } }
  );
  return result > 0;
}

async function resolveAlertById(alertId, userId, note = '') {
  const result = await promisifyDb(db.alerts, 'update', 
    { _id: alertId },
    { $set: { 
      status: 'resolved', 
      resolved_at: new Date().toISOString(), 
      resolved_by: userId,
      note: note
    } }
  );
  return result > 0;
}

module.exports = { processMetric, acknowledgeAlert, resolveAlertById, triggerAlert, resolveAlert };
