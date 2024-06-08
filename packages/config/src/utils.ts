import { readFile } from "fs/promises";
import { parseYAML } from "confbox";
import { join } from "pathe";

import type {
  ChainwebNetworkConfig,
  DevNetworkConfig,
  GetRpcUrlParams,
  LocalChainwebNetworkConfig,
  NetworkConfig,
  PactServerNetworkConfig,
  PactToolboxConfigObj,
} from "./config";

export function isPactServerNetworkConfig(config: NetworkConfig): config is PactServerNetworkConfig {
  return config?.type === "pact-server";
}

export function isDevNetworkConfig(config: NetworkConfig): config is DevNetworkConfig {
  return config?.type === "chainweb-devnet";
}

export function isChainwebNetworkConfig(config: NetworkConfig): config is ChainwebNetworkConfig {
  return config?.type === "chainweb";
}

export function hasOnDemandMining(config: NetworkConfig): config is DevNetworkConfig | LocalChainwebNetworkConfig {
  return "onDemandMining" in config && !!config.onDemandMining;
}

export function isLocalChainwebNetworkConfig(config: NetworkConfig): config is LocalChainwebNetworkConfig {
  return config?.type === "chainweb-local";
}

export function isLocalNetwork(
  config: NetworkConfig,
): config is PactServerNetworkConfig | LocalChainwebNetworkConfig | DevNetworkConfig {
  return (
    (config?.type === "pact-server" || config?.type === "chainweb-local" || config?.type === "chainweb-devnet") &&
    !!config.autoStart
  );
}

export function getNetworkPort(networkConfig: NetworkConfig): string {
  if (isLocalNetwork(networkConfig)) {
    const port = isDevNetworkConfig(networkConfig)
      ? networkConfig.containerConfig?.port
      : isLocalChainwebNetworkConfig(networkConfig)
        ? networkConfig.nodeConfig?.servicePort
        : isPactServerNetworkConfig(networkConfig)
          ? networkConfig.serverConfig?.port
          : undefined;
    return port?.toString() ?? "8080";
  }
  return "8080";
}

export function getNetworkRpcUrl(networkConfig: NetworkConfig) {
  const port = getNetworkPort(networkConfig);
  const rpcUrl = networkConfig.rpcUrl ?? `http://localhost:{port}`;
  return rpcUrl.replace(/{port}/g, port);
}

export function createRpcUrlGetter(networkConfig: NetworkConfig): (params: GetRpcUrlParams) => string {
  const rpcUrl = getNetworkRpcUrl(networkConfig);
  return ({ networkId = networkConfig.networkId, chainId = networkConfig.meta?.chainId ?? "0" }) => {
    // rpcUrl could contain placeholders like {chainId} and {networkId}
    return rpcUrl.replace(/{networkId}|{chainId}/g, (match: string) => (match === "{networkId}" ? networkId : chainId));
  };
}

interface ChainwebRpcUrlTemplate extends GetRpcUrlParams {
  host?: string;
}
export function createChainwebRpcUrl({
  host = "http://localhost:{port}",
  chainId = "{chainId}",
  networkId = "{networkId}",
}: ChainwebRpcUrlTemplate = {}) {
  return `${host}/chainweb/0.0/${networkId}/chain/${chainId}/pact`;
}

export function getNetworkConfig(config: PactToolboxConfigObj, network?: string) {
  const networkName = network ?? process.env.PACT_TOOLBOX_NETWORK ?? config.defaultNetwork ?? "local";
  const found = config.networks[networkName];
  config.defaultNetwork = networkName;
  if (!found) {
    throw new Error(`Network ${networkName} not found in config`);
  }
  found.name = networkName;
  return found;
}

export function getSerializableNetworkConfig(config: PactToolboxConfigObj, isDev = true) {
  const network = getNetworkConfig(config);
  const devProxyUrl = `http://localhost:${config.devProxyPort}`;
  return {
    networkId: network.networkId,
    meta: network.meta,
    rpcUrl: getNetworkRpcUrl(network),
    senderAccount: network.senderAccount,
    type: network.type,
    keysets: network.keysets,
    name: network.name,
    devProxyUrl,
    isDevProxyEnabled: config.enableDevProxy,
    ...(isDev ? { signers: network.signers } : {}),
  };
}

interface kadenaCliNetwork {
  network: string;
  networkId: string;
  networkHost: string;
  networkExplorerUrl: string;
}

export async function getKadenaCliNetwork(name: string, kadenaFolder = join(process.cwd(), ".kadena")) {
  if (!name.endsWith(".yaml")) {
    name = `${name}.yaml`;
  }
  const content = await readFile(join(kadenaFolder, "networks", name), "utf8");
  return parseYAML(content) as kadenaCliNetwork;
}

// export async function getkadenaCliNetworks(
//   kadenaFolder = join(process.cwd(), '.kadena'),
// ) {
//   const networks: Record<string, NetworkConfig> = {};
//   const files = await readdir(join(kadenaFolder, 'networks'));
//   for (const file of files) {
//     const networkConfig = await getKadenaCliNetwork(file);
//   }

//   return networks;
// }
