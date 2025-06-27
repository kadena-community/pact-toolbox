import { Logger } from "@pact-toolbox/node-utils";
import * as Docker from "dockerode";

// Service lifecycle events
export type ServiceStatus = "creating" | "running" | "stopping" | "stopped" | "failed" | "healthy" | "unhealthy";

export interface ServiceState {
  id: string;
  status: ServiceStatus;
  containerId?: string;
  startTime?: Date;
  endTime?: Date;
  restartCount: number;
  health?: "healthy" | "unhealthy" | "starting";
  error?: Error;
  ports?: string[];
}

export interface DockerServiceConfig {
  containerName: string;
  image?: string;
  platform?: string;
  restart?: string;
  stopSignal?: string;
  stopGracePeriod?: number; // seconds
  ulimits?: { Name: string; Soft: number; Hard: number }[];
  dependsOn?: { [key: string]: { condition: string; required?: boolean } };
  entrypoint?: string | string[];
  command?: string[];
  ports?: { target: number; published: string | number; protocol?: string; mode?: "host" | "ingress" }[];
  volumes?: string[] | VolumeConfig[];
  environment?: string[] | { [key: string]: string };
  envFile?: string | string[];
  labels?: { [key: string]: string };
  build?: BuildConfig;
  profiles?: string[];
  expose?: string[];
  healthCheck?: Docker.HealthConfig;
  networks?: string[] | { [networkName: string]: NetworkAttachConfig };
  secrets?: string[] | SecretConfig[];
  configs?: string[] | ConfigConfig[];
  tmpfs?: string | string[];
  devices?: string[];
  capAdd?: string[];
  capDrop?: string[];
  privileged?: boolean;
  user?: string;
  workingDir?: string;
  hostname?: string;
  domainName?: string;
  macAddress?: string;
  dns?: string | string[];
  dnsSearch?: string | string[];
  dnsOpt?: string[];
  extraHosts?: string[];
  ipc?: string;
  pid?: string;
  cgroupns?: string;
  init?: boolean;
  isolation?: string;
  memLimit?: string;
  memReservation?: string;
  memSwapLimit?: string;
  memSwappiness?: number;
  oomKillDisable?: boolean;
  oomScoreAdj?: number;
  cpus?: number;
  cpuShares?: number;
  cpuQuota?: number;
  cpuPeriod?: number;
  cpusetCpus?: string;
  cpusetMems?: string;
  blkioWeight?: number;
  deviceReadBps?: { path: string; rate: string }[];
  deviceWriteBps?: { path: string; rate: string }[];
  deviceReadIops?: { path: string; rate: number }[];
  deviceWriteIops?: { path: string; rate: number }[];
  logging?: LoggingConfig;
  deploy?: {
    replicas?: number;
    restartPolicy?: {
      condition?: "on-failure" | "none" | "always" | "unless-stopped";
      delay?: string; // e.g., "5s"
      maxAttempts?: number;
      window?: string; // e.g., "120s"
    };
    updateConfig?: {
      parallelism?: number;
      delay?: string;
      failureAction?: "continue" | "rollback" | "pause";
      monitor?: string;
      maxFailureRatio?: number;
      order?: "start-first" | "stop-first";
    };
    rollbackConfig?: {
      parallelism?: number;
      delay?: string;
      failureAction?: "continue" | "pause";
      monitor?: string;
      maxFailureRatio?: number;
      order?: "start-first" | "stop-first";
    };
    resources?: {
      limits?: {
        cpus?: string;
        memory?: string;
        pids?: number;
      };
      reservations?: {
        cpus?: string;
        memory?: string;
        genericResources?: { discreteResourceSpec?: { kind: string; value: number } }[];
      };
    };
    placement?: {
      constraints?: string[];
      preferences?: { spread: string }[];
      maxReplicas?: number;
    };
    labels?: { [key: string]: string };
    mode?: "replicated" | "global";
    endpointMode?: "vip" | "dnsrr";
  };
}

export interface VolumeConfig {
  type: "bind" | "volume" | "tmpfs";
  source?: string;
  target: string;
  readOnly?: boolean;
  bind?: {
    propagation?: "private" | "rprivate" | "shared" | "rshared" | "slave" | "rslave";
    createHostPath?: boolean;
    selinuxOpts?: string;
  };
  volume?: {
    noCopy?: boolean;
  };
  tmpfs?: {
    size?: number;
    mode?: number;
  };
}

export interface BuildConfig {
  context: string;
  dockerfile?: string;
  args?: { [key: string]: string };
  ssh?: string | string[];
  cache_from?: string[];
  cache_to?: string[];
  labels?: { [key: string]: string };
  network?: string;
  shm_size?: string;
  target?: string;
  extra_hosts?: string[];
  isolation?: string;
  privileged?: boolean;
  pull?: boolean;
  platforms?: string[];
  secrets?: string[] | SecretConfig[];
  tags?: string[];
  ulimits?: { [key: string]: number | { soft: number; hard: number } };
}

export interface NetworkAttachConfig {
  aliases?: string[];
  ipv4Address?: string;
  ipv6Address?: string;
  linkLocalIps?: string[];
  priority?: number;
}

export interface SecretConfig {
  source: string;
  target?: string;
  uid?: string;
  gid?: string;
  mode?: number;
}

export interface ConfigConfig {
  source: string;
  target?: string;
  uid?: string;
  gid?: string;
  mode?: number;
}

export interface LoggingConfig {
  driver?: string;
  options?: { [key: string]: string };
}

export interface NetworkConfig {
  name: string;
  driver?: string;
  driverOpts?: { [key: string]: string };
  attachable?: boolean;
  internal?: boolean;
  ipam?: {
    driver?: string;
    config?: {
      subnet?: string;
      ipRange?: string;
      gateway?: string;
      auxAddresses?: { [key: string]: string };
    }[];
    options?: { [key: string]: string };
  };
  enableIpv6?: boolean;
  labels?: { [key: string]: string };
  external?: boolean;
}

export interface VolumeDefinition {
  name: string;
  driver?: string;
  driverOpts?: { [key: string]: string };
  labels?: { [key: string]: string };
  external?: boolean;
}

export interface SecretDefinition {
  name: string;
  file?: string;
  external?: boolean;
  labels?: { [key: string]: string };
}

export interface ConfigDefinition {
  name: string;
  file?: string;
  external?: boolean;
  labels?: { [key: string]: string };
}

// Orchestrator configuration
export interface OrchestratorConfig {
  networkName: string;
  volumes?: string[];
  networks?: NetworkConfig[];
  secrets?: SecretDefinition[];
  configs?: ConfigDefinition[];
  defaultRestartPolicy?: string;
  logger?: Logger;
}
