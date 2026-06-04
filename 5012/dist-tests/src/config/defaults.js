"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
exports.defaultConfig = {
    serviceName: 'unknown-service',
    environment: 'development',
    log: {
        level: 'info',
        targets: ['console'],
        filePath: './logs/sdk.log',
    },
    retry: {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    },
    httpClient: {
        baseUrl: '',
        timeoutMs: 10000,
        defaultHeaders: {},
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 50,
        maxFreeSockets: 10,
    },
    connectionPool: {
        minConnections: 2,
        maxConnections: 10,
        idleTimeoutMs: 60000,
        acquireTimeoutMs: 30000,
    },
    healthCheck: {
        enabled: true,
        intervalMs: 30000,
        timeoutMs: 5000,
        path: '/health',
    },
};
