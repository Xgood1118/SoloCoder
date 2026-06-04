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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const axios_1 = __importDefault(require("axios"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const uuid_1 = require("uuid");
const SdkError_1 = require("../errors/SdkError");
const RetryStrategy_1 = require("../retry/RetryStrategy");
class HttpClient {
    constructor(config, retryStrategy, logger) {
        this.retryQueue = [];
        this.isProcessingQueue = false;
        this.config = config;
        this.logger = logger;
        this.retryStrategy = retryStrategy;
        this.httpAgent = new http.Agent({
            keepAlive: config.keepAlive,
            keepAliveMsecs: config.keepAliveMsecs,
            maxSockets: config.maxSockets,
            maxFreeSockets: config.maxFreeSockets,
        });
        this.httpsAgent = new https.Agent({
            keepAlive: config.keepAlive,
            keepAliveMsecs: config.keepAliveMsecs,
            maxSockets: config.maxSockets,
            maxFreeSockets: config.maxFreeSockets,
        });
        this.client = axios_1.default.create({
            baseURL: config.baseUrl,
            timeout: config.timeoutMs,
            headers: config.defaultHeaders,
            httpAgent: this.httpAgent,
            httpsAgent: this.httpsAgent,
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.client.interceptors.request.use((config) => {
            const requestId = config.requestId || (0, uuid_1.v4)();
            config.headers = config.headers || {};
            config.headers['X-Request-ID'] = requestId;
            config.requestId = requestId;
            config.startTime = Date.now();
            if (this.logger) {
                this.logger.debug('Sending HTTP request', {
                    requestId,
                    method: config.method,
                    url: config.url,
                    headers: config.headers,
                });
            }
            return config;
        }, (error) => {
            return Promise.reject(SdkError_1.SdkError.fromError(error));
        });
        this.client.interceptors.response.use((response) => {
            const config = response.config;
            const requestId = config.requestId;
            const duration = Date.now() - config.startTime;
            if (this.logger) {
                this.logger.debug('HTTP request completed', {
                    requestId,
                    status: response.status,
                    durationMs: duration,
                });
            }
            return response;
        }, (error) => {
            const config = error.config;
            const requestId = config?.requestId || (0, uuid_1.v4)();
            const duration = config ? Date.now() - config.startTime : 0;
            if (this.logger) {
                this.logger.warn('HTTP request failed', {
                    id: requestId,
                    durationMs: duration,
                    status: error.response?.status,
                }, error);
            }
            const sdkError = error.response
                ? SdkError_1.SdkError.fromHttpStatus(error.response.status, error.message)
                : SdkError_1.SdkError.fromError(error);
            sdkError.requestId = requestId;
            return Promise.reject(sdkError);
        });
    }
    async request(options, retryConfig) {
        const requestId = (0, uuid_1.v4)();
        if (this.logger) {
            this.logger.debug('Preparing request', {
                requestId,
                method: options.method,
                url: options.url,
                hasCustomTimeout: !!options.timeoutMs,
                hasCustomRetry: !!retryConfig,
            });
        }
        const effectiveRetryConfig = retryConfig
            ? { ...this.retryStrategy.getConfig(), ...retryConfig }
            : this.retryStrategy.getConfig();
        const operationRetryStrategy = new RetryStrategy_1.RetryStrategy(effectiveRetryConfig, this.logger);
        const operation = async () => {
            const axiosConfig = {
                method: options.method,
                url: options.url,
                headers: {
                    ...this.config.defaultHeaders,
                    ...options.headers,
                },
                timeout: options.timeoutMs || this.config.timeoutMs,
                data: options.body,
            };
            axiosConfig.requestId = requestId;
            try {
                const response = await this.client.request(axiosConfig);
                return this.transformResponse(response, requestId);
            }
            catch (error) {
                if (error instanceof SdkError_1.SdkError) {
                    if (error.code === SdkError_1.ErrorCode.REQUEST_TIMEOUT) {
                        this.enqueueForRetry(options, requestId, retryConfig);
                    }
                    throw error;
                }
                throw SdkError_1.SdkError.fromError(error);
            }
        };
        try {
            const result = await operationRetryStrategy.execute(operation, {
                onRetry: (context) => {
                    if (this.logger) {
                        this.logger.info('Request retry initiated', {
                            requestId,
                            attempt: context.attempt,
                            delayMs: context.delayMs,
                            error: context.lastError?.message,
                        });
                    }
                },
            });
            return result;
        }
        catch (error) {
            if (error instanceof SdkError_1.SdkError) {
                error.requestId = requestId;
            }
            throw error;
        }
    }
    transformResponse(response, requestId) {
        const headers = {};
        for (const [key, value] of Object.entries(response.headers)) {
            headers[key] = String(value);
        }
        return {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            headers,
            requestId,
        };
    }
    enqueueForRetry(options, requestId, retryConfig) {
        if (this.logger) {
            this.logger.info('Request timed out, enqueuing for retry', {
                requestId,
                queueSize: this.retryQueue.length + 1,
            });
        }
        this.retryQueue.push({
            options,
            resolve: () => { },
            reject: () => { },
            retryConfig,
            enqueuedAt: Date.now(),
        });
        this.processRetryQueue();
    }
    async processRetryQueue() {
        if (this.isProcessingQueue || this.retryQueue.length === 0) {
            return;
        }
        this.isProcessingQueue = true;
        try {
            while (this.retryQueue.length > 0) {
                const request = this.retryQueue.shift();
                const waitTime = this.retryStrategy.calculateDelay(1);
                if (this.logger) {
                    this.logger.debug('Processing retry queue item', {
                        queueSize: this.retryQueue.length,
                        waitTime,
                    });
                }
                await new Promise((resolve) => setTimeout(resolve, waitTime));
                try {
                    const result = await this.request(request.options, request.retryConfig);
                    request.resolve(result);
                }
                catch (error) {
                    request.reject(error);
                }
            }
        }
        finally {
            this.isProcessingQueue = false;
        }
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
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (config.baseUrl) {
            this.client.defaults.baseURL = config.baseUrl;
        }
        if (config.timeoutMs) {
            this.client.defaults.timeout = config.timeoutMs;
        }
        if (config.defaultHeaders) {
            this.client.defaults.headers = { ...this.client.defaults.headers, ...config.defaultHeaders };
        }
        if (config.keepAlive !== undefined || config.keepAliveMsecs !== undefined ||
            config.maxSockets !== undefined || config.maxFreeSockets !== undefined) {
            this.httpAgent.destroy();
            this.httpsAgent.destroy();
            this.httpAgent = new http.Agent({
                keepAlive: this.config.keepAlive,
                keepAliveMsecs: this.config.keepAliveMsecs,
                maxSockets: this.config.maxSockets,
                maxFreeSockets: this.config.maxFreeSockets,
            });
            this.httpsAgent = new https.Agent({
                keepAlive: this.config.keepAlive,
                keepAliveMsecs: this.config.keepAliveMsecs,
                maxSockets: this.config.maxSockets,
                maxFreeSockets: this.config.maxFreeSockets,
            });
            this.client.defaults.httpAgent = this.httpAgent;
            this.client.defaults.httpsAgent = this.httpsAgent;
        }
    }
    getConfig() {
        return { ...this.config };
    }
    getRetryQueueSize() {
        return this.retryQueue.length;
    }
    close() {
        this.httpAgent.destroy();
        this.httpsAgent.destroy();
        this.retryQueue = [];
    }
}
exports.HttpClient = HttpClient;
