type LogLevel = "debug" | "info" | "warn" | "error";

const level = (import.meta.env.PUBLIC_LOG_LEVEL ?? (import.meta.env.DEV ? "debug" : "warn")) as LogLevel;

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(method: LogLevel) {
  return levels[method] >= levels[level];
}

export const logger = {
  debug: (...args: unknown[]) => shouldLog("debug") && console.debug(...args),
  info:  (...args: unknown[]) => shouldLog("info")  && console.info(...args),
  warn:  (...args: unknown[]) => shouldLog("warn")  && console.warn(...args),
  error: (...args: unknown[]) => shouldLog("error") && console.error(...args),
};