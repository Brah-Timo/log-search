/**
 * logger.ts
 * Internal structured logger for log-search itself.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix = 'log-search', level?: LogLevel) {
    this.prefix = prefix;
    this.level = level ?? (process.env.DEBUG ? 'debug' : 'warn');
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return order.indexOf(level) >= order.indexOf(this.level);
  }

  debug(msg: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) console.debug(`[${this.prefix}] DEBUG: ${msg}`, ...args);
  }

  info(msg: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) console.info(`[${this.prefix}] ${msg}`, ...args);
  }

  warn(msg: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) console.warn(`[${this.prefix}] WARN: ${msg}`, ...args);
  }

  error(msg: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) console.error(`[${this.prefix}] ERROR: ${msg}`, ...args);
  }

  child(prefix: string): Logger {
    return new Logger(`${this.prefix}:${prefix}`, this.level);
  }
}

export const logger = new Logger();
export { Logger };
