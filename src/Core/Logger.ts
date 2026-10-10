import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  details?: Record<string, unknown>;
}

export class Logger {
  private static instance: Logger | null = null;
  private logFilePath: string | null = null;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 500;

  private constructor() {
    // Initial in-memory buffer before log path initialization
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public initialize(logDirectory?: string): void {
    try {
      const dir = logDirectory || path.join(process.cwd(), 'logs');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFilePath = path.join(dir, `fseb-${timestamp}.log`);

      // Flush in-memory logs
      if (this.logBuffer.length > 0) {
        const content = this.logBuffer.map(e => this.formatEntry(e)).join('\n') + '\n';
        fs.appendFileSync(this.logFilePath, content, 'utf8');
      }
    } catch (err) {
      console.error('Failed to initialize file logger:', err);
    }
  }

  public debug(category: string, message: string, details?: Record<string, unknown>): void {
    this.log('DEBUG', category, message, details);
  }

  public info(category: string, message: string, details?: Record<string, unknown>): void {
    this.log('INFO', category, message, details);
  }

  public warn(category: string, message: string, details?: Record<string, unknown>): void {
    this.log('WARN', category, message, details);
  }

  public error(category: string, message: string, details?: Record<string, unknown>): void {
    this.log('ERROR', category, message, details);
  }

  private log(level: LogLevel, category: string, message: string, details?: Record<string, unknown>): void {
    const sanitizedDetails = details ? this.sanitize(details) : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details: sanitizedDetails,
    };

    const formatted = this.formatEntry(entry);
    console.log(formatted);

    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, formatted + '\n', 'utf8');
      } catch (err) {
        console.error('Failed to write to log file:', err);
      }
    }
  }

  private formatEntry(entry: LogEntry): string {
    const detailsStr = entry.details ? ` | ${JSON.stringify(entry.details)}` : '';
    return `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}${detailsStr}`;
  }

  /**
   * Redacts sensitive keys such as passwords, tokens, auth headers, and clipboard contents
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'auth', 'secret', 'cookie', 'clipboard', 'answer', 'key'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lower = key.toLowerCase();
      if (sensitiveKeys.some(s => lower.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  public getRecentLogs(): LogEntry[] {
    return [...this.logBuffer];
  }
}

