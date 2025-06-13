export interface ProcessConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
  detached?: boolean;
  uid?: number;
  gid?: number;
  timeout?: number;
  killSignal?: NodeJS.Signals;
  maxBuffer?: number;
  stdio?: "pipe" | "inherit" | "ignore";
}

export interface ProcessState {
  id: string;
  status: "idle" | "starting" | "running" | "stopping" | "stopped" | "failed" | "crashed";
  pid?: number;
  startTime?: Date;
  endTime?: Date;
  exitCode?: number;
  signal?: NodeJS.Signals;
  error?: Error;
  restartCount: number;
  lastHealthCheck?: Date;
  healthStatus?: "healthy" | "unhealthy" | "unknown";
}

export interface ProcessMetrics {
  id: string;
  pid?: number;
  cpu: number;
  memory: number;
  uptime: number;
  startTime: Date;
  restartCount: number;
}

export interface HealthCheckConfig {
  type: "http" | "tcp" | "command";
  url?: string;
  host?: string;
  port?: number;
  command?: string;
  args?: string[];
  interval: number;
  timeout: number;
  retries: number;
  initialDelay?: number;
}

export interface DependencyConfig {
  id: string;
  condition: "started" | "healthy" | "running";
  timeout?: number;
}

export interface ProcessEvents {
  started: (id: string, state: ProcessState) => void;
  stopped: (id: string, state: ProcessState) => void;
  failed: (id: string, error: Error, state: ProcessState) => void;
  restarted: (id: string, state: ProcessState) => void;
  healthChanged: (id: string, status: "healthy" | "unhealthy", state: ProcessState) => void;
  metrics: (id: string, metrics: ProcessMetrics) => void;
}

export interface OrchestratorConfig {
  maxConcurrentOperations?: number;
  defaultTimeout?: number;
  defaultRetries?: number;
  defaultRestartDelay?: number;
  healthCheckDefaults?: Partial<HealthCheckConfig>;
  enableMetrics?: boolean;
  metricsInterval?: number;
}