import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import chalk from 'chalk';
import config from '../config/env';

const LEVEL_COLORS: Record<string, chalk.Chalk> = {
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
  debug: chalk.gray,
};

const LEVEL_PRIORITY: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function extractLogInfo(info: Record<string, unknown>): { level: string; module: string; message: string; meta: Record<string, unknown>; timestamp: string } {
  const { level, module, message, timestamp, ...rest } = info;
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k !== 'Symbol(level)') {
      meta[k] = v;
    }
  }
  return {
    level: typeof level === 'string' ? level : String(level),
    module: typeof module === 'string' ? module : 'app',
    message: typeof message === 'string' ? message : String(message),
    meta,
    timestamp: typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
  };
}

function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

const consoleFormat = winston.format.printf((info) => {
  const { level, module, message, meta, timestamp } = extractLogInfo(info);
  const colorFn = LEVEL_COLORS[level] || chalk.white;
  const coloredLevel = colorFn(level.toUpperCase().padEnd(5));
  const coloredModule = chalk.cyan(`[${module}]`);
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} | ${coloredLevel} | ${coloredModule} | ${message}${metaStr}`;
});

const fileFormat = winston.format.printf((info) => {
  const { level, module, message, meta, timestamp } = extractLogInfo(info);
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} | ${level.toUpperCase().padEnd(5)} | [${module}] | ${message}${metaStr}`;
});

const stripAnsiFormat = winston.format((info) => {
  const stripped = { ...info };
  Object.keys(stripped).forEach((key) => {
    if (typeof stripped[key] === 'string') {
      stripped[key] = (stripped[key] as string).replace(/\x1B\[[0-9;]*[JKmsu]/g, '');
    }
  });
  return stripped;
});

const transports: winston.transport[] = [];

transports.push(
  new winston.transports.Console({
    level: config.logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: formatTimestamp }),
      consoleFormat
    ),
  })
);

const logDir = config.logDir;
transports.push(
  new DailyRotateFile({
    level: config.logLevel,
    dirname: logDir,
    filename: 'monitor-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '100m',
    format: winston.format.combine(
      stripAnsiFormat(),
      winston.format.timestamp({ format: formatTimestamp }),
      fileFormat
    ),
  })
);

const logger = winston.createLogger({
  levels: LEVEL_PRIORITY,
  level: config.logLevel,
  transports,
  exitOnError: false,
});

export function createModuleLogger(moduleName: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => {
      logger.info(message, { module: moduleName, ...meta });
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      logger.warn(message, { module: moduleName, ...meta });
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      logger.error(message, { module: moduleName, ...meta });
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      logger.debug(message, { module: moduleName, ...meta });
    },
    setLevel: (level: string) => {
      logger.level = level;
    },
    getLevel: () => logger.level,
  };
}

export type ModuleLogger = ReturnType<typeof createModuleLogger>;

export default logger;
