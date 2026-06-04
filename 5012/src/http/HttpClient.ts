import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { HttpClientConfig, RequestOptions, Response, RetryConfig } from '../types';
import { SdkError, ErrorCode } from '../errors/SdkError';
import { Logger } from '../logging/Logger';
import { RetryStrategy, RetryContext } from '../retry/RetryStrategy';

interface QueuedRequest {
  options: RequestOptions;
  resolve: (value: Response<any>) => void;
  reject: (reason: any) => void;
  retryConfig?: Partial<RetryConfig>;
  enqueuedAt: number;
}

export class HttpClient {
  private config: HttpClientConfig;
  private client: AxiosInstance;
  private logger?: Logger;
  private retryStrategy: RetryStrategy;
  private retryQueue: QueuedRequest[] = [];
  private isProcessingQueue: boolean = false;
  private httpAgent: http.Agent;
  private httpsAgent: https.Agent;

  constructor(
    config: HttpClientConfig,
    retryStrategy: RetryStrategy,
    logger?: Logger
  ) {
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

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: config.defaultHeaders,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        const requestId = (config as any).requestId || uuidv4();
        config.headers = config.headers || {};
        config.headers['X-Request-ID'] = requestId;
        (config as any).requestId = requestId;
        (config as any).startTime = Date.now();

        if (this.logger) {
          this.logger.debug('Sending HTTP request', {
            requestId,
            method: config.method,
            url: config.url,
            headers: config.headers,
          });
        }

        return config;
      },
      (error) => {
        return Promise.reject(SdkError.fromError(error));
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        const config = response.config as any;
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
      },
      (error) => {
        const config = error.config as any;
        const requestId = config?.requestId || uuidv4();
        const duration = config ? Date.now() - config.startTime : 0;

        if (this.logger) {
          this.logger.warn('HTTP request failed', {
            id: requestId,
            durationMs: duration,
            status: error.response?.status,
          }, error);
        }

        const sdkError = error.response
          ? SdkError.fromHttpStatus(error.response.status, error.message)
          : SdkError.fromError(error);

        (sdkError as any).requestId = requestId;
        return Promise.reject(sdkError);
      }
    );
  }

  async request<T = any>(
    options: RequestOptions,
    retryConfig?: Partial<RetryConfig>
  ): Promise<Response<T>> {
    const requestId = uuidv4();

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

    const operationRetryStrategy = new RetryStrategy(effectiveRetryConfig, this.logger);

    const operation = async (): Promise<Response<T>> => {
      const axiosConfig: AxiosRequestConfig = {
        method: options.method,
        url: options.url,
        headers: {
          ...this.config.defaultHeaders,
          ...options.headers,
        },
        timeout: options.timeoutMs || this.config.timeoutMs,
        data: options.body,
      };

      (axiosConfig as any).requestId = requestId;

      try {
        const response = await this.client.request<T>(axiosConfig);
        return this.transformResponse<T>(response, requestId);
      } catch (error) {
        if (error instanceof SdkError) {
          if (error.code === ErrorCode.REQUEST_TIMEOUT) {
            this.enqueueForRetry(options, requestId, retryConfig);
          }
          throw error;
        }
        throw SdkError.fromError(error as Error);
      }
    };

    try {
      const result = await operationRetryStrategy.execute<Response<T>>(operation, {
        onRetry: (context: RetryContext) => {
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
    } catch (error) {
      if (error instanceof SdkError) {
        (error as any).requestId = requestId;
      }
      throw error;
    }
  }

  private transformResponse<T>(
    response: AxiosResponse<T>,
    requestId: string
  ): Response<T> {
    const headers: Record<string, string> = {};
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

  private enqueueForRetry(
    options: RequestOptions,
    requestId: string,
    retryConfig?: Partial<RetryConfig>
  ): void {
    if (this.logger) {
      this.logger.info('Request timed out, enqueuing for retry', {
        requestId,
        queueSize: this.retryQueue.length + 1,
      });
    }

    this.retryQueue.push({
      options,
      resolve: () => {},
      reject: () => {},
      retryConfig,
      enqueuedAt: Date.now(),
    });

    this.processRetryQueue();
  }

  private async processRetryQueue(): Promise<void> {
    if (this.isProcessingQueue || this.retryQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.retryQueue.length > 0) {
        const request = this.retryQueue.shift()!;
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
        } catch (error) {
          request.reject(error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async get<T = any>(
    url: string,
    options: Omit<RequestOptions, 'method' | 'url'> = {}
  ): Promise<Response<T>> {
    return this.request<T>({ ...options, method: 'GET', url });
  }

  async post<T = any>(
    url: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'url' | 'body'> = {}
  ): Promise<Response<T>> {
    return this.request<T>({ ...options, method: 'POST', url, body });
  }

  async put<T = any>(
    url: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'url' | 'body'> = {}
  ): Promise<Response<T>> {
    return this.request<T>({ ...options, method: 'PUT', url, body });
  }

  async delete<T = any>(
    url: string,
    options: Omit<RequestOptions, 'method' | 'url'> = {}
  ): Promise<Response<T>> {
    return this.request<T>({ ...options, method: 'DELETE', url });
  }

  async patch<T = any>(
    url: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'url' | 'body'> = {}
  ): Promise<Response<T>> {
    return this.request<T>({ ...options, method: 'PATCH', url, body });
  }

  updateConfig(config: Partial<HttpClientConfig>): void {
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

  getConfig(): HttpClientConfig {
    return { ...this.config };
  }

  getRetryQueueSize(): number {
    return this.retryQueue.length;
  }

  close(): void {
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
    this.retryQueue = [];
  }
}
