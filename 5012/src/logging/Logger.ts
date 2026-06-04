import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { LogConfig, LogLevel, LogOutputTarget } from '../types';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  serviceName: string;
  environment: string;
  requestId?: string;
  traceId?: string;
  data?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private config: LogConfig;
  private serviceName: string;
  private environment: string;
  private fileWriteStream?: fs.WriteStream;
  private pendingRemoteLogs: LogEntry[] = [];
  private remoteFlushTimer?: NodeJS.Timeout;
  private currentRequestId?: string;
  private currentTraceId?: string;

  constructor(
    config: LogConfig,
    serviceName: string,
    environment: string
  ) {
    this.config = config;
    this.serviceName = serviceName;
    this.environment = environment;
    this.initializeFileOutput();
    this.initializeRemoteFlush();
  }

  private initializeFileOutput(): void {
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
      } catch (error) {
        console.warn('Failed to initialize file logging:', error);
      }
    }
  }

  private initializeRemoteFlush(): void {
    if (this.config.targets.includes('remote')) {
      this.remoteFlushTimer = setInterval(() => {
        this.flushRemoteLogs();
      }, 1000);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.config.level];
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
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
        code: (error as any).code,
      };
    }

    return entry;
  }

  private outputToConsole(entry: LogEntry): void {
    const format = (level: LogLevel, msg: string): string => {
      const colors: Record<LogLevel, string> = {
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
    } else if (entry.level === 'warn') {
      console.warn(consoleMsg, entry.data || '');
    } else if (entry.level === 'debug') {
      console.debug(consoleMsg, entry.data || '');
    } else {
      console.log(consoleMsg, entry.data || '');
    }
  }

  private outputToFile(entry: LogEntry): void {
    if (this.fileWriteStream) {
      const logLine = JSON.stringify(entry) + '\n';
      this.fileWriteStream.write(logLine);
    }
  }

  private outputToRemote(entry: LogEntry): void {
    this.pendingRemoteLogs.push(entry);
    if (this.pendingRemoteLogs.length >= 50) {
      this.flushRemoteLogs();
    }
  }

  private async flushRemoteLogs(): Promise<void> {
    if (this.pendingRemoteLogs.length === 0 || !this.config.remoteEndpoint) {
      return;
    }

    const logs = [...this.pendingRemoteLogs];
    this.pendingRemoteLogs = [];

    try {
      const url = new URL(this.config.remoteEndpoint);
      const data = JSON.stringify({ logs });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data).toString(),
      };

      if (this.config.remoteApiKey) {
        headers['Authorization'] = `Bearer ${this.config.remoteApiKey}`;
      }

      const options: http.RequestOptions | https.RequestOptions = {
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
    } catch (error) {
      console.warn('Failed to flush remote logs:', error);
      this.pendingRemoteLogs.unshift(...logs);
    }
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, any>,
    error?: Error
  ): void {
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

  debug(message: string, data?: Record<string, any>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, any>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>, error?: Error): void {
    this.log('warn', message, data, error);
  }

  error(message: string, error?: Error, data?: Record<string, any>): void {
    this.log('error', message, data, error);
  }

  setRequestContext(requestId: string, traceId?: string): void {
    this.currentRequestId = requestId;
    this.currentTraceId = traceId;
  }

  clearRequestContext(): void {
    this.currentRequestId = undefined;
    this.currentTraceId = undefined;
  }

  generateRequestId(): string {
    return uuidv4();
  }

  updateConfig(config: Partial<LogConfig>): void {
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

  async close(): Promise<void> {
    if (this.remoteFlushTimer) {
      clearInterval(this.remoteFlushTimer);
      this.remoteFlushTimer = undefined;
    }

    await this.flushRemoteLogs();

    if (this.fileWriteStream) {
      await new Promise<void>((resolve) => {
        this.fileWriteStream!.end(() => resolve());
      });
      this.fileWriteStream = undefined;
    }
  }
}
