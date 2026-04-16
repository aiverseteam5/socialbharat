/**
 * Isomorphic structured JSON logger.
 * - Server (Node): writes single-line JSON to stdout/stderr for log aggregators.
 * - Browser: forwards to the native console so logs still appear in DevTools.
 * - Tests (NODE_ENV='test'): suppressed unless LOG_IN_TESTS is set.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const isBrowser = typeof window !== "undefined";
const env: Record<string, string | undefined> =
  typeof process !== "undefined" ? process.env : {};

function serializeError(err: unknown): LogContext {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: err };
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (env.NODE_ENV === "test" && !env.LOG_IN_TESTS) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ?? {}),
  };

  if (isBrowser) {
    const method = level === "debug" ? "log" : level;
    // eslint-disable-next-line no-console
    console[method](entry);
    return;
  }

  const line = JSON.stringify(entry) + "\n";
  if (level === "error" || level === "warn") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    emit("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    emit("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    emit("warn", message, context);
  },
  error(message: string, err?: unknown, context?: LogContext) {
    emit("error", message, {
      ...(context ?? {}),
      error: err ? serializeError(err) : undefined,
    });
  },
};
