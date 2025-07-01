import { statSync } from "node:fs";
import { logger, colors } from "@pact-toolbox/node-utils";

export const DOCKER_SOCKET: string = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

export function isDockerInstalled(): boolean {
  const socket = DOCKER_SOCKET;
  try {
    const stats = statSync(socket);
    return stats.isSocket();
  } catch (e) {
    logger.error(`Docker is not installed or the socket is not accessible: ${e}`);
    return false;
  }
}

/**
 * Parse time strings like "30s", "1m", "2h" into seconds
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
 * Parse memory strings like "512m", "1g" into bytes
 */
export function parseMemory(memory: string): number {
  const match = memory.toLowerCase().match(/^(\d+)([bkmg])?$/);
  if (!match) {
    throw new Error(`Invalid memory format: ${memory}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'b';

  switch (unit) {
    case 'b': return value;
    case 'k': return value * 1024;
    case 'm': return value * 1024 * 1024;
    case 'g': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

/**
 * Parse memory strings into megabytes (for resource limits)
 */
export function parseMemoryToMB(memory: string): number {
  const bytes = parseMemory(memory);
  return Math.floor(bytes / (1024 * 1024));
}

// Service colors for logging
const CHALK_SERVICE_COLORS = [colors.cyan, colors.green, colors.yellow, colors.blue, colors.magenta, colors.red];

let colorIndex = 0;
const serviceChalkColorMap = new Map<string, typeof colors.cyan>();

export function getServiceColor(serviceName: string): typeof colors.cyan {
  if (!serviceChalkColorMap.has(serviceName)) {
    const selectedChalkFunction = CHALK_SERVICE_COLORS[colorIndex % CHALK_SERVICE_COLORS.length]!;
    serviceChalkColorMap.set(serviceName, selectedChalkFunction);
    colorIndex++;
  }
  return serviceChalkColorMap.get(serviceName)!;
}

/**
 * Create a service tag with color
 */
export function createServiceTag(serviceName: string): string {
  const colorFn = getServiceColor(serviceName);
  return colorFn(`[${serviceName}]`);
}

/**
 * Reset service colors for testing
 */
export function resetServiceColors(): void {
  serviceChalkColorMap.clear();
  colorIndex = 0;
}

/**
 * Wrap an async operation with a timeout
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}