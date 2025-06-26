import type { GetRpcUrlParams, SerializableNetworkConfig } from "@pact-toolbox/types";

import type {
  ChainwebNetworkConfig,
  DevNetworkConfig,
  NetworkConfig,
  PactServerNetworkConfig,
  PactToolboxConfigObj,
} from "./config";

// Re-export types for external use
export type {
  ChainwebNetworkConfig,
  DevNetworkConfig,
  NetworkConfig,
  PactServerNetworkConfig,
  PactToolboxConfigObj,
} from "./config";

type NetworkConfigLike = Pick<SerializableNetworkConfig, "type">;

/**
 * Type guard to check if a network config is for Pact Server
 * @param config - Network configuration to check
 * @returns True if the config is for Pact Server
 */
export function isPactServerNetworkConfig(config: NetworkConfigLike): config is PactServerNetworkConfig {
  return config?.type === "pact-server";
}

/**
 * Type guard to check if a network config is for DevNet
 * @param config - Network configuration to check
 * @returns True if the config is for DevNet
 */
export function isDevNetworkConfig(config: NetworkConfigLike): config is DevNetworkConfig {
  return config?.type === "chainweb-devnet";
}

/**
 * Type guard to check if a network config is for Chainweb
 * @param config - Network configuration to check
 * @returns True if the config is for Chainweb (testnet/mainnet)
 */
export function isChainwebNetworkConfig(config: NetworkConfigLike): config is ChainwebNetworkConfig {
  return config?.type === "chainweb";
}

/**
 * Check if a network config has on-demand mining enabled
 * @param config - Network configuration to check
 * @returns True if on-demand mining is enabled
 */
export function hasOnDemandMining(config: NetworkConfig): config is DevNetworkConfig {
  return "onDemandMining" in config && !!config.onDemandMining;
}

/**
 * Type guard to check if a network is a local network (Pact Server or DevNet)
 * @param config - Network configuration to check
 * @returns True if the network is local and has autoStart enabled
 */
export function isLocalNetwork(config: NetworkConfig): config is PactServerNetworkConfig | DevNetworkConfig {
  return (config?.type === "pact-server" || config?.type === "chainweb-devnet") && !!config.autoStart;
}

/**
 * Get the port number for a network configuration
 * @param networkConfig - Network configuration
 * @returns Port number (defaults to 8080)
 */
export function getNetworkPort(networkConfig: NetworkConfig): number {
  if (isLocalNetwork(networkConfig)) {
    const port = isDevNetworkConfig(networkConfig)
      ? networkConfig.containerConfig?.port
      : isPactServerNetworkConfig(networkConfig)
        ? networkConfig.serverConfig?.port
        : undefined;
    return port ?? 8080;
  }
  return 8080;
}

/**
 * Get the RPC URL for a network configuration
 * @param networkConfig - Network configuration
 * @returns RPC URL with port placeholder replaced
 */
export function getNetworkRpcUrl(networkConfig: NetworkConfig): string {
  const port = getNetworkPort(networkConfig);
  const rpcUrl = networkConfig.rpcUrl ?? `http://localhost:{port}`;
  return rpcUrl.replace(/{port}/g, port.toString());
}

/**
 * Create a function that generates RPC URLs with dynamic parameters
 * @param networkConfig - Network configuration
 * @returns Function that takes parameters and returns a formatted RPC URL
 */
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

/**
 * Create a Chainweb-formatted RPC URL
 * @param params - URL template parameters
 * @returns Formatted Chainweb RPC URL
 */
export function createChainwebRpcUrl({
  host = "http://localhost:{port}",
  chainId = "{chainId}",
  networkId = "{networkId}",
}: ChainwebRpcUrlTemplate = {}) {
  return `${host}/chainweb/0.0/${networkId}/chain/${chainId}/pact`;
}

/**
 * Get the default network configuration from the config object
 * @param config - Main configuration object
 * @param network - Optional network name override
 * @returns Network configuration
 * @throws Error if the specified network is not found
 */
export function getDefaultNetworkConfig(config: PactToolboxConfigObj, network?: string): NetworkConfig {
  const networkName = network ?? process.env["PACT_TOOLBOX_NETWORK"] ?? config.defaultNetwork ?? "pactServer";
  const found = config.networks[networkName];

  // Only update the config's defaultNetwork if we're resolving the actual default (no specific network requested)
  if (!network) {
    config.defaultNetwork = networkName;
  }

  if (!found) {
    const availableNetworks = Object.keys(config.networks).join(", ");
    throw new Error(
      `Network "${networkName}" not found in config. Available networks: ${availableNetworks || "none"}`
    );
  }

  // Create a copy to avoid mutating the original network config
  const networkCopy = { ...found };
  networkCopy.name = networkName;
  return networkCopy;
}

