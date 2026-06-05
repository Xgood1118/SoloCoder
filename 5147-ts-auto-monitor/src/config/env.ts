import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export interface EnvConfig {
  port: number;
  host: string;
  nodeEnv: string;
  logLevel: string;
  logDir: string;
  collectionInterval: number;
  metricRetentionDays: number;
  alertRulesFile: string;
  ruleReloadInterval: number;
  dbType: string;
  dbPath: string;
  wechatWorkWebhook: string;
  wechatWorkEnabled: boolean;
  dingtalkWebhook: string;
  dingtalkEnabled: boolean;
  dingtalkSecret: string;
  emailSmtpHost: string;
  emailSmtpPort: number;
  emailSmtpSecure: boolean;
  emailUser: string;
  emailPassword: string;
  emailFrom: string;
  emailTo: string;
  emailEnabled: boolean;
  webhookUrl: string;
  webhookEnabled: boolean;
  webhookMethod: string;
  webhookTimeout: number;
  prometheusEnabled: boolean;
  prometheusPrefix: string;
  instanceId: string;
  serviceName: string;
  env: string;
  businessMetricsApi: string;
  businessMetricsTimeout: number;
}

const DEFAULT_CONFIG: EnvConfig = {
  port: 3000,
  host: 'localhost',
  nodeEnv: 'development',
  logLevel: 'info',
  logDir: './logs',
  collectionInterval: 15000,
  metricRetentionDays: 7,
  alertRulesFile: './config/alert-rules.txt',
  ruleReloadInterval: 30000,
  dbType: 'sqlite',
  dbPath: './data/metrics.db',
  wechatWorkWebhook: '',
  wechatWorkEnabled: false,
  dingtalkWebhook: '',
  dingtalkEnabled: false,
  dingtalkSecret: '',
  emailSmtpHost: 'smtp.example.com',
  emailSmtpPort: 587,
  emailSmtpSecure: false,
  emailUser: '',
  emailPassword: '',
  emailFrom: 'monitor@example.com',
  emailTo: '',
  emailEnabled: false,
  webhookUrl: '',
  webhookEnabled: false,
  webhookMethod: 'POST',
  webhookTimeout: 5000,
  prometheusEnabled: true,
  prometheusPrefix: 'monitor_',
  instanceId: 'monitor-01',
  serviceName: 'ts-auto-monitor',
  env: 'development',
  businessMetricsApi: 'http://localhost:8080/metrics',
  businessMetricsTimeout: 5000,
};

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

function loadFromEnvFile(): Record<string, string | undefined> {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    return {};
  }
  return result.parsed || {};
}

function mergeConfig(envVars: Record<string, string | undefined>, cliArgs: Record<string, string>): EnvConfig {
  const config = { ...DEFAULT_CONFIG };

  config.port = parseNumber(cliArgs.port || envVars.PORT, config.port);
  config.host = cliArgs.host || envVars.HOST || config.host;
  config.nodeEnv = cliArgs.nodeEnv || envVars.NODE_ENV || config.nodeEnv;
  config.logLevel = cliArgs.logLevel || envVars.LOG_LEVEL || config.logLevel;
  config.logDir = cliArgs.logDir || envVars.LOG_DIR || config.logDir;
  config.collectionInterval = parseNumber(cliArgs.collectionInterval || envVars.COLLECTION_INTERVAL, config.collectionInterval);
  config.metricRetentionDays = parseNumber(cliArgs.metricRetentionDays || envVars.METRIC_RETENTION_DAYS, config.metricRetentionDays);
  config.alertRulesFile = cliArgs.alertRulesFile || envVars.ALERT_RULES_FILE || config.alertRulesFile;
  config.ruleReloadInterval = parseNumber(cliArgs.ruleReloadInterval || envVars.RULE_RELOAD_INTERVAL, config.ruleReloadInterval);
  config.dbType = cliArgs.dbType || envVars.DB_TYPE || config.dbType;
  config.dbPath = cliArgs.dbPath || envVars.DB_PATH || config.dbPath;
  config.wechatWorkWebhook = cliArgs.wechatWorkWebhook || envVars.WECHAT_WORK_WEBHOOK || config.wechatWorkWebhook;
  config.wechatWorkEnabled = parseBoolean(cliArgs.wechatWorkEnabled || envVars.WECHAT_WORK_ENABLED, config.wechatWorkEnabled);
  config.dingtalkWebhook = cliArgs.dingtalkWebhook || envVars.DINGTALK_WEBHOOK || config.dingtalkWebhook;
  config.dingtalkEnabled = parseBoolean(cliArgs.dingtalkEnabled || envVars.DINGTALK_ENABLED, config.dingtalkEnabled);
  config.dingtalkSecret = cliArgs.dingtalkSecret || envVars.DINGTALK_SECRET || config.dingtalkSecret;
  config.emailSmtpHost = cliArgs.emailSmtpHost || envVars.EMAIL_SMTP_HOST || config.emailSmtpHost;
  config.emailSmtpPort = parseNumber(cliArgs.emailSmtpPort || envVars.EMAIL_SMTP_PORT, config.emailSmtpPort);
  config.emailSmtpSecure = parseBoolean(cliArgs.emailSmtpSecure || envVars.EMAIL_SMTP_SECURE, config.emailSmtpSecure);
  config.emailUser = cliArgs.emailUser || envVars.EMAIL_USER || config.emailUser;
  config.emailPassword = cliArgs.emailPassword || envVars.EMAIL_PASSWORD || config.emailPassword;
  config.emailFrom = cliArgs.emailFrom || envVars.EMAIL_FROM || config.emailFrom;
  config.emailTo = cliArgs.emailTo || envVars.EMAIL_TO || config.emailTo;
  config.emailEnabled = parseBoolean(cliArgs.emailEnabled || envVars.EMAIL_ENABLED, config.emailEnabled);
  config.webhookUrl = cliArgs.webhookUrl || envVars.WEBHOOK_URL || config.webhookUrl;
  config.webhookEnabled = parseBoolean(cliArgs.webhookEnabled || envVars.WEBHOOK_ENABLED, config.webhookEnabled);
  config.webhookMethod = cliArgs.webhookMethod || envVars.WEBHOOK_METHOD || config.webhookMethod;
  config.webhookTimeout = parseNumber(cliArgs.webhookTimeout || envVars.WEBHOOK_TIMEOUT, config.webhookTimeout);
  config.prometheusEnabled = parseBoolean(cliArgs.prometheusEnabled || envVars.PROMETHEUS_ENABLED, config.prometheusEnabled);
  config.prometheusPrefix = cliArgs.prometheusPrefix || envVars.PROMETHEUS_PREFIX || config.prometheusPrefix;
  config.instanceId = cliArgs.instanceId || envVars.INSTANCE_ID || config.instanceId;
  config.serviceName = cliArgs.serviceName || envVars.SERVICE_NAME || config.serviceName;
  config.env = cliArgs.env || envVars.ENV || config.env;
  config.businessMetricsApi = cliArgs.businessMetricsApi || envVars.BUSINESS_METRICS_API || config.businessMetricsApi;
  config.businessMetricsTimeout = parseNumber(cliArgs.businessMetricsTimeout || envVars.BUSINESS_METRICS_TIMEOUT, config.businessMetricsTimeout);

  return config;
}

function parseCliArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  process.argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value !== undefined) {
        args[key] = value;
      }
    }
  });
  return args;
}

const envFileVars = loadFromEnvFile();
const cliArgs = parseCliArgs();
const config = mergeConfig(envFileVars, cliArgs);

export default config;
