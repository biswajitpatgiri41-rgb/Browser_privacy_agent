/**
 * Structured logger for the extension.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  sessionId?: string;
  step?: number;
  component: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private level: LogLevel = "info";
  private prefix = "[privacy-vision]";

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }

  private log(level: LogLevel, component: string, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      metadata,
    };

    const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleMethod(`${this.prefix} [${level.toUpperCase()}] [${component}] ${message}`, metadata ?? "");
  }

  debug(component: string, message: string, metadata?: Record<string, unknown>): void {
    this.log("debug", component, message, metadata);
  }

  info(component: string, message: string, metadata?: Record<string, unknown>): void {
    this.log("info", component, message, metadata);
  }

  warn(component: string, message: string, metadata?: Record<string, unknown>): void {
    this.log("warn", component, message, metadata);
  }

  error(component: string, message: string, metadata?: Record<string, unknown>): void {
    this.log("error", component, message, metadata);
  }

  withContext(requestId: string, sessionId: string, step: number) {
    return {
      debug: (component: string, message: string, metadata?: Record<string, unknown>) =>
        this.log("debug", component, message, { ...metadata, requestId, sessionId, step }),
      info: (component: string, message: string, metadata?: Record<string, unknown>) =>
        this.log("info", component, message, { ...metadata, requestId, sessionId, step }),
      warn: (component: string, message: string, metadata?: Record<string, unknown>) =>
        this.log("warn", component, message, { ...metadata, requestId, sessionId, step }),
      error: (component: string, message: string, metadata?: Record<string, unknown>) =>
        this.log("error", component, message, { ...metadata, requestId, sessionId, step }),
    };
  }
}

export const logger = new Logger();
