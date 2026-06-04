"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const yargs = __importStar(require("yargs"));
const defaults_1 = require("./defaults");
class ConfigManager {
    constructor(initialConfig) {
        this.configSources = new Map();
        this.initialConfig = initialConfig || {};
        this.config = this.deepMerge(defaults_1.defaultConfig, this.initialConfig);
    }
    async load(options = {}) {
        const fileConfig = await this.loadFromFile(options);
        const cliConfig = this.loadFromCli();
        const envConfig = this.loadFromEnvironment(options.prefix);
        this.trackConfigSources(this.initialConfig, 'programmatic');
        this.config = this.deepMerge(defaults_1.defaultConfig, this.initialConfig, fileConfig, cliConfig, envConfig);
        return this.config;
    }
    async loadFromFile(options) {
        const configPath = options.configPath || this.getDefaultConfigPath();
        if (!configPath || !fs.existsSync(configPath)) {
            return {};
        }
        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            const format = options.format || this.detectFormat(configPath);
            const config = this.parseConfig(content, format);
            this.trackConfigSources(config, 'file');
            return config;
        }
        catch (error) {
            console.warn(`Failed to load config from file: ${configPath}`, error);
            return {};
        }
    }
    loadFromCli() {
        try {
            const argv = yargs
                .option('service-name', { type: 'string' })
                .option('environment', { type: 'string' })
                .option('log-level', { type: 'string', choices: ['debug', 'info', 'warn', 'error'] })
                .option('log-targets', { type: 'string' })
                .option('http-base-url', { type: 'string' })
                .option('http-timeout', { type: 'number' })
                .option('retry-max-retries', { type: 'number' })
                .option('health-check-enabled', { type: 'boolean' })
                .parseSync();
            const cliConfig = {};
            if (argv['service-name'])
                cliConfig.serviceName = argv['service-name'];
            if (argv['environment'])
                cliConfig.environment = argv['environment'];
            if (argv['log-level'] || argv['log-targets']) {
                cliConfig.log = {};
                if (argv['log-level'])
                    cliConfig.log.level = argv['log-level'];
                if (argv['log-targets']) {
                    cliConfig.log.targets = argv['log-targets'].split(',');
                }
            }
            if (argv['http-base-url'] || argv['http-timeout']) {
                cliConfig.httpClient = {};
                if (argv['http-base-url'])
                    cliConfig.httpClient.baseUrl = argv['http-base-url'];
                if (argv['http-timeout'])
                    cliConfig.httpClient.timeoutMs = argv['http-timeout'];
            }
            if (argv['retry-max-retries']) {
                cliConfig.retry = { maxRetries: argv['retry-max-retries'] };
            }
            if (argv['health-check-enabled'] !== undefined) {
                cliConfig.healthCheck = { enabled: argv['health-check-enabled'] };
            }
            this.trackConfigSources(cliConfig, 'cli');
            return cliConfig;
        }
        catch (error) {
            console.warn('Failed to parse CLI arguments', error);
            return {};
        }
    }
    loadFromEnvironment(prefix = 'SDK_') {
        const env = process.env;
        const envConfig = {};
        const getEnv = (key) => {
            return env[prefix + key] || env[key];
        };
        const parseArray = (value) => {
            return value.split(',').map(v => v.trim());
        };
        const parseNumber = (value) => {
            const num = parseInt(value, 10);
            return isNaN(num) ? undefined : num;
        };
        const parseBoolean = (value) => {
            return value === 'true' ? true : value === 'false' ? false : undefined;
        };
        if (getEnv('SERVICE_NAME'))
            envConfig.serviceName = getEnv('SERVICE_NAME');
        if (getEnv('ENVIRONMENT'))
            envConfig.environment = getEnv('ENVIRONMENT');
        envConfig.log = {};
        if (getEnv('LOG_LEVEL'))
            envConfig.log.level = getEnv('LOG_LEVEL');
        if (getEnv('LOG_TARGETS'))
            envConfig.log.targets = parseArray(getEnv('LOG_TARGETS'));
        if (getEnv('LOG_FILE_PATH'))
            envConfig.log.filePath = getEnv('LOG_FILE_PATH');
        if (getEnv('LOG_REMOTE_ENDPOINT'))
            envConfig.log.remoteEndpoint = getEnv('LOG_REMOTE_ENDPOINT');
        if (getEnv('LOG_REMOTE_API_KEY'))
            envConfig.log.remoteApiKey = getEnv('LOG_REMOTE_API_KEY');
        envConfig.retry = {};
        if (getEnv('RETRY_MAX_RETRIES'))
            envConfig.retry.maxRetries = parseNumber(getEnv('RETRY_MAX_RETRIES'));
        if (getEnv('RETRY_INITIAL_DELAY_MS'))
            envConfig.retry.initialDelayMs = parseNumber(getEnv('RETRY_INITIAL_DELAY_MS'));
        if (getEnv('RETRY_MAX_DELAY_MS'))
            envConfig.retry.maxDelayMs = parseNumber(getEnv('RETRY_MAX_DELAY_MS'));
        if (getEnv('RETRY_BACKOFF_MULTIPLIER'))
            envConfig.retry.backoffMultiplier = parseNumber(getEnv('RETRY_BACKOFF_MULTIPLIER'));
        envConfig.httpClient = {};
        if (getEnv('HTTP_BASE_URL'))
            envConfig.httpClient.baseUrl = getEnv('HTTP_BASE_URL');
        if (getEnv('HTTP_TIMEOUT_MS'))
            envConfig.httpClient.timeoutMs = parseNumber(getEnv('HTTP_TIMEOUT_MS'));
        if (getEnv('HTTP_KEEP_ALIVE'))
            envConfig.httpClient.keepAlive = parseBoolean(getEnv('HTTP_KEEP_ALIVE'));
        if (getEnv('HTTP_MAX_SOCKETS'))
            envConfig.httpClient.maxSockets = parseNumber(getEnv('HTTP_MAX_SOCKETS'));
        envConfig.connectionPool = {};
        if (getEnv('POOL_MIN_CONNECTIONS'))
            envConfig.connectionPool.minConnections = parseNumber(getEnv('POOL_MIN_CONNECTIONS'));
        if (getEnv('POOL_MAX_CONNECTIONS'))
            envConfig.connectionPool.maxConnections = parseNumber(getEnv('POOL_MAX_CONNECTIONS'));
        if (getEnv('POOL_IDLE_TIMEOUT_MS'))
            envConfig.connectionPool.idleTimeoutMs = parseNumber(getEnv('POOL_IDLE_TIMEOUT_MS'));
        envConfig.healthCheck = {};
        if (getEnv('HEALTH_CHECK_ENABLED'))
            envConfig.healthCheck.enabled = parseBoolean(getEnv('HEALTH_CHECK_ENABLED'));
        if (getEnv('HEALTH_CHECK_INTERVAL_MS'))
            envConfig.healthCheck.intervalMs = parseNumber(getEnv('HEALTH_CHECK_INTERVAL_MS'));
        if (getEnv('HEALTH_CHECK_PATH'))
            envConfig.healthCheck.path = getEnv('HEALTH_CHECK_PATH');
        this.cleanEmptyObjects(envConfig);
        this.trackConfigSources(envConfig, 'environment');
        return envConfig;
    }
    parseConfig(content, format) {
        switch (format) {
            case 'json':
                return JSON.parse(content);
            case 'yaml':
                return yaml.load(content);
            default:
                throw new Error(`Unsupported config format: ${format}`);
        }
    }
    detectFormat(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json')
            return 'json';
        if (ext === '.yaml' || ext === '.yml')
            return 'yaml';
        throw new Error(`Cannot detect config format from extension: ${ext}`);
    }
    getDefaultConfigPath() {
        const possiblePaths = [
            './sdk.config.json',
            './sdk.config.yaml',
            './sdk.config.yml',
            './config/sdk.config.json',
            './config/sdk.config.yaml',
            './config/sdk.config.yml',
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        return undefined;
    }
    trackConfigSources(config, source, prefix = '') {
        for (const [key, value] of Object.entries(config)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                this.trackConfigSources(value, source, fullKey);
            }
            else if (value !== undefined) {
                this.configSources.set(fullKey, source);
            }
        }
    }
    cleanEmptyObjects(obj) {
        for (const key of Object.keys(obj)) {
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                this.cleanEmptyObjects(obj[key]);
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key];
                }
            }
        }
    }
    deepMerge(...sources) {
        const result = {};
        for (const source of sources) {
            if (!source)
                continue;
            for (const key of Object.keys(source)) {
                const value = source[key];
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    result[key] = this.deepMerge(result[key] || {}, value);
                }
                else if (value !== undefined) {
                    result[key] = value;
                }
            }
        }
        return result;
    }
    getConfig() {
        return this.deepMerge({}, this.config);
    }
    updateConfig(updates) {
        this.config = this.deepMerge(this.config, updates);
    }
    getConfigSource(key) {
        return this.configSources.get(key);
    }
    getAllConfigSources() {
        return new Map(this.configSources);
    }
}
exports.ConfigManager = ConfigManager;