/**
 * Get a specific network configuration by name
 * @internal
 * @param config - Main configuration object
 * @param networkName - Name of the network to retrieve
 * @returns Network configuration
 * @throws Error if the network is not found
 */
function getNetworkByName(config: PactToolboxConfigObj, networkName: string): NetworkConfig {
  const found = config.networks[networkName];
  if (!found) {
    const availableNetworks = Object.keys(config.networks).join(", ");
    throw new Error(
      `Network "${networkName}" not found in config. Available networks: ${availableNetworks || "none"}`
    );
  }

  // Create a copy to avoid mutating the original network config
  const networkCopy = { ...found };
  networkCopy.name = networkName;
  return networkCopy;
}

/**
 * Get a serializable version of the network configuration
 * Excludes sensitive data in production mode
 * @param config - Main configuration object
 * @param networkName - Optional network name (uses default if not provided)
 * @param isDev - Whether running in development mode
 * @returns Serializable network configuration
 */
export function getSerializableNetworkConfig(
  config: PactToolboxConfigObj,
  networkName?: string,
  isDev = true,
): SerializableNetworkConfig {
  const network = networkName ? getNetworkByName(config, networkName) : getDefaultNetworkConfig(config);

  // Base config with only client-safe fields
  const serialized: SerializableNetworkConfig = {
    networkId: network.networkId,
    meta: network.meta,
    rpcUrl: getNetworkRpcUrl(network),
    senderAccount: network.senderAccount,
    type: network.type,
    keysets: network.keysets,
    name: network.name,
    // Include full keyPairs in dev/test mode for pact-toolbox wallet
    // In production, exclude keyPairs entirely for security
    keyPairs: isDev ? network.keyPairs : [],
  };

  // Only include server-side configs if explicitly in development mode
  // These are NOT needed in browser bundles
  if (isDev && process.env["NODE_ENV"] !== "production") {
    // Include server config for pact-server networks
    if (isPactServerNetworkConfig(network) && network.serverConfig) {
      (serialized as any).serverConfig = {
        port: network.serverConfig.port,
        // Only include port, other server configs are not needed client-side
      };
    }

    // Include container config for devnet networks
    if (isDevNetworkConfig(network) && network.containerConfig) {
      (serialized as any).containerConfig = {
        port: network.containerConfig.port,
        // Only include port, other container configs are not needed client-side
      };
    }

    // Include autoStart for local networks
    if (isLocalNetwork(network)) {
      (serialized as any).autoStart = network.autoStart;
    }
  }

  return serialized;
}

/**
 * Configuration for multiple networks with environment context
 */
export interface MultiNetworkConfig {
  /** Default network name */
  default: string;
  /** Map of network configurations */
  configs: Record<string, SerializableNetworkConfig>;
  /** Current environment */
  environment: "development" | "production" | "test";
}

interface GetSerializableMultiNetworkConfigOptions {
  isDev?: boolean;
  isTest?: boolean;
  defaultNetwork?: string;
}

/**
 * Get serializable configuration for all networks
 * Filters networks and sensitive data based on environment
 * @param config - Main configuration object
 * @param options - Options for serialization
 * @returns Multi-network configuration suitable for client-side use
 */
export function getSerializableMultiNetworkConfig(
  config: PactToolboxConfigObj,
  { isDev = true, isTest = false, defaultNetwork }: GetSerializableMultiNetworkConfigOptions = {},
): MultiNetworkConfig {
  const environment = isTest ? "test" : isDev ? "development" : "production";
  const configs: Record<string, SerializableNetworkConfig> = {};

  // Filter networks based on environment
  for (const [networkName, networkConfig] of Object.entries(config.networks)) {
    // In production, exclude local networks and sensitive data
    if (!isDev && isLocalNetwork(networkConfig)) {
      continue;
    }

    configs[networkName] = getSerializableNetworkConfig(config, networkName, isDev);
  }

  const networkFromArgv = process.argv.find((arg) => arg.startsWith("--network="))?.split("=")[1];

  return {
    default:
      defaultNetwork ??
      config.defaultNetwork ??
      Object.values(config.networks)[0]?.name ??
      process.env["PACT_TOOLBOX_NETWORK"] ??
      networkFromArgv ??
      "pactServer",
    configs,
    environment,
  };
}
