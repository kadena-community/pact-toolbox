/**
 * Utilities for Docker Compose compatibility and advanced features
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { type DockerServiceConfig, type NetworkConfig, type VolumeDefinition } from "./types";

/**
 * Parse Docker Compose YAML and convert to our format
 */
export interface ComposeFile {
  version?: string;
  services: { [serviceName: string]: any };
  networks?: { [networkName: string]: any };
  volumes?: { [volumeName: string]: any };
  secrets?: { [secretName: string]: any };
  configs?: { [configName: string]: any };
}

/**
 * Convert Docker Compose service definition to our DockerServiceConfig format
 */
export function convertComposeService(
  serviceName: string,
  composeService: any,
): DockerServiceConfig {
  const config: DockerServiceConfig = {
    containerName: composeService.container_name || serviceName,
    image: composeService.image,
    platform: composeService.platform,
    restart: composeService.restart,
    stopSignal: composeService.stop_signal,
    stopGracePeriod: composeService.stop_grace_period ? parseTime(composeService.stop_grace_period) : undefined,
  };

  // Handle build configuration
  if (composeService.build) {
    if (typeof composeService.build === "string") {
      config.build = { context: composeService.build };
    } else {
      config.build = {
        context: composeService.build.context,
        dockerfile: composeService.build.dockerfile,
        args: composeService.build.args,
        target: composeService.build.target,
        labels: composeService.build.labels,
        cache_from: composeService.build.cache_from,
        cache_to: composeService.build.cache_to,
        network: composeService.build.network,
        shm_size: composeService.build.shm_size,
        extra_hosts: composeService.build.extra_hosts,
        isolation: composeService.build.isolation,
        privileged: composeService.build.privileged,
        pull: composeService.build.pull,
        platforms: composeService.build.platforms,
        tags: composeService.build.tags,
        ulimits: composeService.build.ulimits,
      };
    }
  }

  // Handle ports
  if (composeService.ports) {
    config.ports = composeService.ports.map((port: any) => {
      if (typeof port === "string") {
        const parts = port.split(":");
        if (parts.length === 2) {
          return {
            published: parseInt(parts[0]),
            target: parseInt(parts[1]),
            protocol: "tcp",
          };
        }
      } else if (typeof port === "object") {
        return {
          published: port.published,
          target: port.target,
          protocol: port.protocol || "tcp",
          mode: port.mode,
        };
      }
      return port;
    });
  }

  // Handle volumes
  if (composeService.volumes) {
    config.volumes = composeService.volumes.map((volume: any) => {
      if (typeof volume === "string") {
        return volume;
      } else {
        return {
          type: volume.type,
          source: volume.source,
          target: volume.target,
          readOnly: volume.read_only,
          bind: volume.bind,
          volume: volume.volume,
          tmpfs: volume.tmpfs,
        };
      }
    });
  }

  // Handle environment
  if (composeService.environment) {
    config.environment = composeService.environment;
  }

  // Handle env_file
  if (composeService.env_file) {
    config.envFile = composeService.env_file;
  }

  // Handle labels
  if (composeService.labels) {
    config.labels = composeService.labels;
  }

  // Handle networks
  if (composeService.networks) {
    if (Array.isArray(composeService.networks)) {
      config.networks = composeService.networks;
    } else {
      config.networks = composeService.networks;
    }
  }

  // Handle depends_on
  if (composeService.depends_on) {
    if (Array.isArray(composeService.depends_on)) {
      config.dependsOn = {};
      composeService.depends_on.forEach((dep: string) => {
        config.dependsOn![dep] = { condition: "service_started" };
      });
    } else {
      config.dependsOn = composeService.depends_on;
    }
  }

  // Handle command and entrypoint
  config.command = composeService.command;
  config.entrypoint = composeService.entrypoint;

  // Handle expose
  config.expose = composeService.expose;

  // Handle healthcheck
  if (composeService.healthcheck) {
    config.healthCheck = {
      Test: composeService.healthcheck.test,
      Interval: composeService.healthcheck.interval
        ? parseTime(composeService.healthcheck.interval) * 1000000000
        : undefined,
      Timeout: composeService.healthcheck.timeout
        ? parseTime(composeService.healthcheck.timeout) * 1000000000
        : undefined,
      Retries: composeService.healthcheck.retries,
      StartPeriod: composeService.healthcheck.start_period
        ? parseTime(composeService.healthcheck.start_period) * 1000000000
        : undefined,
    };
  }

  // Handle deploy configuration
  if (composeService.deploy) {
    config.deploy = {
      replicas: composeService.deploy.replicas,
      restartPolicy: composeService.deploy.restart_policy,
      updateConfig: composeService.deploy.update_config,
      rollbackConfig: composeService.deploy.rollback_config,
      resources: composeService.deploy.resources,
      placement: composeService.deploy.placement,
      labels: composeService.deploy.labels,
      mode: composeService.deploy.mode,
      endpointMode: composeService.deploy.endpoint_mode,
    };
  }

  // Handle resource constraints
  config.memLimit = composeService.mem_limit;
  config.memReservation = composeService.mem_reservation;
  config.memSwapLimit = composeService.memswap_limit;
  config.memSwappiness = composeService.mem_swappiness;
  config.oomKillDisable = composeService.oom_kill_disable;
  config.oomScoreAdj = composeService.oom_score_adj;
  config.cpus = composeService.cpus;
  config.cpuShares = composeService.cpu_shares;
  config.cpuQuota = composeService.cpu_quota;
  config.cpuPeriod = composeService.cpu_period;
  config.cpusetCpus = composeService.cpuset;
  config.cpusetMems = composeService.cpumems;

  // Handle other properties
  config.privileged = composeService.privileged;
  config.user = composeService.user;
  config.workingDir = composeService.working_dir;
  config.hostname = composeService.hostname;
  config.domainName = composeService.domainname;
  config.macAddress = composeService.mac_address;
  config.dns = composeService.dns;
  config.dnsSearch = composeService.dns_search;
  config.dnsOpt = composeService.dns_opt;
  config.extraHosts = composeService.extra_hosts;
  config.ipc = composeService.ipc;
  config.pid = composeService.pid;
  config.cgroupns = composeService.cgroup_parent;
  config.init = composeService.init;
  config.isolation = composeService.isolation;
  config.tmpfs = composeService.tmpfs;
  config.devices = composeService.devices;
  config.capAdd = composeService.cap_add;
  config.capDrop = composeService.cap_drop;
  config.ulimits = composeService.ulimits?.map((ulimit: any) => ({
    Name: ulimit.name || Object.keys(ulimit)[0],
    Soft: ulimit.soft || ulimit[Object.keys(ulimit)[0]],
    Hard: ulimit.hard || ulimit[Object.keys(ulimit)[0]],
  }));

  // Handle logging
  if (composeService.logging) {
    config.logging = {
      driver: composeService.logging.driver,
      options: composeService.logging.options,
    };
  }

  // Handle profiles
  config.profiles = composeService.profiles;

  return config;
}

