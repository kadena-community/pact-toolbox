import { getPort } from "get-port-please";

interface RandomPorts {
  proxy: number;
  service: number;
  onDemand: number;
  stratum: number;
  p2p: number;
}
/**
 * Gets a series of random network ports with gaps between each.
 *
 * @param host - The host for which to get the ports. Defaults to '127.0.0.1'.
 * @param startGap - The minimum gap between successive ports. Defaults to 10.
 * @param endGap - The maximum gap between successive ports. Defaults to 100.
 * @returns An object containing the random ports assigned for proxy, service, on-demand, stratum, and p2p services.
 * @throws {Error} If it fails to find a suitable port for any of the services.
 */
export async function getRandomNetworkPorts(
  host: string = "127.0.0.1",
  startGap: number = 10,
  endGap: number = 100,
): Promise<RandomPorts> {
  if (startGap <= 0 || endGap <= 0 || startGap > endGap || endGap > 65535) {
    throw new Error("Invalid port gap values provided.");
  }

  try {
    const proxy = await getPort({
      host,
      random: true,
      name: "proxy",
    });

    const service = await getPort({
      port: proxy + startGap,
      host,
      portRange: [proxy + startGap, proxy + endGap],
      name: "service",
    });

    const onDemand = await getPort({
      port: service + startGap,
      host,
      portRange: [service + startGap, service + endGap],
      name: "onDemand",
    });

    const stratum = await getPort({
      port: onDemand + startGap,
      host,
      portRange: [onDemand + startGap, onDemand + endGap],
      name: "stratum",
    });

    const p2p = await getPort({
      port: stratum + startGap,
      host,
      portRange: [stratum + startGap, stratum + endGap],
      name: "p2p",
    });

    return {
      proxy,
      service,
      onDemand,
      stratum,
      p2p,
    };
  } catch (error) {
    throw new Error(`Failed to get network ports: ${(error as Error).message}`);
  }
}

export { getRandomPort } from "get-port-please";
