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
const src_1 = __importStar(require("../src"));
const results = [];
function record(name, passed, message) {
    results.push({ name, passed, message });
    const symbol = passed ? '✅' : '❌';
    console.log(`${symbol} ${name}: ${message}`);
}
// ===== Test 1: Default Config =====
async function test1_defaultConfig() {
    const cm = new src_1.ConfigManager();
    const cfg = await cm.load();
    const ok = cfg.serviceName === 'unknown-service'
        && cfg.log.level === 'info'
        && cfg.retry.maxRetries === 3
        && cfg.retry.initialDelayMs === 100
        && cfg.retry.backoffMultiplier === 2
        && cfg.httpClient.timeoutMs === 10000;
    record('defaultConfig', ok, `serviceName=${cfg.serviceName}, retry.maxRetries=${cfg.retry.maxRetries}`);
}
// ===== Test 2: Config priority - env > CLI > file =====
async function test2_configPriority() {
    // Set env vars that should override file/CLI
    process.env.SDK_SERVICE_NAME = 'from-env';
    process.env.SDK_LOG_LEVEL = 'debug';
    process.env.SDK_RETRY_MAX_RETRIES = '99';
    const cm = new src_1.ConfigManager({
        serviceName: 'from-init', // lowest priority (default merge)
    });
    const cfg = await cm.load();
    // Env should win for SERVICE_NAME, LOG_LEVEL, RETRY_MAX_RETRIES
    const ok = cfg.serviceName === 'from-env'
        && cfg.log.level === 'debug'
        && cfg.retry.maxRetries === 99;
    delete process.env.SDK_SERVICE_NAME;
    delete process.env.SDK_LOG_LEVEL;
    delete process.env.SDK_RETRY_MAX_RETRIES;
    record('configPriority (env wins)', ok, `serviceName=${cfg.serviceName} (expected from-env), log.level=${cfg.log.level} (expected debug), retry.maxRetries=${cfg.retry.maxRetries} (expected 99)`);
}
// ===== Test 3: YAML file loading =====
async function test3_yamlLoad() {
    const fs = require('fs');
    const path = require('path');
    const yamlPath = 'D:/work01/SoloCoder/5012/tests/test-config.yaml';
    fs.writeFileSync(yamlPath, `
serviceName: from-yaml-file
environment: staging
log:
  level: warn
  targets:
    - console
retry:
  maxRetries: 7
  initialDelayMs: 50
`);
    const cm = new src_1.ConfigManager();
    const cfg = await cm.load({ configPath: yamlPath });
    const ok = cfg.serviceName === 'from-yaml-file'
        && cfg.environment === 'staging'
        && cfg.log.level === 'warn'
        && cfg.retry.maxRetries === 7;
    fs.unlinkSync(yamlPath);
    record('yamlFileLoad', ok, `serviceName=${cfg.serviceName} (expected from-yaml-file), log.level=${cfg.log.level} (expected warn), retry.maxRetries=${cfg.retry.maxRetries} (expected 7)`);
}
// ===== Test 4: JSON file loading =====
async function test4_jsonLoad() {
    const fs = require('fs');
    const jsonPath = 'D:/work01/SoloCoder/5012/tests/test-config.json';
    fs.writeFileSync(jsonPath, JSON.stringify({
        serviceName: 'from-json-file',
        httpClient: { timeoutMs: 5000 },
    }));
    const cm = new src_1.ConfigManager();
    const cfg = await cm.load({ configPath: jsonPath });
    const ok = cfg.serviceName === 'from-json-file' && cfg.httpClient.timeoutMs === 5000;
    fs.unlinkSync(jsonPath);
    record('jsonFileLoad', ok, `serviceName=${cfg.serviceName} (expected from-json-file), timeoutMs=${cfg.httpClient.timeoutMs} (expected 5000)`);
}
// ===== Test 5: Logger with various levels =====
async function test5_loggerLevels() {
    const logger = new src_1.Logger({ level: 'debug', targets: ['console'] }, 'test-svc', 'test');
    let captured = [];
    const origLog = console.log;
    const origDebug = console.debug;
    const origWarn = console.warn;
    console.log = (...args) => captured.push(['info', ...args]);
    console.debug = (...args) => captured.push(['debug', ...args]);
    console.warn = (...args) => captured.push(['warn', ...args]);
    try {
        logger.debug('debug-msg');
        logger.info('info-msg');
        logger.warn('warn-msg');
        logger.error('error-msg');
    }
    finally {
        console.log = origLog;
        console.debug = origDebug;
        console.warn = origWarn;
    }
    // 4 calls captured
    const ok = captured.length === 4;
    record('loggerLevels (debug/info/warn/error)', ok, `captured ${captured.length}/4 log calls`);
}
// ===== Test 6: Logger level filter =====
async function test6_loggerFilter() {
    const logger = new src_1.Logger({ level: 'warn', targets: ['console'] }, 'test-svc', 'test');
    let captured = [];
    const origLog = console.log;
    const origDebug = console.debug;
    const origWarn = console.warn;
    console.log = (...args) => captured.push('info');
    console.debug = (...args) => captured.push('debug');
    console.warn = (...args) => captured.push('warn');
    try {
        logger.debug('debug-msg'); // filtered
        logger.info('info-msg'); // filtered
        logger.warn('warn-msg'); // passes
        logger.error('error-msg'); // passes (uses console.error - we won't capture it)
    }
    finally {
        console.log = origLog;
        console.debug = origDebug;
        console.warn = origWarn;
    }
    const ok = captured.length === 1 && captured[0] === 'warn';
    record('loggerLevelFilter', ok, `with level=warn, captured=${JSON.stringify(captured)} (expected ['warn'])`);
}
// ===== Test 7: Logger file output =====
async function test7_loggerFile() {
    const fs = require('fs');
    const path = require('path');
    const logFile = 'D:/work01/SoloCoder/5012/tests/test.log';
    if (fs.existsSync(logFile))
        fs.unlinkSync(logFile);
    const logger = new src_1.Logger({
        level: 'info',
        targets: ['file'],
        filePath: logFile,
    }, 'file-svc', 'test');
    logger.info('file-test-message', { foo: 'bar' });
    await new Promise(r => setTimeout(r, 200));
    await logger.close();
    const content = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf-8') : '';
    const ok = content.includes('file-test-message') && content.includes('"foo":"bar"');
    if (fs.existsSync(logFile))
        fs.unlinkSync(logFile);
    record('loggerFileTarget', ok, `log file contains: ${content.slice(0, 100)}...`);
}
// ===== Test 8: Error codes - all required =====
async function test8_errorCodes() {
    const required = [
        'NETWORK_ERROR', 'CONNECTION_TIMEOUT', 'REQUEST_TIMEOUT', 'RETRY_TIMEOUT',
        'VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
        'RATE_LIMITED', 'INTERNAL_SERVER_ERROR', 'BAD_GATEWAY', 'SERVICE_UNAVAILABLE',
        'GATEWAY_TIMEOUT', 'CONFIG_ERROR', 'POOL_EXHAUSTED', 'POOL_TIMEOUT', 'UNKNOWN_ERROR',
    ];
    const missing = required.filter(c => !(c in src_1.ErrorCode));
    const ok = missing.length === 0;
    record('errorCodes (all 18 categories)', ok, missing.length === 0 ? 'all 18 codes present' : `missing: ${missing.join(', ')}`);
}
// ===== Test 9: Error categories - retryable mapping =====
async function test9_errorCategories() {
    const ok = src_1.errorCategories[src_1.ErrorCode.NETWORK_ERROR].retryable === true
        && src_1.errorCategories[src_1.ErrorCode.NOT_FOUND].retryable === false
        && src_1.errorCategories[src_1.ErrorCode.VALIDATION_ERROR].retryable === false
        && src_1.errorCategories[src_1.ErrorCode.RATE_LIMITED].retryable === true
        && src_1.errorCategories[src_1.ErrorCode.POOL_EXHAUSTED].retryable === true
        && src_1.errorCategories[src_1.ErrorCode.RETRY_TIMEOUT].retryable === false;
    record('errorCategoryRetryable', ok, `categories correctly mapped retryable flags`);
}
// ===== Test 10: fromHttpStatus mapping =====
async function test10_fromHttpStatus() {
    const cases = [
        [400, src_1.ErrorCode.VALIDATION_ERROR],
        [401, src_1.ErrorCode.UNAUTHORIZED],
        [403, src_1.ErrorCode.FORBIDDEN],
        [404, src_1.ErrorCode.NOT_FOUND],
        [408, src_1.ErrorCode.REQUEST_TIMEOUT],
        [409, src_1.ErrorCode.CONFLICT],
        [429, src_1.ErrorCode.RATE_LIMITED],
        [500, src_1.ErrorCode.INTERNAL_SERVER_ERROR],
        [502, src_1.ErrorCode.BAD_GATEWAY],
        [503, src_1.ErrorCode.SERVICE_UNAVAILABLE],
        [504, src_1.ErrorCode.GATEWAY_TIMEOUT],
    ];
    let allOk = true;
    for (const [status, expected] of cases) {
        const err = src_1.SdkError.fromHttpStatus(status, `test ${status}`);
        if (err.code !== expected) {
            allOk = false;
            console.log(`  → status ${status} mapped to ${err.code}, expected ${expected}`);
        }
    }
    record('fromHttpStatusMapping', allOk, allOk ? `all 11 status codes mapped correctly` : `some mappings wrong`);
}
// ===== Test 11: RetryStrategy exponential backoff =====
async function test11_retryBackoff() {
    const rs = new src_1.RetryStrategy({
        maxRetries: 5,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        retryableStatusCodes: [500],
    });
    // attempt 1: 100ms, attempt 2: 200ms, attempt 3: 400ms
    const d1 = rs.calculateDelay(1);
    const d2 = rs.calculateDelay(2);
    const d3 = rs.calculateDelay(3);
    const d4 = rs.calculateDelay(4);
    // Each is base * multiplier^(attempt-1) ± 10% jitter
    // d1 ~ 100, d2 ~ 200, d3 ~ 400, d4 ~ 800
    const inRange = (n, expected) => n >= expected * 0.9 && n <= expected * 1.1;
    const ok = inRange(d1, 100) && inRange(d2, 200) && inRange(d3, 400) && inRange(d4, 800);
    record('retryExponentialBackoff', ok, `delays: ${d1}ms, ${d2}ms, ${d3}ms, ${d4}ms (expected ~100, ~200, ~400, ~800)`);
}
// ===== Test 12: RetryStrategy maxDelay cap =====
async function test12_retryMaxDelay() {
    const rs = new src_1.RetryStrategy({
        maxRetries: 20,
        initialDelayMs: 100,
        maxDelayMs: 1000, // cap at 1s
        backoffMultiplier: 2,
        retryableStatusCodes: [500],
    });
    // attempt 10: 100 * 2^9 = 51200, but capped at 1000
    const d = rs.calculateDelay(10);
    const ok = d <= 1100 && d >= 900; // 1000 ± 10% jitter
    record('retryMaxDelayCap', ok, `delay at attempt 10 = ${d}ms (expected ~1000ms, capped)`);
}
// ===== Test 13: RetryStrategy shouldRetry =====
async function test13_retryShouldRetry() {
    const rs = new src_1.RetryStrategy({
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        retryableStatusCodes: [500, 503],
    });
    const retryableError = src_1.SdkError.fromHttpStatus(500);
    const nonRetryableError = src_1.SdkError.fromHttpStatus(404);
    const nonRetryableConfig = src_1.SdkError.fromError(new Error('config error'));
    // attempt 1: should retry retryable
    // attempt 3: should NOT retry (>= maxRetries)
    const ok = rs.shouldRetry(retryableError, 1) === true
        && rs.shouldRetry(retryableError, 3) === false
        && rs.shouldRetry(nonRetryableError, 1) === false
        && rs.shouldRetry(nonRetryableConfig, 1) === false;
    record('retryShouldRetry', ok, `retryable 500 retries at attempt 1=true, stops at 3=false; non-retryable 404 stops at 1=false; config error stops at 1=false`);
}
// ===== Test 14: RetryStrategy execute - actually retries =====
async function test14_retryExecute() {
    const rs = new src_1.RetryStrategy({
        maxRetries: 3,
        initialDelayMs: 10, // short for testing
        maxDelayMs: 100,
        backoffMultiplier: 2,
        retryableStatusCodes: [500],
    });
    let attempts = 0;
    const startTime = Date.now();
    try {
        await rs.execute(async () => {
            attempts++;
            if (attempts < 3) {
                throw src_1.SdkError.fromHttpStatus(500);
            }
            return 'ok';
        });
    }
    catch (e) {
        record('retryExecute (succeeds on attempt 3)', false, `threw: ${e.message}`);
        return;
    }
    const elapsed = Date.now() - startTime;
    const ok = attempts === 3 && elapsed >= 10; // at least first delay
    record('retryExecute (succeeds on attempt 3)', ok, `attempts=${attempts} (expected 3), elapsed=${elapsed}ms`);
}
// ===== Test 15: RetryStrategy execute - fails after maxRetries =====
async function test15_retryExhausted() {
    const rs = new src_1.RetryStrategy({
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
        retryableStatusCodes: [500],
    });
    let attempts = 0;
    let caught;
    try {
        await rs.execute(async () => {
            attempts++;
            throw src_1.SdkError.fromHttpStatus(500);
        });
    }
    catch (e) {
        caught = e;
    }
    const ok = attempts === 2 && (caught instanceof src_1.SdkError) && caught.code === src_1.ErrorCode.RETRY_TIMEOUT;
    record('retryExhausted', ok, `attempts=${attempts} (expected 2), caught=${caught?.code} (expected RETRY_TIMEOUT)`);
}
// ===== Test 16: Multi-instance - independent configs =====
async function test16_multiInstance() {
    const sdk1 = await src_1.default.createInstance({
        serviceName: 'svc-1',
        httpClient: { timeoutMs: 1000, baseUrl: '', defaultHeaders: {}, keepAlive: true, keepAliveMsecs: 30000, maxSockets: 50, maxFreeSockets: 10 },
    });
    const sdk2 = await src_1.default.createInstance({
        serviceName: 'svc-2',
        httpClient: { timeoutMs: 2000, baseUrl: '', defaultHeaders: {}, keepAlive: true, keepAliveMsecs: 30000, maxSockets: 50, maxFreeSockets: 10 },
    });
    const id1 = sdk1.getInstanceId();
    const id2 = sdk2.getInstanceId();
    const cfg1 = sdk1.getConfig();
    const cfg2 = sdk2.getConfig();
    const ok = id1 !== id2
        && cfg1.serviceName === 'svc-1'
        && cfg2.serviceName === 'svc-2'
        && cfg1.httpClient.timeoutMs === 1000
        && cfg2.httpClient.timeoutMs === 2000
        && src_1.default.getAllInstances().length >= 2;
    await sdk1.close();
    await sdk2.close();
    record('multiInstance (independent)', ok, `id1!=id2=${id1 !== id2}, serviceName1=${cfg1.serviceName}, serviceName2=${cfg2.serviceName}, all instances count=${src_1.default.getAllInstances().length}`);
}
// ===== Test 17: SdkCore not initialized error =====
async function test17_notInitialized() {
    const sdk = new src_1.default();
    let caught;
    try {
        await sdk.request({ method: 'GET', url: '/test' });
    }
    catch (e) {
        caught = e;
    }
    const ok = caught instanceof src_1.SdkError && caught.code === src_1.ErrorCode.CONFIG_ERROR;
    record('sdkNotInitializedError', ok, `caught: ${caught?.code} (expected CONFIG_ERROR)`);
}
// ===== Test 18: HTTP request - success path =====
async function test18_httpSuccess() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'http-test',
        httpClient: {
            baseUrl: 'http://127.0.0.1:18800',
            timeoutMs: 15000,
            defaultHeaders: {},
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 5,
            maxFreeSockets: 2,
        },
    });
    let resp;
    let err;
    try {
        resp = await sdk.get('/get', { timeoutMs: 15000 });
    }
    catch (e) {
        err = e;
    }
    await sdk.close();
    const ok = !err && resp && resp.status === 200 && resp.requestId;
    record('httpSuccess (GET https://httpbin.org/get)', ok, err ? `error: ${err.message}` : `status=${resp?.status}, has requestId=${!!resp?.requestId}`);
}
// ===== Test 19: HTTP request - 404 mapped to NOT_FOUND =====
async function test19_http404() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'http-test-404',
        httpClient: {
            baseUrl: 'http://127.0.0.1:18800',
            timeoutMs: 15000,
            defaultHeaders: {},
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 5,
            maxFreeSockets: 2,
        },
    });
    let caught;
    try {
        await sdk.get('/status/404', { timeoutMs: 15000 });
    }
    catch (e) {
        caught = e;
    }
    await sdk.close();
    const ok = caught instanceof src_1.SdkError && caught.code === src_1.ErrorCode.NOT_FOUND && caught.statusCode === 404;
    record('http404 mapped to NOT_FOUND', ok, `caught: code=${caught?.code}, statusCode=${caught?.statusCode}`);
}
// ===== Test 20: HTTP request - 500 mapped to INTERNAL_SERVER_ERROR =====
async function test20_http500() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'http-test-500',
        httpClient: {
            baseUrl: 'http://127.0.0.1:18800',
            timeoutMs: 15000,
            defaultHeaders: {},
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 5,
            maxFreeSockets: 2,
        },
    });
    let caught;
    try {
        await sdk.get('/status/500', { timeoutMs: 15000 });
    }
    catch (e) {
        caught = e;
    }
    await sdk.close();
    const ok = caught instanceof src_1.SdkError && caught.code === src_1.ErrorCode.INTERNAL_SERVER_ERROR;
    record('http500 mapped to INTERNAL_SERVER_ERROR', ok, `caught: code=${caught?.code}`);
}
// ===== Test 21: Per-request timeout (global default) =====
async function test21_globalTimeout() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'timeout-test',
        httpClient: {
            baseUrl: 'http://127.0.0.1:18800',
            timeoutMs: 100, // 100ms global
            defaultHeaders: {},
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 5,
            maxFreeSockets: 2,
        },
    });
    let caught;
    const start = Date.now();
    try {
        // mock /delay?ms=3000 takes 3 seconds; 100ms timeout should fire
        await sdk.get('/delay?ms=3000', { timeoutMs: 100 });
    }
    catch (e) {
        caught = e;
    }
    const elapsed = Date.now() - start;
    await sdk.close();
    const ok = caught instanceof src_1.SdkError && (caught.code === src_1.ErrorCode.REQUEST_TIMEOUT || caught.code === src_1.ErrorCode.CONNECTION_TIMEOUT) && elapsed < 2000;
    record('globalTimeout (100ms hits before 3s delay)', ok, `caught: code=${caught?.code}, elapsed=${elapsed}ms`);
}
// ===== Test 22: Per-request timeout override =====
async function test22_perRequestTimeout() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'timeout-override',
        httpClient: {
            baseUrl: 'http://127.0.0.1:18800',
            timeoutMs: 30000, // 30s global default
            defaultHeaders: {},
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 5,
            maxFreeSockets: 2,
        },
    });
    let caught;
    const start = Date.now();
    try {
        // Override timeout to 200ms for this request
        await sdk.get('/delay?ms=3000', { timeoutMs: 200 });
    }
    catch (e) {
        caught = e;
    }
    const elapsed = Date.now() - start;
    await sdk.close();
    const ok = caught instanceof src_1.SdkError && (caught.code === src_1.ErrorCode.REQUEST_TIMEOUT || caught.code === src_1.ErrorCode.CONNECTION_TIMEOUT) && elapsed < 2000;
    record('perRequestTimeout override (200ms before 3s delay)', ok, `caught: code=${caught?.code}, elapsed=${elapsed}ms`);
}
// ===== Test 23: Health check =====
async function test23_healthCheck() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'health-test',
        httpClient: {
            baseUrl: 'http://127.0.0.1:18800',
            timeoutMs: 5000,
            defaultHeaders: {},
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 5,
            maxFreeSockets: 2,
        },
    });
    sdk.addHealthCheck({
        name: 'custom-check',
        check: async () => ({ healthy: true, details: { custom: 'ok' } }),
    });
    const status = await sdk.checkHealth();
    const ok = !!status && typeof status.healthy === 'boolean' && !!status.timestamp && !!status.details;
    record('healthCheck', ok, `healthy=${status?.healthy}, checks=${Object.keys(status?.details || {}).join(',')}`);
    await sdk.close();
}
// ===== Test 24: Connection pool =====
async function test24_connectionPool() {
    let created = 0;
    let destroyed = 0;
    const factory = {
        create: async () => { created++; return `conn-${created}`; },
        destroy: async (conn) => { destroyed++; },
        validate: async (conn) => true,
    };
    const pool = new src_1.ConnectionPool({
        minConnections: 2,
        maxConnections: 5,
        idleTimeoutMs: 60000,
        acquireTimeoutMs: 5000,
    }, factory, 'test-pool');
    // Wait for initial min connections
    await new Promise(r => setTimeout(r, 100));
    const stats1 = pool.getStats();
    const c1 = await pool.acquire();
    const c2 = await pool.acquire();
    const c3 = await pool.acquire();
    const stats2 = pool.getStats();
    pool.release(c1);
    pool.release(c2);
    pool.release(c3);
    const stats3 = pool.getStats();
    await pool.close();
    const ok = stats1.total >= 2 && stats2.inUse === 3 && stats3.inUse === 0;
    record('connectionPool (acquire/release/stats)', ok, `created=${created}, after init total=${stats1.total}, in-use after 3 acquires=${stats2.inUse}, in-use after releases=${stats3.inUse}`);
}
// ===== Test 25: Connection pool - exhausts and queues =====
async function test25_poolQueueing() {
    let created = 0;
    const factory = {
        create: async () => { created++; return `c-${created}`; },
        destroy: async () => { },
    };
    const pool = new src_1.ConnectionPool({ minConnections: 1, maxConnections: 2, idleTimeoutMs: 60000, acquireTimeoutMs: 3000 }, factory, 'q-pool');
    await new Promise(r => setTimeout(r, 50));
    const c1 = await pool.acquire();
    const c2 = await pool.acquire();
    // 3rd request should queue, but timeout since none released
    let caught;
    try {
        await pool.acquire(); // will wait acquireTimeoutMs
    }
    catch (e) {
        caught = e;
    }
    pool.release(c1);
    pool.release(c2);
    await pool.close();
    const ok = caught instanceof src_1.SdkError && caught.code === src_1.ErrorCode.POOL_TIMEOUT;
    record('poolQueueing (POOL_TIMEOUT when full)', ok, `caught: code=${caught?.code}`);
}
// ===== Test 26: updateConfig on instance =====
async function test26_updateConfig() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'config-update-test',
    });
    const oldLevel = sdk.getConfig().log.level;
    sdk.updateConfig({ log: { level: 'error', targets: ['console'] } });
    const newLevel = sdk.getConfig().log.level;
    await sdk.close();
    const ok = oldLevel === 'info' && newLevel === 'error';
    record('updateConfig', ok, `old level=${oldLevel} → new level=${newLevel}`);
}
// ===== Test 27: POST request =====
async function test27_postRequest() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'post-test',
        httpClient: {
            baseUrl: 'http://127.0.0.1:18800',
            timeoutMs: 15000,
            defaultHeaders: {},
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 5,
            maxFreeSockets: 2,
        },
    });
    let resp;
    let err;
    try {
        resp = await sdk.post('/post', { hello: 'world' }, { timeoutMs: 15000 });
    }
    catch (e) {
        err = e;
    }
    await sdk.close();
    const ok = !err && resp?.status === 200 && resp?.data?.json?.hello === 'world';
    record('postRequest', ok, err ? `error: ${err.message}` : `status=${resp?.status}, body.hello=${resp?.data?.json?.hello}`);
}
// ===== Test 28: Boundary - empty body GET =====
async function test28_emptyGet() {
    const sdk = await src_1.default.createInstance({
        serviceName: 'empty-test',
        httpClient: {
            baseUrl: 'http://127.0.0.1:18800',
            timeoutMs: 15000,
            defaultHeaders: {},
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 5,
            maxFreeSockets: 2,
        },
    });
    let resp;
    let err;
    try {
        resp = await sdk.get('/get', { timeoutMs: 15000 });
    }
    catch (e) {
        err = e;
    }
    await sdk.close();
    const ok = !err && resp?.status === 200;
    record('boundary (GET request works)', ok, err ? `error: ${err.message}` : `status=${resp?.status}`);
}
// ===== Test 29: SDK close and re-init =====
async function test29_closeReinit() {
    const sdk = await src_1.default.createInstance({ serviceName: 'reinit-test' });
    const id1 = sdk.getInstanceId();
    await sdk.close();
    const reinit = await src_1.default.createInstance({ serviceName: 'reinit-test-2' });
    const id2 = reinit.getInstanceId();
    await reinit.close();
    const ok = id1 !== id2;
    record('closeAndReinit', ok, `id1=${id1.slice(0, 8)}, id2=${id2.slice(0, 8)}, different=${id1 !== id2}`);
}
// ===== Test 30: getInstance by id =====
async function test30_getInstance() {
    const sdk = await src_1.default.createInstance({ serviceName: 'getinst-test' });
    const id = sdk.getInstanceId();
    const retrieved = src_1.default.getInstance(id);
    const ok = retrieved.getConfig().serviceName === 'getinst-test';
    await sdk.close();
    record('getInstanceById', ok, `retrieved serviceName=${retrieved.getConfig().serviceName}`);
}
// ===== Run all tests =====
(async () => {
    console.log('\n========== SDK Solo-Check Tests ==========\n');
    const tests = [
        test1_defaultConfig, test2_configPriority, test3_yamlLoad, test4_jsonLoad,
        test5_loggerLevels, test6_loggerFilter, test7_loggerFile,
        test8_errorCodes, test9_errorCategories, test10_fromHttpStatus,
        test11_retryBackoff, test12_retryMaxDelay, test13_retryShouldRetry,
        test14_retryExecute, test15_retryExhausted,
        test16_multiInstance, test17_notInitialized,
        test18_httpSuccess, test19_http404, test20_http500,
        test21_globalTimeout, test22_perRequestTimeout,
        test23_healthCheck, test24_connectionPool, test25_poolQueueing,
        test26_updateConfig, test27_postRequest,
        test28_emptyGet, test29_closeReinit, test30_getInstance,
    ];
    for (const t of tests) {
        try {
            await t();
        }
        catch (e) {
            record(t.name, false, `threw: ${e.message}`);
        }
    }
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    console.log(`\n========== Summary ==========`);
    console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) {
        console.log('\nFailures:');
        for (const r of results.filter(r => !r.passed)) {
            console.log(`  - ${r.name}: ${r.message}`);
        }
        process.exit(1);
    }
    process.exit(0);
})();
