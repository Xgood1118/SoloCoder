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
exports.Logger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const uuid_1 = require("uuid");
const LOG_LEVEL_VALUES = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
class Logger {
    constructor(config, serviceName, environment) {
        this.pendingRemoteLogs = [];
        this.config = config;
        this.serviceName = serviceName;
        this.environment = environment;
        this.initializeFileOutput();
        this.initializeRemoteFlush();
    }
    initializeFileOutput() {
        if (this.config.targets.includes('file') && this.config.filePath) {
            try {
                const dir = path.dirname(this.config.filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                this.fileWriteStream = fs.createWriteStream(this.config.filePath, {
                    flags: 'a',
                    encoding: 'utf8',
                });
                this.fileWriteStream.on('error', (err) => {
                    console.error('Log file write error:', err);
                });
            }
            catch (error) {
                console.warn('Failed to initialize file logging:', error);
            }
        }
    }
    initializeRemoteFlush() {
        if (this.config.targets.includes('remote')) {
            this.remoteFlushTimer = setInterval(() => {
                this.flushRemoteLogs();
            }, 1000);
        }
    }
    shouldLog(level) {
        return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.config.level];
    }
    formatLogEntry(level, message, data, error) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            serviceName: this.serviceName,
            environment: this.environment,
        };
        if (this.currentRequestId) {
            entry.requestId = this.currentRequestId;
        }
        if (this.currentTraceId) {
            entry.traceId = this.currentTraceId;
        }
        if (data) {
            entry.data = data;
        }
        if (error) {
            entry.error = {
                message: error.message,
                stack: error.stack,
                code: error.code,
            };
        }
        return entry;
    }
    outputToConsole(entry) {
        const format = (level, msg) => {
            const colors = {
                debug: '\x1b[36m',
                info: '\x1b[32m',
                warn: '\x1b[33m',
                error: '\x1b[31m',
            };
            const reset = '\x1b[0m';
            return `${colors[level]}[${entry.timestamp}] [${level.toUpperCase()}] ${msg}${reset}`;
        };
        const context = entry.requestId ? `[req:${entry.requestId}] ` : '';
        const consoleMsg = format(entry.level, `${context}${entry.message}`);
        if (entry.level === 'error' && entry.error) {
            console.error(consoleMsg, entry.data || '', entry.error.stack || '');
        }
        else if (entry.level === 'warn') {
            console.warn(consoleMsg, entry.data || '');
        }
        else if (entry.level === 'debug') {
            console.debug(consoleMsg, entry.data || '');
        }
        else {
            console.log(consoleMsg, entry.data || '');
        }
    }
    outputToFile(entry) {
        if (this.fileWriteStream) {
            const logLine = JSON.stringify(entry) + '\n';
            this.fileWriteStream.write(logLine);
        }
    }
    outputToRemote(entry) {
        this.pendingRemoteLogs.push(entry);
        if (this.pendingRemoteLogs.length >= 50) {
            this.flushRemoteLogs();
        }
    }
    async flushRemoteLogs() {
        if (this.pendingRemoteLogs.length === 0 || !this.config.remoteEndpoint) {
            return;
        }
        const logs = [...this.pendingRemoteLogs];
        this.pendingRemoteLogs = [];
        try {
            const url = new URL(this.config.remoteEndpoint);
            const data = JSON.stringify({ logs });
            const headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data).toString(),
            };
            if (this.config.remoteApiKey) {
                headers['Authorization'] = `Bearer ${this.config.remoteApiKey}`;
            }
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: 'POST',
                headers,
            };
            const protocol = url.protocol === 'https:' ? https : http;
            const req = protocol.request(options, (res) => {
                if (res.statusCode && res.statusCode >= 400) {
                    console.warn(`Remote log service returned status ${res.statusCode}`);
                    this.pendingRemoteLogs.unshift(...logs);
                }
            });
            req.on('error', (err) => {
                console.warn('Failed to send remote logs:', err.message);
                this.pendingRemoteLogs.unshift(...logs);
            });
            req.write(data);
            req.end();
        }
        catch (error) {
            console.warn('Failed to flush remote logs:', error);
            this.pendingRemoteLogs.unshift(...logs);
        }
    }
    log(level, message, data, error) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = this.formatLogEntry(level, message, data, error);
        if (this.config.targets.includes('console')) {
            this.outputToConsole(entry);
        }
        if (this.config.targets.includes('file')) {
            this.outputToFile(entry);
        }
        if (this.config.targets.includes('remote')) {
            this.outputToRemote(entry);
        }
    }
    debug(message, data) {
        this.log('debug', message, data);
    }
    info(message, data) {
        this.log('info', message, data);
    }
    warn(message, data, error) {
        this.log('warn', message, data, error);
    }
    error(message, error, data) {
        this.log('error', message, data, error);
    }
    setRequestContext(requestId, traceId) {
        this.currentRequestId = requestId;
        this.currentTraceId = traceId;
    }
    clearRequestContext() {
        this.currentRequestId = undefined;
        this.currentTraceId = undefined;
    }
    generateRequestId() {
        return (0, uuid_1.v4)();
    }
    updateConfig(config) {
        const needsFileReinit = config.targets !== undefined || config.filePath !== undefined;
        const needsRemoteReinit = config.targets !== undefined || config.remoteEndpoint !== undefined;
        this.config = { ...this.config, ...config };
        if (needsFileReinit) {
            if (this.fileWriteStream) {
                this.fileWriteStream.end();
                this.fileWriteStream = undefined;
            }
            this.initializeFileOutput();
        }
        if (needsRemoteReinit) {
            if (this.remoteFlushTimer) {
                clearInterval(this.remoteFlushTimer);
                this.remoteFlushTimer = undefined;
            }
            this.initializeRemoteFlush();
        }
    }
    async close() {
        if (this.remoteFlushTimer) {
            clearInterval(this.remoteFlushTimer);
            this.remoteFlushTimer = undefined;
        }
        await this.flushRemoteLogs();
        if (this.fileWriteStream) {
            await new Promise((resolve) => {
                this.fileWriteStream.end(() => resolve());
            });
            this.fileWriteStream = undefined;
        }
    }
}
exports.Logger = Logger;
