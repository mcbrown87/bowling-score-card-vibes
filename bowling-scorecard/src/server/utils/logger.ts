export type LogAttributes = Record<string, unknown>;

const serviceName = process.env.SERVICE_NAME ?? 'bowling-backend';
const environment = process.env.NODE_ENV ?? 'development';

type InternalLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const consoleMap: Record<InternalLevel, (message?: unknown, ...optionalParams: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  fatal: console.error
};

const emitLog = (level: InternalLevel, message: string, attributes?: LogAttributes, error?: unknown) => {
  const consoleLogger = consoleMap[level];
  const consoleArgs: unknown[] = [message, { service: serviceName, environment }];

  if (attributes && Object.keys(attributes).length > 0) {
    consoleArgs.push(attributes);
  }

  if (error !== undefined) {
    consoleArgs.push(error);
  }

  consoleLogger?.(...consoleArgs);
};

export const logger = {
  debug: (message: string, attributes?: LogAttributes) => {
    emitLog('debug', message, attributes);
  },
  info: (message: string, attributes?: LogAttributes) => {
    emitLog('info', message, attributes);
  },
  warn: (message: string, attributes?: LogAttributes) => {
    emitLog('warn', message, attributes);
  },
  error: (message: string, error?: unknown, attributes?: LogAttributes) => {
    emitLog('error', message, attributes, error);
  },
  fatal: (message: string, error?: unknown, attributes?: LogAttributes) => {
    emitLog('fatal', message, attributes, error);
  }
};

export type Logger = typeof logger;
