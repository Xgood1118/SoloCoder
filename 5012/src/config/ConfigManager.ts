import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as yargs from 'yargs';
import { SdkConfig, ConfigFormat, ConfigLoadOptions, ConfigSource } from '../types';
import { defaultConfig } from './defaults';

export class ConfigManager {
  private config: SdkConfig;
  private configSources: Map<string, ConfigSource> = new Map();
  private initialConfig: Partial<SdkConfig>;

  constructor(initialConfig?: Partial<SdkConfig>) {
    this.initialConfig = initialConfig || {};
    this.config = this.deepMerge(defaultConfig, this.initialConfig);
  }

  async load(options: ConfigLoadOptions = {}): Promise<SdkConfig> {
    const fileConfig = await this.loadFromFile(options);
    const cliConfig = this.loadFromCli();
    const envConfig = this.loadFromEnvironment(options.prefix);

    this.trackConfigSources(this.initialConfig, 'programmatic');
    this.config = this.deepMerge(
      defaultConfig,
      this.initialConfig,
      fileConfig,
      cliConfig,
      envConfig
    );

    return this.config;
  }

  private async loadFromFile(options: ConfigLoadOptions): Promise<Partial<SdkConfig>> {
    const configPath = options.configPath || this.getDefaultConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const format = options.format || this.detectFormat(configPath);
      const config = this.parseConfig(content, format);
      this.trackConfigSources(config, 'file');
      return config;
    } catch (error) {
      console.warn(`Failed to load config from file: ${configPath}`, error);
      return {};
    }
  }

  private loadFromCli(): Partial<SdkConfig> {
    try {
      const argv = yargs
        .option('service-name', { type: 'string' })
        .option('environment', { type: 'string' })
        .option('log-level', { type: 'string', choices: ['debug', 'info', 'warn', 'error'] })
        .option('log-targets', { type: 'string' })
        .option('http-base-url', { type: 'string' })
        .option('http-timeout', { type: 'number' })
        .option('retry-max-retries', { type: 'number' })
        .option('health-check-enabled', { type: 'boolean' })
        .parseSync();

      const cliConfig: any = {};

      if (argv['service-name']) cliConfig.serviceName = argv['service-name'];
      if (argv['environment']) cliConfig.environment = argv['environment'];
      if (argv['log-level'] || argv['log-targets']) {
        cliConfig.log = {} as any;
        if (argv['log-level']) cliConfig.log.level = argv['log-level'] as any;
        if (argv['log-targets']) {
          cliConfig.log.targets = argv['log-targets'].split(',') as any;
        }
      }
      if (argv['http-base-url'] || argv['http-timeout']) {
        cliConfig.httpClient = {} as any;
        if (argv['http-base-url']) cliConfig.httpClient.baseUrl = argv['http-base-url'];
        if (argv['http-timeout']) cliConfig.httpClient.timeoutMs = argv['http-timeout'];
      }
      if (argv['retry-max-retries']) {
        cliConfig.retry = { maxRetries: argv['retry-max-retries'] } as any;
      }
      if (argv['health-check-enabled'] !== undefined) {
        cliConfig.healthCheck = { enabled: argv['health-check-enabled'] } as any;
      }

      this.trackConfigSources(cliConfig, 'cli');
      return cliConfig;
    } catch (error) {
      console.warn('Failed to parse CLI arguments', error);
      return {};
    }
  }

  private loadFromEnvironment(prefix: string = 'SDK_'): Partial<SdkConfig> {
    const env = process.env;
    const envConfig: any = {};

    const getEnv = (key: string): string | undefined => {
      return env[prefix + key] || env[key];
    };

    const parseArray = (value: string): string[] => {
      return value.split(',').map(v => v.trim());
    };

    const parseNumber = (value: string): number | undefined => {
      const num = parseInt(value, 10);
      return isNaN(num) ? undefined : num;
    };

    const parseBoolean = (value: string): boolean | undefined => {
      return value === 'true' ? true : value === 'false' ? false : undefined;
    };

    if (getEnv('SERVICE_NAME')) envConfig.serviceName = getEnv('SERVICE_NAME')!;
    if (getEnv('ENVIRONMENT')) envConfig.environment = getEnv('ENVIRONMENT')!;

    envConfig.log = {} as any;
    if (getEnv('LOG_LEVEL')) envConfig.log.level = getEnv('LOG_LEVEL') as any;
    if (getEnv('LOG_TARGETS')) envConfig.log.targets = parseArray(getEnv('LOG_TARGETS')!) as any;
    if (getEnv('LOG_FILE_PATH')) envConfig.log.filePath = getEnv('LOG_FILE_PATH');
    if (getEnv('LOG_REMOTE_ENDPOINT')) envConfig.log.remoteEndpoint = getEnv('LOG_REMOTE_ENDPOINT');
    if (getEnv('LOG_REMOTE_API_KEY')) envConfig.log.remoteApiKey = getEnv('LOG_REMOTE_API_KEY');

    envConfig.retry = {} as any;
    if (getEnv('RETRY_MAX_RETRIES')) envConfig.retry.maxRetries = parseNumber(getEnv('RETRY_MAX_RETRIES')!)!;
    if (getEnv('RETRY_INITIAL_DELAY_MS')) envConfig.retry.initialDelayMs = parseNumber(getEnv('RETRY_INITIAL_DELAY_MS')!)!;
    if (getEnv('RETRY_MAX_DELAY_MS')) envConfig.retry.maxDelayMs = parseNumber(getEnv('RETRY_MAX_DELAY_MS')!)!;
    if (getEnv('RETRY_BACKOFF_MULTIPLIER')) envConfig.retry.backoffMultiplier = parseNumber(getEnv('RETRY_BACKOFF_MULTIPLIER')!)!;

    envConfig.httpClient = {} as any;
    if (getEnv('HTTP_BASE_URL')) envConfig.httpClient.baseUrl = getEnv('HTTP_BASE_URL')!;
    if (getEnv('HTTP_TIMEOUT_MS')) envConfig.httpClient.timeoutMs = parseNumber(getEnv('HTTP_TIMEOUT_MS')!)!;
    if (getEnv('HTTP_KEEP_ALIVE')) envConfig.httpClient.keepAlive = parseBoolean(getEnv('HTTP_KEEP_ALIVE')!)!;
    if (getEnv('HTTP_MAX_SOCKETS')) envConfig.httpClient.maxSockets = parseNumber(getEnv('HTTP_MAX_SOCKETS')!)!;

    envConfig.connectionPool = {} as any;
    if (getEnv('POOL_MIN_CONNECTIONS')) envConfig.connectionPool.minConnections = parseNumber(getEnv('POOL_MIN_CONNECTIONS')!)!;
    if (getEnv('POOL_MAX_CONNECTIONS')) envConfig.connectionPool.maxConnections = parseNumber(getEnv('POOL_MAX_CONNECTIONS')!)!;
    if (getEnv('POOL_IDLE_TIMEOUT_MS')) envConfig.connectionPool.idleTimeoutMs = parseNumber(getEnv('POOL_IDLE_TIMEOUT_MS')!)!;

    envConfig.healthCheck = {} as any;
    if (getEnv('HEALTH_CHECK_ENABLED')) envConfig.healthCheck.enabled = parseBoolean(getEnv('HEALTH_CHECK_ENABLED')!)!;
    if (getEnv('HEALTH_CHECK_INTERVAL_MS')) envConfig.healthCheck.intervalMs = parseNumber(getEnv('HEALTH_CHECK_INTERVAL_MS')!)!;
    if (getEnv('HEALTH_CHECK_PATH')) envConfig.healthCheck.path = getEnv('HEALTH_CHECK_PATH')!;

    this.cleanEmptyObjects(envConfig);
    this.trackConfigSources(envConfig, 'environment');
    return envConfig;
  }

  private parseConfig(content: string, format: ConfigFormat): Partial<SdkConfig> {
    switch (format) {
      case 'json':
        return JSON.parse(content);
      case 'yaml':
        return yaml.load(content) as Partial<SdkConfig>;
      default:
        throw new Error(`Unsupported config format: ${format}`);
    }
  }

  private detectFormat(filePath: string): ConfigFormat {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') return 'json';
    if (ext === '.yaml' || ext === '.yml') return 'yaml';
    throw new Error(`Cannot detect config format from extension: ${ext}`);
  }

  private getDefaultConfigPath(): string | undefined {
    const possiblePaths = [
      './sdk.config.json',
      './sdk.config.yaml',
      './sdk.config.yml',
      './config/sdk.config.json',
      './config/sdk.config.yaml',
      './config/sdk.config.yml',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return undefined;
  }

  private trackConfigSources(config: Partial<SdkConfig>, source: ConfigSource, prefix: string = ''): void {
    for (const [key, value] of Object.entries(config)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.trackConfigSources(value as Partial<SdkConfig>, source, fullKey);
      } else if (value !== undefined) {
        this.configSources.set(fullKey, source);
      }
    }
  }

  private cleanEmptyObjects(obj: any): void {
    for (const key of Object.keys(obj)) {
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        this.cleanEmptyObjects(obj[key]);
        if (Object.keys(obj[key]).length === 0) {
          delete obj[key];
        }
      }
    }
  }

  private deepMerge(...sources: any[]): any {
    const result: any = {};

    for (const source of sources) {
      if (!source) continue;

      for (const key of Object.keys(source)) {
        const value = source[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this.deepMerge(result[key] || {}, value);
        } else if (value !== undefined) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  getConfig(): SdkConfig {
    return this.deepMerge({}, this.config);
  }

  updateConfig(updates: Partial<SdkConfig>): void {
    this.config = this.deepMerge(this.config, updates);
  }

  getConfigSource(key: string): ConfigSource | undefined {
    return this.configSources.get(key);
  }

  getAllConfigSources(): Map<string, ConfigSource> {
    return new Map(this.configSources);
  }
}
