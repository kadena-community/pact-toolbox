export interface ContainerConfig {
  id: string;
  name: string;
  image: string;
  tag?: string;
  command?: string[];
  entrypoint?: string[];
  env?: Record<string, string>;
  ports?: Array<{
    host: number;
    container: number;
    protocol?: "tcp" | "udp";
  }>;
  volumes?: Array<{
    host: string;
    container: string;
    mode?: "ro" | "rw";
  }>;
  networks?: string[];
  restart?: "no" | "always" | "unless-stopped" | "on-failure";
  healthCheck?: {
    test: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
    startPeriod?: string;
  };
  labels?: Record<string, string>;
  user?: string;
  workingDir?: string;
  privileged?: boolean;
  dependencies?: string[];
  pullPolicy?: "always" | "missing" | "never";
}

export interface ContainerState {
  id: string;
  containerId?: string;
  status: "creating" | "running" | "stopping" | "stopped" | "failed" | "unhealthy";
  image: string;
  ports: string[];
  health?: "healthy" | "unhealthy" | "starting" | "none";
  startTime?: Date;
  endTime?: Date;
  exitCode?: number;
  error?: Error;
  restartCount: number;
}

export interface ContainerMetrics {
  id: string;
  containerId: string;
  cpu: number;
  memory: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
  timestamp: Date;
}

export interface NetworkConfig {
  name: string;
  driver?: "bridge" | "host" | "overlay" | "macvlan" | "none";
  subnet?: string;
  gateway?: string;
  attachable?: boolean;
  internal?: boolean;
  labels?: Record<string, string>;
}

export interface VolumeConfig {
  name: string;
  driver?: string;
  driverOpts?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface OrchestratorConfig {
  defaultNetwork?: string;
  defaultPullPolicy?: ContainerConfig["pullPolicy"];
  enableMetrics?: boolean;
  metricsInterval?: number;
  maxConcurrentOperations?: number;
  healthCheckDefaults?: {
    interval?: string;
    timeout?: string;
    retries?: number;
  };
}

export interface ContainerEvents {
  created: (id: string, state: ContainerState) => void;
  started: (id: string, state: ContainerState) => void;
  stopped: (id: string, state: ContainerState) => void;
  failed: (id: string, error: Error, state: ContainerState) => void;
  healthy: (id: string, state: ContainerState) => void;
  unhealthy: (id: string, state: ContainerState) => void;
  metrics: (id: string, metrics: ContainerMetrics) => void;
}