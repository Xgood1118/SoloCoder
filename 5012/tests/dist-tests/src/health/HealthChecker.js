"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthChecker = void 0;
const SdkError_1 = require("../errors/SdkError");
class HealthChecker {
    constructor(config, logger, httpClient) {
        this.checks = new Map();
        this.isRunning = false;
        this.config = config;
        this.logger = logger;
        this.httpClient = httpClient;
    }
    addCheck(check) {
        this.checks.set(check.name, check);
        if (this.logger) {
            this.logger.debug('Health check added', { checkName: check.name });
        }
    }
    removeCheck(name) {
        this.checks.delete(name);
        if (this.logger) {
            this.logger.debug('Health check removed', { checkName: name });
        }
    }
    async checkHealth() {
        const details = {};
        let overallHealthy = true;
        for (const [name, check] of this.checks.entries()) {
            const startTime = Date.now();
            try {
                const result = await check.check();
                const latencyMs = Date.now() - startTime;
                details[name] = {
                    healthy: result.healthy,
                    latencyMs,
                    error: result.error,
                    ...result.details,
                };
                if (!result.healthy) {
                    overallHealthy = false;
                }
                if (this.logger) {
                    this.logger.debug('Health check completed', {
                        checkName: name,
                        healthy: result.healthy,
                        latencyMs,
                    });
                }
            }
            catch (error) {
                const latencyMs = Date.now() - startTime;
                details[name] = {
                    healthy: false,
                    latencyMs,
                    error: error instanceof Error ? error.message : String(error),
                };
                overallHealthy = false;
                if (this.logger) {
                    this.logger.warn('Health check failed', {
                        name,
                        latencyMs,
                    }, error);
                }
            }
        }
        if (this.config.enabled && this.httpClient) {
            const backendHealth = await this.checkBackendHealth();
            details.backend = backendHealth;
            if (!backendHealth.healthy) {
                overallHealthy = false;
            }
        }
        const status = {
            healthy: overallHealthy,
            timestamp: new Date().toISOString(),
            details,
        };
        this.lastHealthStatus = status;
        if (this.logger) {
            this.logger.debug('Overall health status', {
                healthy: overallHealthy,
                checkCount: this.checks.size,
            });
        }
        return status;
    }
    async checkBackendHealth() {
        if (!this.httpClient) {
            return { healthy: true };
        }
        const startTime = Date.now();
        try {
            await this.httpClient.get(this.config.path, {
                timeoutMs: this.config.timeoutMs,
            });
            return {
                healthy: true,
                latencyMs: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                healthy: false,
                latencyMs: Date.now() - startTime,
                error: error instanceof SdkError_1.SdkError ? error.message : String(error),
            };
        }
    }
    start() {
        if (this.isRunning || !this.config.enabled) {
            return;
        }
        this.isRunning = true;
        this.checkHealth().catch((err) => {
            if (this.logger) {
                this.logger.warn('Initial health check failed', err);
            }
        });
        this.healthTimer = setInterval(() => {
            this.checkHealth().catch((err) => {
                if (this.logger) {
                    this.logger.warn('Periodic health check failed', err);
                }
            });
        }, this.config.intervalMs);
        if (this.logger) {
            this.logger.info('Health checker started', {
                intervalMs: this.config.intervalMs,
                checkCount: this.checks.size,
            });
        }
    }
    stop() {
        if (this.healthTimer) {
            clearInterval(this.healthTimer);
            this.healthTimer = undefined;
        }
        this.isRunning = false;
        if (this.logger) {
            this.logger.info('Health checker stopped');
        }
    }
    getLastStatus() {
        return this.lastHealthStatus;
    }
    updateConfig(config) {
        const wasEnabled = this.config.enabled;
        this.config = { ...this.config, ...config };
        if (wasEnabled && !this.config.enabled) {
            this.stop();
        }
        else if (!wasEnabled && this.config.enabled) {
            this.start();
        }
        else if (this.isRunning && config.intervalMs !== undefined) {
            this.stop();
            this.start();
        }
    }
    getConfig() {
        return { ...this.config };
    }
    static defaultChecks(httpClient, config) {
        return [
            {
                name: 'sdk-internal',
                check: async () => ({ healthy: true }),
            },
            {
                name: 'backend-connectivity',
                check: async () => {
                    try {
                        const startTime = Date.now();
                        await httpClient.get(config.path, {
                            timeoutMs: config.timeoutMs,
                        });
                        return {
                            healthy: true,
                            details: { latencyMs: Date.now() - startTime },
                        };
                    }
                    catch (error) {
                        return {
                            healthy: false,
                            error: error instanceof Error ? error.message : String(error),
                        };
                    }
                },
            },
        ];
    }
}
exports.HealthChecker = HealthChecker;
