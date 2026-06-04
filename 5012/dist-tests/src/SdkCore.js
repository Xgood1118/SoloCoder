"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkCore = void 0;
const uuid_1 = require("uuid");
const ConfigManager_1 = require("./config/ConfigManager");
const Logger_1 = require("./logging/Logger");
const SdkError_1 = require("./errors/SdkError");
const RetryStrategy_1 = require("./retry/RetryStrategy");
const ConnectionPool_1 = require("./pool/ConnectionPool");
const HttpClient_1 = require("./http/HttpClient");
const HealthChecker_1 = require("./health/HealthChecker");
class SdkCore {
    constructor(config) {
        this.initialized = false;
        this.instanceId = (0, uuid_1.v4)();
        this.configManager = new ConfigManager_1.ConfigManager(config);
    }
    async initialize(options = {}) {
        if (this.initialized) {
            return this;
        }
        const config = await this.configManager.load(options);
        this.logger = new Logger_1.Logger(config.log, config.serviceName, config.environment);
        this.retryStrategy = new RetryStrategy_1.RetryStrategy(config.retry, this.logger);
        this.httpClient = new HttpClient_1.HttpClient(config.httpClient, this.retryStrategy, this.logger);
        this.healthChecker = new HealthChecker_1.HealthChecker(config.healthCheck, this.logger, this.httpClient);
        const defaultChecks = HealthChecker_1.HealthChecker.defaultChecks(this.httpClient, config.healthCheck);
        for (const check of defaultChecks) {
            this.healthChecker.addCheck(check);
        }
        if (config.healthCheck.enabled) {
            this.healthChecker.start();
        }
        const instance = {
            id: this.instanceId,
            config: this.configManager.getConfig(),
            logger: this.logger,
            httpClient: this.httpClient,
            retryStrategy: this.retryStrategy,
            healthChecker: this.healthChecker,
            connectionPool: this.connectionPool,
        };
        SdkCore.instances.set(this.instanceId, instance);
        this.initialized = true;
        this.logger.info('SDK instance initialized', {
            instanceId: this.instanceId,
            serviceName: config.serviceName,
            environment: config.environment,
        });
        return this;
    }
    static async createInstance(config, options = {}) {
        const instance = new SdkCore(config);
        await instance.initialize(options);
        return instance;
    }
    static getInstance(instanceId) {
        if (!instanceId) {
            if (!SdkCore.defaultInstance) {
                throw new SdkError_1.SdkError(SdkError_1.ErrorCode.CONFIG_ERROR, 'No default SDK instance found. Call createInstance() first.');
            }
            return SdkCore.defaultInstance;
        }
        const instance = SdkCore.instances.get(instanceId);
        if (!instance) {
            throw new SdkError_1.SdkError(SdkError_1.ErrorCode.CONFIG_ERROR, `SDK instance not found: ${instanceId}`);
        }
        const core = new SdkCore();
        core.instanceId = instanceId;
        core.configManager = new ConfigManager_1.ConfigManager(instance.config);
        core.logger = instance.logger;
        core.retryStrategy = instance.retryStrategy;
        core.httpClient = instance.httpClient;
        core.healthChecker = instance.healthChecker;
        core.connectionPool = instance.connectionPool;
        core.initialized = true;
        return core;
    }
    static setDefaultInstance(instance) {
        SdkCore.defaultInstance = instance;
    }
    static getAllInstances() {
        return Array.from(SdkCore.instances.keys());
    }
    async request(options) {
        this.ensureInitialized();
        return this.httpClient.request(options, options.retryConfig);
    }
    async get(url, options = {}) {
        return this.request({ ...options, method: 'GET', url });
    }
    async post(url, body, options = {}) {
        return this.request({ ...options, method: 'POST', url, body });
    }
    async put(url, body, options = {}) {
        return this.request({ ...options, method: 'PUT', url, body });
    }
    async delete(url, options = {}) {
        return this.request({ ...options, method: 'DELETE', url });
    }
    async patch(url, body, options = {}) {
        return this.request({ ...options, method: 'PATCH', url, body });
    }
    getConfig() {
        return this.configManager.getConfig();
    }
    updateConfig(updates) {
        this.ensureInitialized();
        this.configManager.updateConfig(updates);
        const config = this.configManager.getConfig();
        if (updates.log) {
            this.logger.updateConfig(updates.log);
        }
        if (updates.retry) {
            this.retryStrategy.updateConfig(updates.retry);
        }
        if (updates.httpClient) {
            this.httpClient.updateConfig(updates.httpClient);
        }
        if (updates.healthCheck) {
            this.healthChecker.updateConfig(updates.healthCheck);
        }
        const instance = SdkCore.instances.get(this.instanceId);
        if (instance) {
            instance.config = config;
        }
    }
    getLogger() {
        this.ensureInitialized();
        return this.logger;
    }
    getRetryStrategy() {
        this.ensureInitialized();
        return this.retryStrategy;
    }
    getHttpClient() {
        this.ensureInitialized();
        return this.httpClient;
    }
    getHealthChecker() {
        this.ensureInitialized();
        return this.healthChecker;
    }
    setConnectionPool(factory) {
        this.ensureInitialized();
        if (this.connectionPool) {
            this.connectionPool.close().catch((err) => {
                this.logger.warn('Error closing existing connection pool', err);
            });
        }
        const config = this.configManager.getConfig();
        this.connectionPool = new ConnectionPool_1.ConnectionPool(config.connectionPool, factory, `${config.serviceName}-pool`, this.logger);
        const instance = SdkCore.instances.get(this.instanceId);
        if (instance) {
            instance.connectionPool = this.connectionPool;
        }
        return this.connectionPool;
    }
    getConnectionPool() {
        this.ensureInitialized();
        return this.connectionPool;
    }
    addHealthCheck(check) {
        this.ensureInitialized();
        this.healthChecker.addCheck(check);
    }
    removeHealthCheck(name) {
        this.ensureInitialized();
        this.healthChecker.removeCheck(name);
    }
    async checkHealth() {
        this.ensureInitialized();
        return this.healthChecker.checkHealth();
    }
    getLastHealthStatus() {
        this.ensureInitialized();
        return this.healthChecker.getLastStatus();
    }
    setRequestContext(requestId, traceId) {
        this.ensureInitialized();
        this.logger.setRequestContext(requestId, traceId);
    }
    clearRequestContext() {
        this.ensureInitialized();
        this.logger.clearRequestContext();
    }
    generateRequestId() {
        return (0, uuid_1.v4)();
    }
    getInstanceId() {
        return this.instanceId;
    }
    ensureInitialized() {
        if (!this.initialized) {
            throw new SdkError_1.SdkError(SdkError_1.ErrorCode.CONFIG_ERROR, 'SDK not initialized. Call initialize() first.');
        }
    }
    async close() {
        if (!this.initialized) {
            return;
        }
        this.logger.info('Closing SDK instance', {
            instanceId: this.instanceId,
        });
        this.healthChecker.stop();
        if (this.connectionPool) {
            await this.connectionPool.close();
        }
        this.httpClient.close();
        await this.logger.close();
        SdkCore.instances.delete(this.instanceId);
        if (SdkCore.defaultInstance && SdkCore.defaultInstance.instanceId === this.instanceId) {
            SdkCore.defaultInstance = undefined;
        }
        this.initialized = false;
    }
    static async closeAll() {
        const instanceIds = Array.from(SdkCore.instances.keys());
        for (const id of instanceIds) {
            const instance = SdkCore.instances.get(id);
            if (instance) {
                try {
                    const core = new SdkCore();
                    core.instanceId = id;
                    core.configManager = new ConfigManager_1.ConfigManager(instance.config);
                    core.logger = instance.logger;
                    core.retryStrategy = instance.retryStrategy;
                    core.httpClient = instance.httpClient;
                    core.healthChecker = instance.healthChecker;
                    core.connectionPool = instance.connectionPool;
                    core.initialized = true;
                    await core.close();
                }
                catch (error) {
                    console.error(`Error closing SDK instance ${id}:`, error);
                }
            }
        }
        SdkCore.instances.clear();
        SdkCore.defaultInstance = undefined;
    }
}
exports.SdkCore = SdkCore;
SdkCore.instances = new Map();
