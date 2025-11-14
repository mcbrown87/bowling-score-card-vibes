import * as Sentry from '@sentry/node';
import type { NodeOptions, SeverityLevel } from '@sentry/node';

export type LogAttributes = Record<string, unknown>;

const serviceName = process.env.SERVICE_NAME ?? 'bowling-backend';
const environment = process.env.NODE_ENV ?? 'development';
const sentryDsn = process.env.SENTRY_DSN;
const release = process.env.SENTRY_RELEASE ?? process.env.RELEASE ?? process.env.GIT_SHA;
const enableSentry = Boolean(sentryDsn);

if (enableSentry && sentryDsn) {
  const options: NodeOptions = {
    dsn: sentryDsn,
    environment,
    serverName: serviceName,
    autoSessionTracking: false,
    tracesSampleRate: 0 // explicitly disable tracing since we only want error logging
  };

  if (release) {
    options.release = release;
  }

  Sentry.init(options);
}

type InternalLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const sentryLevelMap: Record<InternalLevel, SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
  fatal: 'fatal'
};

const consoleMap: Record<InternalLevel, (message?: unknown, ...optionalParams: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  fatal: console.error
};

const sentryEligibleLevels: Set<InternalLevel> = new Set(['warn', 'error', 'fatal']);

const captureInSentry = (
  level: InternalLevel,
  message: string,
  attributes?: LogAttributes,
  error?: unknown
) => {
  if (!sentryEligibleLevels.has(level)) {
    if (!enableSentry) {
      console.debug('[sentry] Skipping capture (disabled)', { level, message });
    }
    return;
  }

  if (!enableSentry) {
    console.debug('[sentry] capture skipped (dsn not configured)', { level, message });
    return;
  }

  const sentryLevel = sentryLevelMap[level];

  console.info('[sentry] capturing event', {
    level: sentryLevel,
    message,
    hasError: error instanceof Error,
    attributes
  });

  Sentry.withScope(scope => {
    scope.setTag('service', serviceName);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    if (error instanceof Error) {
      scope.setExtra('log.message', message);
      scope.setLevel(sentryLevel);
      Sentry.captureException(error);
    } else if (error !== undefined) {
      scope.setExtra('log.message', message);
      scope.setExtra('error.value', error);
      scope.setLevel(sentryLevel);
      Sentry.captureMessage(message, sentryLevel);
    } else {
      scope.setLevel(sentryLevel);
      Sentry.captureMessage(message, sentryLevel);
    }
  });
};

const emitLog = (level: InternalLevel, message: string, attributes?: LogAttributes, error?: unknown) => {
  const consoleLogger = consoleMap[level];
  const consoleArgs: unknown[] = [message];

  if (attributes && Object.keys(attributes).length > 0) {
    consoleArgs.push(attributes);
  }

  if (error !== undefined) {
    consoleArgs.push(error);
  }

  consoleLogger?.(...consoleArgs);

  captureInSentry(level, message, attributes, error);
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
