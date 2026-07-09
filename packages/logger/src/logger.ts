export interface LoggerContext {
  requestId?: string | undefined;
  tenantId?: string | undefined;
  userId?: string | undefined;
  [key: string]: unknown;
}

export interface LoggerEntry extends LoggerContext {
  serviceName: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

export interface StructuredLogger {
  readonly serviceName: string;
  withContext(context: LoggerContext): StructuredLogger;
  debug(message: string, context?: LoggerContext): void;
  info(message: string, context?: LoggerContext): void;
  warn(message: string, context?: LoggerContext): void;
  error(message: string, context?: LoggerContext): void;
}

function buildEntry(
  serviceName: string,
  level: LoggerEntry["level"],
  message: string,
  baseContext: LoggerContext,
  context?: LoggerContext,
): LoggerEntry {
  return {
    serviceName,
    level,
    message,
    timestamp: new Date().toISOString(),
    ...baseContext,
    ...context,
  };
}

function emit(entry: LoggerEntry) {
  const payload = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(payload);
    return;
  }
  if (entry.level === "warn") {
    console.warn(payload);
    return;
  }
  console.log(payload);
}

class ConsoleStructuredLogger implements StructuredLogger {
  constructor(
    public readonly serviceName: string,
    private readonly baseContext: LoggerContext = {},
  ) {}

  withContext(context: LoggerContext): StructuredLogger {
    return new ConsoleStructuredLogger(this.serviceName, { ...this.baseContext, ...context });
  }

  debug(message: string, context: LoggerContext = {}): void {
    emit(buildEntry(this.serviceName, "debug", message, this.baseContext, context));
  }

  info(message: string, context: LoggerContext = {}): void {
    emit(buildEntry(this.serviceName, "info", message, this.baseContext, context));
  }

  warn(message: string, context: LoggerContext = {}): void {
    emit(buildEntry(this.serviceName, "warn", message, this.baseContext, context));
  }

  error(message: string, context: LoggerContext = {}): void {
    emit(buildEntry(this.serviceName, "error", message, this.baseContext, context));
  }
}

export function createLogger(serviceName: string, context: LoggerContext = {}): StructuredLogger {
  return new ConsoleStructuredLogger(serviceName, context);
}
