import { RetryConfig } from '../types';
import { SdkError, ErrorCode } from '../errors/SdkError';
import { Logger } from '../logging/Logger';

export interface RetryContext {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  totalElapsedMs: number;
  lastError?: Error;
}

export interface RetryOptions {
  onRetry?: (context: RetryContext) => void;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  calculateDelay?: (attempt: number, error?: Error) => number;
}

export class RetryStrategy {
  private config: RetryConfig;
  private logger?: Logger;

  constructor(config: RetryConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  calculateDelay(attempt: number): number {
    if (attempt <= 0) return 0;

    const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const jitter = this.calculateJitter(exponentialDelay);
    const delay = Math.min(exponentialDelay + jitter, this.config.maxDelayMs);

    return Math.floor(delay);
  }

  private calculateJitter(baseDelay: number): number {
    const maxJitter = baseDelay * 0.1;
    return Math.random() * maxJitter * 2 - maxJitter;
  }

  shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    if (error instanceof SdkError) {
      if (!error.isRetryable()) {
        return false;
      }

      if (error.statusCode && !this.config.retryableStatusCodes.includes(error.statusCode)) {
        return false;
      }
    }

    return true;
  }

  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    let attempt = 0;
    let totalElapsedMs = 0;
    let lastError: Error | undefined;

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
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const context: RetryContext = {
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
              code: (lastError as SdkError).code,
            });
          }

          if (attempt > 1) {
            throw new SdkError(ErrorCode.RETRY_TIMEOUT, `All ${attempt} retry attempts failed`, {
              statusCode: (lastError as SdkError).statusCode,
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
            code: (lastError as SdkError).code,
          });
        }

        await this.sleep(context.delayMs);
        totalElapsedMs += context.delayMs;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RetryConfig {
    return { ...this.config };
  }

  static defaultConfig(): RetryConfig {
    return {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    };
  }
}
