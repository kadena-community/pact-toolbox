export interface TUITheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    muted: string;
    background: string;
    foreground: string;
  };
  symbols: {
    success: string;
    error: string;
    warning: string;
    info: string;
    running: string;
    stopped: string;
    loading: string;
    arrow: string;
    bullet: string;
  };
  borders: {
    single: string[];
    double: string[];
    rounded: string[];
  };
}

export interface TUIOptions {
  theme?: Partial<TUITheme>;
  refreshRate?: number;
  maxLogs?: number;
  enableInteraction?: boolean;
  width?: number;
  height?: number;
}

export interface ProcessInfo {
  id: string;
  name: string;
  status: "starting" | "running" | "stopping" | "stopped" | "failed" | "crashed";
  pid?: number;
  startTime?: Date;
  uptime?: number;
  cpu?: number;
  memory?: number;
  command?: string;
  args?: string[];
  logs: string[];
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: "creating" | "running" | "stopping" | "stopped" | "failed";
  ports: string[];
  health?: "healthy" | "unhealthy" | "starting" | "none";
  logs: string[];
}

export interface NetworkInfo {
  id: string;
  name: string;
  status: "starting" | "running" | "stopping" | "stopped" | "failed";
  endpoints: Array<{
    name: string;
    url: string;
    status: "up" | "down" | "checking";
    responseTime?: number;
  }>;
  stats?: {
    totalRequests?: number;
    errorRate?: number;
    avgResponseTime?: number;
  };
}

export interface LogEntry {
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  message: string;
  data?: any;
}

export interface StatusInfo {
  uptime: number;
  totalProcesses: number;
  runningProcesses: number;
  totalContainers: number;
  runningContainers: number;
  networkStatus: "up" | "down" | "degraded";
  systemResources?: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

export interface TUIState {
  processes: ProcessInfo[];
  containers: ContainerInfo[];
  network: NetworkInfo;
  logs: LogEntry[];
  status: StatusInfo;
  isActive: boolean;
  lastUpdate: Date;
}

export interface SpinnerOptions {
  text?: string;
  color?: keyof TUITheme["colors"];
  spinner?: "dots" | "line" | "pipe" | "star";
  indent?: number;
}

export interface ProgressOptions {
  total: number;
  current?: number;
  text?: string;
  color?: keyof TUITheme["colors"];
  width?: number;
  showPercentage?: boolean;
  showEta?: boolean;
}

export interface TableOptions {
  headers: string[];
  rows: string[][];
  align?: ("left" | "center" | "right")[];
  maxWidth?: number;
  border?: "none" | "single" | "double" | "rounded";
}

export interface TUIEvents {
  keypress: (key: string, meta: { ctrl: boolean; shift: boolean; alt: boolean }) => void;
  resize: (width: number, height: number) => void;
  exit: () => void;
  refresh: () => void;
}