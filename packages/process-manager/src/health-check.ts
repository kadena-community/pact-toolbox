import { EventEmitter } from "node:events";
import { execa } from "execa";
import type { HealthCheckConfig } from "./types";

export interface HealthCheckEvents {
  healthy: () => void;
  unhealthy: () => void;
  error: (error: Error) => void;
}

export class HealthCheck extends EventEmitter<HealthCheckEvents> {
  private timer?: NodeJS.Timeout;
  private isRunning = false;
  private consecutiveFailures = 0;

  constructor(
    private processId: string,
    private config: HealthCheckConfig
  ) {
    super();
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.consecutiveFailures = 0;

    // Initial delay before first check
    const initialDelay = this.config.initialDelay || 5000;
    
    setTimeout(() => {
      this.performCheck();
      this.scheduleNextCheck();
    }, initialDelay);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNextCheck(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(() => {
      this.performCheck();
      this.scheduleNextCheck();
    }, this.config.interval);
  }

  private async performCheck(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const isHealthy = await this.executeHealthCheck();
      
      if (isHealthy) {
        if (this.consecutiveFailures > 0) {
          // Recovery from unhealthy state
          this.consecutiveFailures = 0;
          this.emit("healthy");
        }
      } else {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.config.retries) {
          this.emit("unhealthy");
        }
      }
    } catch (error) {
      this.consecutiveFailures++;
      this.emit("error", error as Error);
      
      if (this.consecutiveFailures >= this.config.retries) {
        this.emit("unhealthy");
      }
    }
  }

  private async executeHealthCheck(): Promise<boolean> {
    const timeout = this.config.timeout;

    switch (this.config.type) {
      case "http":
        return this.httpCheck(timeout);
      case "tcp":
        return this.tcpCheck(timeout);
      case "command":
        return this.commandCheck(timeout);
      default:
        throw new Error(`Unknown health check type: ${this.config.type}`);
    }
  }

  private async httpCheck(timeout: number): Promise<boolean> {
    if (!this.config.url) {
      throw new Error("HTTP health check requires URL");
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(this.config.url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "pact-toolbox-health-check",
        },
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`HTTP health check timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  private async tcpCheck(timeout: number): Promise<boolean> {
    if (!this.config.host || !this.config.port) {
      throw new Error("TCP health check requires host and port");
    }

    return new Promise<boolean>((resolve, reject) => {
      const net = require("node:net");
      const socket = new net.Socket();
      
      const timeoutId = setTimeout(() => {
        socket.destroy();
        reject(new Error(`TCP health check timeout after ${timeout}ms`));
      }, timeout);

      socket.connect(this.config.port!, this.config.host!, () => {
        clearTimeout(timeoutId);
        socket.destroy();
        resolve(true);
      });

      socket.on("error", (error) => {
        clearTimeout(timeoutId);
        socket.destroy();
        resolve(false); // Don't reject, just return false for connection errors
      });
    });
  }

  private async commandCheck(timeout: number): Promise<boolean> {
    if (!this.config.command) {
      throw new Error("Command health check requires command");
    }

    try {
      const result = await execa(this.config.command, this.config.args || [], {
        timeout,
        reject: false,
      });

      return result.exitCode === 0;
    } catch (error) {
      return false;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getProcessId(): string {
    return this.processId;
  }

  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }
}