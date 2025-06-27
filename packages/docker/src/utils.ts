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
