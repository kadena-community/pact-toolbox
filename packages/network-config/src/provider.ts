import type { MultiNetworkConfig, SerializableNetworkConfig, KeyPair, PactSigner } from "@pact-toolbox/types";
import { createDefaultDevNetwork, createDefaultMainNetwork, createDefaultTestNetwork } from "./defaults";
import { getKAccountKey, getSignerKeysFromNetwork } from "./utils";

/**
 * Get the injected network configuration from the global scope
 * This is typically injected by the pact-toolbox bundler plugin
 */
export function getInjectedNetworkConfig(): MultiNetworkConfig | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  const injected = (globalThis as any).__PACT_TOOLBOX_NETWORKS__;
  if (!injected) {
    return null;
  }

  // Handle string (JSON) or object format
  if (typeof injected === "string") {
    try {
      return JSON.parse(injected);
    } catch {
      console.warn("Failed to parse injected network config");
      return null;
    }
  }

  return injected;
}

/**
 * Create default network configuration
 */
export function createDefaultNetworkConfig(): MultiNetworkConfig {
  return {
    default: "development",
    environment: "development",
    configs: {
      development: createDefaultDevNetwork(),
      testnet05: createDefaultTestNetwork(),
      mainnet01: createDefaultMainNetwork(),
    },
  };
}

/**
 * Simplified network configuration provider
 */
export class NetworkConfigProvider {
  static instance: NetworkConfigProvider | null = null;
  #current: string;
  #config: MultiNetworkConfig;

  constructor(config?: MultiNetworkConfig) {
    this.#config = config || getInjectedNetworkConfig() || createDefaultNetworkConfig();
    this.#current = this.#config.default || "development";
  }

  static getInstance(options?: MultiNetworkConfig): NetworkConfigProvider {
    if (!NetworkConfigProvider.instance) {
      NetworkConfigProvider.instance = new NetworkConfigProvider(options);
    }
    return NetworkConfigProvider.instance;
  }

  /**
   * Get network configuration by ID
   * @param networkId - Optional network ID. If not provided, returns current network
   */
  getNetwork(networkId?: string): SerializableNetworkConfig {
    const id = networkId || this.#current;
    const network = this.#config.configs[id];

    if (!network) {
      throw new Error(`Network "${id}" not found in configuration`);
    }

    return network;
  }

  getNetworkById(networkId: string): SerializableNetworkConfig | null {
    return this.#config.configs[networkId] || null;
  }

  /**
   * Set current network by ID
   */
  setCurrentNetwork(networkId: string): void {
    if (!this.#config.configs[networkId]) {
      throw new Error(`Network "${networkId}" not found in configuration`);
    }
    this.#current = networkId;
  }

  /**
   * Get the full multi-network configuration
   */
  getMultiNetworkConfig(): MultiNetworkConfig {
    return this.#config;
  }

  getNetworks(): SerializableNetworkConfig[] {
    return Object.values(this.#config.configs);
  }

  /**
   * Get available network IDs
   */
  getNetworkIds(): string[] {
    return Object.keys(this.#config.configs);
  }

  /**
   * Check if a network ID exists
   */
  hasNetwork(networkId: string): boolean {
    return networkId in this.#config.configs;
  }

  getSignerKeys(signer?: string, networkId?: string): KeyPair {
    return getSignerKeysFromNetwork(this.getNetwork(networkId), signer);
  }

  getDefaultSigner(networkId?: string): PactSigner | undefined {
    const network = this.getNetwork(networkId);
    if ("string" === typeof network.senderAccount) {
      const signer = network.keyPairs.find((s) => s.account === network.senderAccount);
      return {
        pubKey: signer?.publicKey || getKAccountKey(network.senderAccount),
        address: signer?.account || network.senderAccount,
        scheme: "ED25519",
      };
    }
    return network.senderAccount;
  }
}
