/**
 * @fileoverview Default resource limits for Docker containers
 * 
 * Provides sensible defaults for memory and CPU limits to prevent
 * resource exhaustion and ensure stable operation.
 */

import type { DockerServiceConfig } from "./types";

/**
 * Default resource limits for containers
 */
export const DEFAULT_RESOURCE_LIMITS = {
  // Memory limits
  memory: {
    default: "512m",      // 512MB default
    minimum: "128m",      // 128MB minimum
    development: "1g",    // 1GB for development
    production: "2g",     // 2GB for production
  },
  
  // CPU limits
  cpu: {
    default: 1,           // 1 CPU core default
    minimum: 0.25,        // 0.25 CPU minimum
    development: 2,       // 2 CPU cores for development
    production: 4,        // 4 CPU cores for production
  },
  
  // Process limits
  pids: {
    default: 1024,        // 1024 processes default
    minimum: 128,         // 128 processes minimum
  }
};

/**
 * Service-specific resource profiles
 */
export const SERVICE_RESOURCE_PROFILES: Record<string, { memory: string; cpu: number; pids?: number }> = {
  // Database services
  postgres: { memory: "1g", cpu: 2 },
  mysql: { memory: "1g", cpu: 2 },
  redis: { memory: "256m", cpu: 0.5 },
  mongodb: { memory: "1g", cpu: 2 },
  
  // Web services
  nginx: { memory: "256m", cpu: 0.5 },
  apache: { memory: "512m", cpu: 1 },
  
  // Application services
  node: { memory: "512m", cpu: 1 },
  python: { memory: "512m", cpu: 1 },
  java: { memory: "1g", cpu: 2 },
  
  // Blockchain/Kadena specific
  chainweb: { memory: "2g", cpu: 2, pids: 2048 },
  devnet: { memory: "1g", cpu: 1, pids: 1024 },
  pact: { memory: "512m", cpu: 1 },
  
  // Default profile
  default: { 
    memory: DEFAULT_RESOURCE_LIMITS.memory.default, 
    cpu: DEFAULT_RESOURCE_LIMITS.cpu.default,
    pids: DEFAULT_RESOURCE_LIMITS.pids.default
  }
};

/**
 * Apply default resource limits to a service configuration
 * 
 * @param config - Docker service configuration
 * @param profile - Resource profile name (optional)
 * @returns Updated configuration with resource limits
 */
export function applyResourceLimits(
  config: DockerServiceConfig,
  profile?: keyof typeof SERVICE_RESOURCE_PROFILES
): DockerServiceConfig {
  // Determine the profile to use
  let resourceProfile = SERVICE_RESOURCE_PROFILES.default;
  
  if (profile && SERVICE_RESOURCE_PROFILES[profile]) {
    resourceProfile = SERVICE_RESOURCE_PROFILES[profile];
  } else if (config.image) {
    // Try to infer profile from image name
    const imageName = config.image.toLowerCase();
    for (const [profileName, profileConfig] of Object.entries(SERVICE_RESOURCE_PROFILES)) {
      if (imageName.includes(profileName)) {
        resourceProfile = profileConfig;
        break;
      }
    }
  }

  // Create updated config with resource limits
  const updatedConfig: DockerServiceConfig = { ...config };

  // Apply memory limits if not already set
  if (!updatedConfig.memLimit && !updatedConfig.deploy?.resources?.limits?.memory) {
    updatedConfig.memLimit = resourceProfile.memory;
  }

  // Apply CPU limits if not already set
  if (!updatedConfig.cpus && !updatedConfig.deploy?.resources?.limits?.cpus) {
    updatedConfig.cpus = resourceProfile.cpu;
  }

  // Apply deploy resource limits (Swarm mode)
  if (!updatedConfig.deploy) {
    updatedConfig.deploy = {};
  }
  
  if (!updatedConfig.deploy.resources) {
    updatedConfig.deploy.resources = {};
  }
  
  if (!updatedConfig.deploy.resources.limits) {
    updatedConfig.deploy.resources.limits = {
      memory: resourceProfile.memory,
      cpus: String(resourceProfile.cpu),
      pids: resourceProfile.pids
    };
  }
  
  if (!updatedConfig.deploy.resources.reservations) {
    // Reserve 50% of limits
    updatedConfig.deploy.resources.reservations = {
      memory: parseMemoryValue(resourceProfile.memory) / 2 + "m",
      cpus: String(resourceProfile.cpu / 2)
    };
  }

  // Set OOM score adjustment for better stability
  if (updatedConfig.oomScoreAdj === undefined) {
    updatedConfig.oomScoreAdj = -500; // Less likely to be killed by OOM killer
  }

  // Enable memory swappiness control
  if (updatedConfig.memSwappiness === undefined) {
    updatedConfig.memSwappiness = 10; // Reduce swapping
  }

  return updatedConfig;
}

