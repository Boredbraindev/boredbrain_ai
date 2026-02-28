const isProduction = process.env.NODE_ENV === 'production';

const sanitize = (value: unknown) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: isProduction ? undefined : value.stack,
    };
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  return isProduction ? '[redacted]' : value;
};

const createDevOnlyLogger =
  (method: 'log' | 'info') =>
  (...args: unknown[]) => {
    if (!isProduction) {
      console[method](...args);
    }
  };

const createSanitizedLogger =
  (method: 'warn' | 'error') =>
  (...args: unknown[]) => {
    if (isProduction) {
      const sanitizedArgs = args.map((arg, index) =>
        index === 0 && typeof arg === 'string' ? arg : sanitize(arg),
      );
      console[method](...sanitizedArgs);
      return;
    }

    console[method](...args);
  };

export const logger = {
  debug: createDevOnlyLogger('log'),
  info: createDevOnlyLogger('info'),
  warn: createSanitizedLogger('warn'),
  error: createSanitizedLogger('error'),
};

export type Logger = typeof logger;
