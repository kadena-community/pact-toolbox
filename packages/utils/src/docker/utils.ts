import { statSync } from "node:fs";
import { colors } from "consola/utils";

import { logger } from "../logger";

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
