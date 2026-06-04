const nodemailer = require('nodemailer');
const axios = require('axios');

let emailTransporter = null;
let dingtalkConfig = null;

function init(config) {
  if (config.email) {
    emailTransporter = nodemailer.createTransport(config.email);
  }
  if (config.dingtalk) {
    dingtalkConfig = config.dingtalk;
  }
}

async function sendEmail(alert) {
  if (!emailTransporter) return false;
  
  try {
    await emailTransporter.sendMail({
      from: 'monitor@example.com',
      to: 'admin@example.com',
      subject: `[告警] ${alert.metricName} 阈值触发`,
      text: `告警ID: ${alert.alertId}\n主机ID: ${alert.hostId}\n指标: ${alert.metricName}\n当前值: ${alert.metricValue}\n阈值: ${alert.threshold}\n时间: ${new Date().toISOString()}`
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

async function sendDingtalk(alert) {
  if (!dingtalkConfig) return false;
  
  try {
    const message = {
      msgtype: 'markdown',
      markdown: {
        title: '系统监控告警',
        text: `### 系统监控告警\n\n- **告警ID**: ${alert.alertId}\n- **指标**: ${alert.metricName}\n- **当前值**: ${alert.metricValue}%\n- **阈值**: ${alert.threshold}%\n- **时间**: ${new Date().toLocaleString()}`
      }
    };
    
    await axios.post(dingtalkConfig.webhook, message);
    return true;
  } catch (err) {
    console.error('Dingtalk send error:', err);
    return false;
  }
}

async function sendSMS(alert) {
  console.log('SMS notification:', alert);
  return true;
}

async function sendAlertNotification(alert) {
  const results = await Promise.allSettled([
    sendEmail(alert),
    sendDingtalk(alert),
    sendSMS(alert)
  ]);
  
  console.log('Notification sent:', {
    alert,
    results: results.map(r => r.status)
  });
}

module.exports = { init, sendAlertNotification, sendEmail, sendDingtalk, sendSMS };
