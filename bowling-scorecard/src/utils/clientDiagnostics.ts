import { resolveApiBaseUrl } from './api';

type ClientLogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ClientLogPayload {
  level?: ClientLogLevel;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

type InternalClientLogPayload = {
  level: ClientLogLevel;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
};

const postClientLog = async (payload: InternalClientLogPayload) => {
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/api/client-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to flush client diagnostics', error);
  }
};

export const logClientEvent = async (payload: ClientLogPayload) => {
  if (typeof window === 'undefined') {
    return;
  }

  const basePayload: InternalClientLogPayload = {
    level: payload.level ?? 'info',
    message: payload.message,
    context: {
      ...payload.context,
      href: window.location.href,
      timestamp: new Date().toISOString()
    }
  };

  if (payload.stack) {
    basePayload.stack = payload.stack;
  }

  await postClientLog(basePayload);
};

export const initClientDiagnostics = () => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleError = (event: ErrorEvent) => {
    const stack =
      event.error instanceof Error
        ? event.error.stack
        : `${event.filename ?? 'unknown'}:${event.lineno ?? 0}:${event.colno ?? 0}`;

    void logClientEvent({
      level: 'error',
      message: event.message || 'Uncaught error',
      stack,
      context: {
        type: 'window.error'
      }
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    let message = 'Unhandled promise rejection';
    let stack: string | undefined;

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack;
    } else if (typeof reason === 'string') {
      message = reason;
    } else {
      try {
        message = JSON.stringify(reason);
      } catch {
        message = String(reason);
      }
    }

    void logClientEvent({
      level: 'error',
      message,
      stack,
      context: {
        type: 'window.unhandledrejection'
      }
    });
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
};
