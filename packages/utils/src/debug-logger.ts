import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { inspect } from "util";

export interface DebugLogEntry {
  timestamp: Date;
  level: "debug" | "trace" | "info" | "warn" | "error";
  category: string;
  message: string;
  data?: any;
  stack?: string;
  processId?: string;
  containerId?: string;
  networkId?: string;
}

export interface DebugLoggerOptions {
  logDir: string;
  maxFileSize: number; // in MB
  maxFiles: number;
  enableConsole: boolean;
  enableFile: boolean;
  categories: string[];
  minLevel: "debug" | "trace" | "info" | "warn" | "error";
}

export class DebugLogger {
  private options: DebugLoggerOptions;
  private currentLogFile: string;
  private currentFileSize: number = 0;
  private fileIndex: number = 0;

  constructor(options: Partial<DebugLoggerOptions> = {}) {
    this.options = {
      logDir: join(process.cwd(), "debug-logs"),
      maxFileSize: 10, // 10MB
      maxFiles: 5,
      enableConsole: process.env.NODE_ENV === "development",
      enableFile: true,
      categories: ["*"], // All categories by default
      minLevel: "debug",
      ...options,
    };

    this.initializeLogDir();
    this.currentLogFile = this.generateLogFileName();
  }

  private initializeLogDir(): void {
    if (!existsSync(this.options.logDir)) {
      mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  private generateLogFileName(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return join(this.options.logDir, `debug-${timestamp}-${this.fileIndex}.log`);
  }

  private shouldLog(level: string, category: string): boolean {
    const levelPriority = {
      debug: 0,
      trace: 1,
      info: 2,
      warn: 3,
      error: 4,
    };

    const minLevelPriority = levelPriority[this.options.minLevel];
    const currentLevelPriority = levelPriority[level as keyof typeof levelPriority];

    if (currentLevelPriority < minLevelPriority) {
      return false;
    }

    if (this.options.categories.includes("*")) {
      return true;
    }

    return this.options.categories.some(cat => 
      cat === category || category.startsWith(cat + ":")
    );
  }

  private formatLogEntry(entry: DebugLogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const category = entry.category.padEnd(20);
    
    let message = `${timestamp} [${level}] [${category}] ${entry.message}`;
    
    if (entry.data) {
      message += `\n  Data: ${inspect(entry.data, { depth: 3, colors: false })}`;
    }
    
    if (entry.processId) {
      message += `\n  Process ID: ${entry.processId}`;
    }
    
    if (entry.containerId) {
      message += `\n  Container ID: ${entry.containerId}`;
    }
    
    if (entry.networkId) {
      message += `\n  Network ID: ${entry.networkId}`;
    }
    
    if (entry.stack) {
      message += `\n  Stack: ${entry.stack}`;
    }
    
    return message;
  }

  private rotateLogFile(): void {
    this.fileIndex++;
    this.currentLogFile = this.generateLogFileName();
    this.currentFileSize = 0;
    
    // Clean up old log files
    this.cleanupOldLogs();
  }

  private cleanupOldLogs(): void {
    // Implementation for cleaning up old log files
    // This would scan the log directory and remove files beyond maxFiles
  }

  private writeToFile(content: string): void {
    if (!this.options.enableFile) return;

    const contentSize = Buffer.byteLength(content, "utf8");
    
    if (this.currentFileSize + contentSize > this.options.maxFileSize * 1024 * 1024) {
      this.rotateLogFile();
    }

    try {
      appendFileSync(this.currentLogFile, content + "\n");
      this.currentFileSize += contentSize;
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  private writeToConsole(entry: DebugLogEntry): void {
    if (!this.options.enableConsole) return;

    const colors = {
      debug: "\x1b[36m", // Cyan
      trace: "\x1b[35m", // Magenta
      info: "\x1b[32m",  // Green
      warn: "\x1b[33m",  // Yellow
      error: "\x1b[31m", // Red
    };

    const reset = "\x1b[0m";
    const color = colors[entry.level] || colors.info;
    
    const timestamp = entry.timestamp.toLocaleTimeString();
    const message = `${color}[${entry.level.toUpperCase()}] [${entry.category}]${reset} ${entry.message}`;
    
    console.log(`${timestamp} ${message}`);
    
    if (entry.data) {
      console.log("  Data:", inspect(entry.data, { depth: 2, colors: true }));
    }
  }

  log(entry: DebugLogEntry): void {
    if (!this.shouldLog(entry.level, entry.category)) {
      return;
    }

    const formattedEntry = this.formatLogEntry(entry);
    
    this.writeToFile(formattedEntry);
    this.writeToConsole(entry);
  }

  debug(category: string, message: string, data?: any): void {
    this.log({
      timestamp: new Date(),
      level: "debug",
      category,
      message,
      data,
    });
  }

  trace(category: string, message: string, data?: any): void {
    this.log({
      timestamp: new Date(),
      level: "trace",
      category,
      message,
      data,
      stack: new Error().stack,
    });
  }

  info(category: string, message: string, data?: any): void {
    this.log({
      timestamp: new Date(),
      level: "info",
      category,
      message,
      data,
    });
  }

  warn(category: string, message: string, data?: any): void {
    this.log({
      timestamp: new Date(),
      level: "warn",
      category,
      message,
      data,
    });
  }

  error(category: string, message: string, data?: any): void {
    this.log({
      timestamp: new Date(),
      level: "error",
      category,
      message,
      data,
      stack: new Error().stack,
    });
  }

  // Specialized logging methods for different components
  logProcess(processId: string, level: DebugLogEntry["level"], message: string, data?: any): void {
    this.log({
      timestamp: new Date(),
      level,
      category: "process",
      message,
      data,
      processId,
      stack: level === "error" ? new Error().stack : undefined,
    });
  }

  logContainer(containerId: string, level: DebugLogEntry["level"], message: string, data?: any): void {
    this.log({
      timestamp: new Date(),
      level,
      category: "container",
      message,
      data,
      containerId,
      stack: level === "error" ? new Error().stack : undefined,
    });
  }

  logNetwork(networkId: string, level: DebugLogEntry["level"], message: string, data?: any): void {
    this.log({
      timestamp: new Date(),
      level,
      category: "network",
      message,
      data,
      networkId,
      stack: level === "error" ? new Error().stack : undefined,
    });
  }

  // Performance logging
  logPerformance(category: string, operation: string, duration: number, data?: any): void {
    this.log({
      timestamp: new Date(),
      level: "info",
      category: `perf:${category}`,
      message: `${operation} completed in ${duration}ms`,
      data: { duration, ...data },
    });
  }

  // Resource usage logging
  logResourceUsage(category: string, usage: any): void {
    this.log({
      timestamp: new Date(),
      level: "debug",
      category: `resource:${category}`,
      message: "Resource usage snapshot",
      data: usage,
    });
  }

  // HTTP request/response logging
  logHTTPActivity(method: string, url: string, statusCode: number, duration: number, data?: any): void {
    this.log({
      timestamp: new Date(),
      level: statusCode >= 400 ? "warn" : "debug",
      category: "http",
      message: `${method} ${url} ${statusCode} ${duration}ms`,
      data: { method, url, statusCode, duration, ...data },
    });
  }

  // Enable/disable logging categories at runtime
  enableCategory(category: string): void {
    if (!this.options.categories.includes(category)) {
      this.options.categories.push(category);
    }
  }

  disableCategory(category: string): void {
    this.options.categories = this.options.categories.filter(cat => cat !== category);
  }

  setMinLevel(level: DebugLoggerOptions["minLevel"]): void {
    this.options.minLevel = level;
  }

  getLogFilePath(): string {
    return this.currentLogFile;
  }

  getStats(): {
    currentFileSize: number;
    totalEntries: number;
    categories: string[];
    minLevel: string;
  } {
    return {
      currentFileSize: this.currentFileSize,
      totalEntries: 0, // Would need to track this
      categories: this.options.categories,
      minLevel: this.options.minLevel,
    };
  }
}

// Global debug logger instance
export const debugLogger: DebugLogger = new DebugLogger({
  categories: process.env.DEBUG_CATEGORIES?.split(",") || ["*"],
  minLevel: (process.env.DEBUG_LEVEL as any) || "debug",
  enableConsole: process.env.DEBUG_CONSOLE === "true" || process.env.NODE_ENV === "development",
});