/**
 * Parse memory string to bytes
 * 
 * @param memory - Memory string (e.g., "512m", "1g")
 * @returns Memory in megabytes
 */
function parseMemoryValue(memory: string): number {
  const match = memory.match(/^(\d+)([kmg])?$/i);
  if (!match) {
    throw new Error(`Invalid memory format: ${memory}`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2]?.toLowerCase() || 'b';
  
  switch (unit) {
    case 'k': return value / 1024;
    case 'm': return value;
    case 'g': return value * 1024;
    default: return value / (1024 * 1024);
  }
}

/**
 * Validate resource limits
 * 
 * @param config - Docker service configuration
 * @throws Error if resource limits are invalid
 */
export function validateResourceLimits(config: DockerServiceConfig): void {
  // Validate memory limits
  if (config.memLimit) {
    const memoryMB = parseMemoryValue(config.memLimit);
    const minMemoryMB = parseMemoryValue(DEFAULT_RESOURCE_LIMITS.memory.minimum);
    
    if (memoryMB < minMemoryMB) {
      throw new Error(
        `Memory limit ${config.memLimit} is below minimum ${DEFAULT_RESOURCE_LIMITS.memory.minimum}`
      );
    }
  }

  // Validate CPU limits
  if (config.cpus !== undefined) {
    if (config.cpus < DEFAULT_RESOURCE_LIMITS.cpu.minimum) {
      throw new Error(
        `CPU limit ${config.cpus} is below minimum ${DEFAULT_RESOURCE_LIMITS.cpu.minimum}`
      );
    }
  }

  // Validate memory reservation vs limit
  if (config.memReservation && config.memLimit) {
    const reservationMB = parseMemoryValue(config.memReservation);
    const limitMB = parseMemoryValue(config.memLimit);
    
    if (reservationMB > limitMB) {
      throw new Error(
        `Memory reservation ${config.memReservation} cannot exceed limit ${config.memLimit}`
      );
    }
  }
}

/**
 * Get recommended resource limits based on environment
 * 
 * @param environment - Environment name (development, production, etc.)
 * @returns Resource limits for the environment
 */
export function getEnvironmentResourceLimits(
  environment: "development" | "production" | "test" = "development"
): { memory: string; cpu: number; pids: number } {
  switch (environment) {
    case "production":
      return {
        memory: DEFAULT_RESOURCE_LIMITS.memory.production,
        cpu: DEFAULT_RESOURCE_LIMITS.cpu.production,
        pids: DEFAULT_RESOURCE_LIMITS.pids.default * 2
      };
    
    case "test":
      return {
        memory: DEFAULT_RESOURCE_LIMITS.memory.minimum,
        cpu: DEFAULT_RESOURCE_LIMITS.cpu.minimum,
        pids: DEFAULT_RESOURCE_LIMITS.pids.minimum
      };
    
    case "development":
    default:
      return {
        memory: DEFAULT_RESOURCE_LIMITS.memory.development,
        cpu: DEFAULT_RESOURCE_LIMITS.cpu.development,
        pids: DEFAULT_RESOURCE_LIMITS.pids.default
      };
  }
}