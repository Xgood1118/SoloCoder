"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryStrategy = void 0;
const SdkError_1 = require("../errors/SdkError");
class RetryStrategy {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    calculateDelay(attempt) {
        if (attempt <= 0)
            return 0;
        const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
        const jitter = this.calculateJitter(exponentialDelay);
        const delay = Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
        return Math.floor(delay);
    }
    calculateJitter(baseDelay) {
        const maxJitter = baseDelay * 0.1;
        return Math.random() * maxJitter * 2 - maxJitter;
    }
    shouldRetry(error, attempt) {
        if (attempt >= this.config.maxRetries) {
            return false;
        }
        if (error instanceof SdkError_1.SdkError) {
            if (!error.isRetryable()) {
                return false;
            }
            if (error.statusCode && !this.config.retryableStatusCodes.includes(error.statusCode)) {
                return false;
            }
        }
        return true;
    }
    async execute(operation, options = {}) {
        let attempt = 0;
        let totalElapsedMs = 0;
        let lastError;
        const shouldRetryFn = options.shouldRetry || this.shouldRetry.bind(this);
        const calculateDelayFn = options.calculateDelay || this.calculateDelay.bind(this);
        while (true) {
            attempt++;
            try {
                const result = await operation();
                if (attempt > 1 && this.logger) {
                    this.logger.debug('Operation succeeded after retry', {
                        attempt,
                        totalElapsedMs,
                    });
                }
                return result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const context = {
                    attempt,
                    maxRetries: this.config.maxRetries,
                    delayMs: calculateDelayFn(attempt, lastError),
                    totalElapsedMs,
                    lastError,
                };
                if (!shouldRetryFn(lastError, attempt)) {
                    if (this.logger) {
                        this.logger.warn('Operation failed and will not be retried', {
                            attempt,
                            error: lastError.message,
                            code: lastError.code,
                        });
                    }
                    if (attempt > 1) {
                        throw new SdkError_1.SdkError(SdkError_1.ErrorCode.RETRY_TIMEOUT, `All ${attempt} retry attempts failed`, {
                            statusCode: lastError.statusCode,
                            cause: lastError,
                            details: { attempt, totalElapsedMs },
                        });
                    }
                    throw lastError;
                }
                if (options.onRetry) {
                    options.onRetry(context);
                }
                if (this.logger) {
                    this.logger.warn('Retrying operation', {
                        attempt,
                        maxRetries: this.config.maxRetries,
                        delayMs: context.delayMs,
                        error: lastError.message,
                        code: lastError.code,
                    });
                }
                await this.sleep(context.delayMs);
                totalElapsedMs += context.delayMs;
            }
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    static defaultConfig() {
        return {
            maxRetries: 3,
            initialDelayMs: 100,
            maxDelayMs: 5000,
            backoffMultiplier: 2,
            retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        };
    }
}
exports.RetryStrategy = RetryStrategy;
