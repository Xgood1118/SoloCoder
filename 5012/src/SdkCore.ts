import { v4 as uuidv4 } from 'uuid';
import { SdkConfig, ConfigLoadOptions, RequestOptions, Response, HealthStatus, SdkConfig as SdkConfigType } from './types';
import { ConfigManager } from './config/ConfigManager';
import { Logger } from './logging/Logger';
import { SdkError, ErrorCode } from './errors/SdkError';
import { RetryStrategy } from './retry/RetryStrategy';
import { ConnectionPool, ConnectionFactory } from './pool/ConnectionPool';
import { HttpClient } from './http/HttpClient';
import { HealthChecker, HealthCheck } from './health/HealthChecker';

export interface SdkInstance {
  id: string;
  config: SdkConfig;
  logger: Logger;
  httpClient: HttpClient;
  retryStrategy: RetryStrategy;
  healthChecker: HealthChecker;
  connectionPool?: ConnectionPool<any>;
}

export class SdkCore {
  private static instances: Map<string, SdkInstance> = new Map();
  private static defaultInstance?: SdkCore;

  private instanceId: string;
  private configManager: ConfigManager;
  private logger!: Logger;
  private retryStrategy!: RetryStrategy;
  private httpClient!: HttpClient;
  private healthChecker!: HealthChecker;
  private connectionPool?: ConnectionPool<any>;
  private initialized: boolean = false;

  constructor(config?: Partial<SdkConfigType>) {
    this.instanceId = uuidv4();
    this.configManager = new ConfigManager(config);
  }

  async initialize(options: ConfigLoadOptions = {}): Promise<this> {
    if (this.initialized) {
      return this;
    }

    const config = await this.configManager.load(options);

    this.logger = new Logger(
      config.log,
      config.serviceName,
      config.environment
    );

    this.retryStrategy = new RetryStrategy(
      config.retry,
      this.logger
    );

    this.httpClient = new HttpClient(
      config.httpClient,
      this.retryStrategy,
      this.logger
    );

    this.healthChecker = new HealthChecker(
      config.healthCheck,
      this.logger,
      this.httpClient
    );

    const defaultChecks = HealthChecker.defaultChecks(this.httpClient, config.healthCheck);
    for (const check of defaultChecks) {
      this.healthChecker.addCheck(check);
    }

    if (config.healthCheck.enabled) {
      this.healthChecker.start();
    }

    const instance: SdkInstance = {
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

  static async createInstance(config?: Partial<SdkConfigType>, options: ConfigLoadOptions = {}): Promise<SdkCore> {
    const instance = new SdkCore(config);
    await instance.initialize(options);
    return instance;
  }

  static getInstance(instanceId?: string): SdkCore {
    if (!instanceId) {
      if (!SdkCore.defaultInstance) {
        throw new SdkError(ErrorCode.CONFIG_ERROR, 'No default SDK instance found. Call createInstance() first.');
      }
      return SdkCore.defaultInstance;
    }

    const instance = SdkCore.instances.get(instanceId);
    if (!instance) {
      throw new SdkError(ErrorCode.CONFIG_ERROR, `SDK instance not found: ${instanceId}`);
    }

    const core = new SdkCore();
    (core as any).instanceId = instanceId;
    (core as any).configManager = new ConfigManager(instance.config);
    (core as any).logger = instance.logger;
    (core as any).retryStrategy = instance.retryStrategy;
    (core as any).httpClient = instance.httpClient;
    (core as any).healthChecker = instance.healthChecker;
    (core as any).connectionPool = instance.connectionPool;
    (core as any).initialized = true;

    return core;
  }

  static setDefaultInstance(instance: SdkCore): void {
    SdkCore.defaultInstance = instance;
  }

  static getAllInstances(): string[] {
    return Array.from(SdkCore.instances.keys());
  }

  async request<T = any>(options: RequestOptions): Promise<Response<T>> {
    this.ensureInitialized();
    return this.httpClient.request<T>(options, options.retryConfig);
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

  getConfig(): SdkConfig {
    return this.configManager.getConfig();
  }

  updateConfig(updates: Partial<SdkConfig>): void {
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

  getLogger(): Logger {
    this.ensureInitialized();
    return this.logger;
  }

  getRetryStrategy(): RetryStrategy {
    this.ensureInitialized();
    return this.retryStrategy;
  }

  getHttpClient(): HttpClient {
    this.ensureInitialized();
    return this.httpClient;
  }

  getHealthChecker(): HealthChecker {
    this.ensureInitialized();
    return this.healthChecker;
  }

  setConnectionPool<T>(factory: ConnectionFactory<T>): ConnectionPool<T> {
    this.ensureInitialized();

    if (this.connectionPool) {
      this.connectionPool.close().catch((err) => {
        this.logger.warn('Error closing existing connection pool', err);
      });
    }

    const config = this.configManager.getConfig();
    this.connectionPool = new ConnectionPool<T>(
      config.connectionPool,
      factory,
      `${config.serviceName}-pool`,
      this.logger
    );

    const instance = SdkCore.instances.get(this.instanceId);
    if (instance) {
      instance.connectionPool = this.connectionPool;
    }

    return this.connectionPool;
  }

  getConnectionPool<T>(): ConnectionPool<T> | undefined {
    this.ensureInitialized();
    return this.connectionPool as ConnectionPool<T> | undefined;
  }

  addHealthCheck(check: HealthCheck): void {
    this.ensureInitialized();
    this.healthChecker.addCheck(check);
  }

  removeHealthCheck(name: string): void {
    this.ensureInitialized();
    this.healthChecker.removeCheck(name);
  }

  async checkHealth(): Promise<HealthStatus> {
    this.ensureInitialized();
    return this.healthChecker.checkHealth();
  }

  getLastHealthStatus(): HealthStatus | undefined {
    this.ensureInitialized();
    return this.healthChecker.getLastStatus();
  }

  setRequestContext(requestId: string, traceId?: string): void {
    this.ensureInitialized();
    this.logger.setRequestContext(requestId, traceId);
  }

  clearRequestContext(): void {
    this.ensureInitialized();
    this.logger.clearRequestContext();
  }

  generateRequestId(): string {
    return uuidv4();
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new SdkError(ErrorCode.CONFIG_ERROR, 'SDK not initialized. Call initialize() first.');
    }
  }

  async close(): Promise<void> {
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

    if (SdkCore.defaultInstance && (SdkCore.defaultInstance as any).instanceId === this.instanceId) {
      SdkCore.defaultInstance = undefined;
    }

    this.initialized = false;
  }

  static async closeAll(): Promise<void> {
    const instanceIds = Array.from(SdkCore.instances.keys());

    for (const id of instanceIds) {
      const instance = SdkCore.instances.get(id);
      if (instance) {
        try {
          const core = new SdkCore();
          (core as any).instanceId = id;
          (core as any).configManager = new ConfigManager(instance.config);
          (core as any).logger = instance.logger;
          (core as any).retryStrategy = instance.retryStrategy;
          (core as any).httpClient = instance.httpClient;
          (core as any).healthChecker = instance.healthChecker;
          (core as any).connectionPool = instance.connectionPool;
          (core as any).initialized = true;

          await core.close();
        } catch (error) {
          console.error(`Error closing SDK instance ${id}:`, error);
        }
      }
    }

    SdkCore.instances.clear();
    SdkCore.defaultInstance = undefined;
  }
}