/**
 * Convert Docker Compose networks to our NetworkConfig format
 */
export function convertComposeNetworks(composeNetworks: { [name: string]: any }): NetworkConfig[] {
  return Object.entries(composeNetworks).map(([name, network]) => ({
    name,
    driver: network.driver,
    driverOpts: network.driver_opts,
    attachable: network.attachable,
    internal: network.internal,
    ipam: network.ipam,
    enableIpv6: network.enable_ipv6,
    labels: network.labels,
    external: network.external,
  }));
}

/**
 * Convert Docker Compose volumes to our VolumeDefinition format
 */
export function convertComposeVolumes(composeVolumes: { [name: string]: any }): VolumeDefinition[] {
  return Object.entries(composeVolumes).map(([name, volume]) => ({
    name,
    driver: volume.driver,
    driverOpts: volume.driver_opts,
    labels: volume.labels,
    external: volume.external,
  }));
}

/**
 * Parse time strings like "1m30s", "45s", "2h" into seconds
 */
export function parseTime(timeStr: string): number {
  if (typeof timeStr === "number") return timeStr;

  const match = timeStr.match(/^(\d+)([smhd]?)$/);
  if (!match) {
    // Try to parse complex time strings like "1m30s"
    let total = 0;
    const parts = timeStr.match(/(\d+)([smhd])/g);
    if (parts) {
      for (const part of parts) {
        const partMatch = part.match(/(\d+)([smhd])/);
        if (partMatch) {
          const value = parseInt(partMatch[1]);
          const unit = partMatch[2];
          switch (unit) {
            case "s":
              total += value;
              break;
            case "m":
              total += value * 60;
              break;
            case "h":
              total += value * 3600;
              break;
            case "d":
              total += value * 86400;
              break;
          }
        }
      }
      return total;
    }
    return 30; // Default fallback
  }

  const value = parseInt(match[1]);
  const unit = match[2] || "s";

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return value;
  }
}

