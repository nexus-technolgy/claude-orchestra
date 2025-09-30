import config from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private getLevel(): LogLevel {
    try {
      return (config.LOG_LEVEL as LogLevel) || 'info';
    } catch {
      return 'info';
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return levels[level] >= levels[this.getLevel()];
  }

  private format(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message, meta));
    }
  }

  info(message: string, meta?: any) {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message, meta));
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, meta));
    }
  }

  error(message: string, meta?: any) {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message, meta));
    }
  }
}

export default new Logger();