/**
 * Validate service configuration for common issues
 */
export function validateServiceConfig(config: DockerServiceConfig): string[] {
  const issues: string[] = [];

  if (!config.image && !config.build) {
    issues.push("Service must have either an image or build configuration");
  }

  if (config.build && !config.build.context) {
    issues.push("Build configuration must have a context");
  }

  if (config.build && config.build.context && !existsSync(config.build.context)) {
    issues.push(`Build context directory does not exist: ${config.build.context}`);
  }

  if (config.build && config.build.dockerfile) {
    const dockerfilePath = join(config.build.context, config.build.dockerfile);
    if (!existsSync(dockerfilePath)) {
      issues.push(`Dockerfile does not exist: ${dockerfilePath}`);
    }
  }

  if (config.envFile) {
    const envFiles = Array.isArray(config.envFile) ? config.envFile : [config.envFile];
    for (const envFile of envFiles) {
      if (!existsSync(envFile)) {
        issues.push(`Environment file does not exist: ${envFile}`);
      }
    }
  }

  if (config.dependsOn) {
    for (const [depName, depConfig] of Object.entries(config.dependsOn)) {
      if (!depConfig.condition) {
        issues.push(`Dependency '${depName}' missing condition`);
      }
    }
  }

  return issues;
}

/**
 * Resolve relative paths in service configuration
 */
export function resolveServicePaths(config: DockerServiceConfig, basePath: string): DockerServiceConfig {
  const resolvedConfig = { ...config };

  if (resolvedConfig.build) {
    resolvedConfig.build = { ...resolvedConfig.build };
    if (resolvedConfig.build.context && !resolvedConfig.build.context.startsWith("/")) {
      resolvedConfig.build.context = join(basePath, resolvedConfig.build.context);
    }
  }

  if (resolvedConfig.envFile) {
    if (Array.isArray(resolvedConfig.envFile)) {
      resolvedConfig.envFile = resolvedConfig.envFile.map((file) =>
        file.startsWith("/") ? file : join(basePath, file),
      );
    } else {
      if (!resolvedConfig.envFile.startsWith("/")) {
        resolvedConfig.envFile = join(basePath, resolvedConfig.envFile);
      }
    }
  }

  return resolvedConfig;
}

/**
 * Generate a unique container name with optional suffix
 */
export function generateContainerName(serviceName: string, projectName?: string, suffix?: string): string {
  const parts = [projectName, serviceName, suffix].filter(Boolean);
  return parts.join("_");
}

/**
 * Check if a service should be included based on active profiles
 */
export function shouldIncludeService(config: DockerServiceConfig, activeProfiles: string[]): boolean {
  if (!config.profiles || config.profiles.length === 0) {
    // Services without profiles are included when no profiles are active
    return activeProfiles.length === 0;
  }

  // Services with profiles are included if any profile matches
  return config.profiles.some((profile) => activeProfiles.includes(profile));
}
