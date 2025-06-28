import type { ChainwebClient } from "@pact-toolbox/chainweb-client";
import type {
  KeyPair,
  MultiNetworkConfig,
  PactMetadata,
  PactSigner,
  SerializableNetworkConfig,
} from "@pact-toolbox/types";

import type { Wallet } from "@pact-toolbox/wallet-core";
import {
  createChainwebClient,
  getKAccountKey,
  getSignerKeys,
  getToolboxGlobalMultiNetworkConfig,
  validateNetworkForEnvironment,
} from "./utils";

export type NetworkChangeListener = (networkName: string, config: SerializableNetworkConfig) => void;

export class ToolboxNetworkContext {
  #networkConfigs: MultiNetworkConfig;
  #client: ChainwebClient;
  #currentNetworkConfig: SerializableNetworkConfig;
  #listeners: Set<NetworkChangeListener> = new Set();
  #defaultWallet: Wallet | null = null;

  constructor(networkConfigs?: MultiNetworkConfig) {
    this.#networkConfigs = networkConfigs ?? getToolboxGlobalMultiNetworkConfig();
    const defaultNetwork = this.#networkConfigs.configs[this.#networkConfigs.default];
    const firstNetwork = Object.values(this.#networkConfigs.configs)[0]!;
    this.#currentNetworkConfig = defaultNetwork ?? firstNetwork;
    if (!this.#currentNetworkConfig) {
      throw new Error("No network config found");
    }
    this.#client = createChainwebClient(this.#currentNetworkConfig);
    // Wallet will be initialized lazily when needed
  }

  getNetworkId(): string {
    return this.#currentNetworkConfig.networkId;
  }

  getMeta(): PactMetadata {
    return this.#currentNetworkConfig.meta;
  }

  getSignerKeys(signer?: string): KeyPair {
    return getSignerKeys(this.#currentNetworkConfig, signer);
  }

  getDefaultSigner(): PactSigner | undefined {
    if ("string" === typeof this.#currentNetworkConfig.senderAccount) {
      const signer = this.#currentNetworkConfig.keyPairs.find(
        (s) => s.account === this.#currentNetworkConfig.senderAccount,
      );
      return {
        pubKey: signer?.publicKey || getKAccountKey(this.#currentNetworkConfig.senderAccount),
        address: signer?.account || this.#currentNetworkConfig.senderAccount,
        scheme: "ED25519",
      };
    }
    return this.#currentNetworkConfig.senderAccount;
  }

  getWallet(): Wallet | null {
    return this.#defaultWallet;
  }

  setWallet(wallet: Wallet | null): void {
    this.#defaultWallet = wallet;
  }

  getNetworkConfig(): SerializableNetworkConfig {
    return this.#currentNetworkConfig;
  }

  getAllNetworkConfigs(): SerializableNetworkConfig[] {
    return Object.values(this.#networkConfigs.configs);
  }

  getClient(): ChainwebClient {
    return this.#client;
  }

  // Multi-network support methods
  getCurrentNetworkConfig(): SerializableNetworkConfig {
    return this.#currentNetworkConfig;
  }

  getAvailableNetworks(): string[] {
    return Object.keys(this.#networkConfigs.configs);
  }

  async switchNetwork(networkName: string): Promise<void> {
    // Validate network exists and is allowed in current environment
    if (!validateNetworkForEnvironment(networkName)) {
      throw new Error(`Network "${networkName}" is not available or not allowed in current environment`);
    }

    const newConfig = this.#networkConfigs.configs[networkName];
    if (!newConfig) {
      throw new Error(`Network "${networkName}" not found in configuration`);
    }

    // Update internal state
    this.#currentNetworkConfig = newConfig;
    this.#client = createChainwebClient(this.#currentNetworkConfig);

    // Reset wallet connection when switching networks
    if (this.#defaultWallet) {
      // Disconnect from current network
      try {
        await this.#defaultWallet.disconnect();
      } catch (error) {
        console.warn("Failed to disconnect wallet during network switch:", error);
      }
      this.#defaultWallet = null;
    }

    // Notify all listeners about the network change
    this.#notifyNetworkChange(networkName, newConfig);
  }

  isNetworkAvailable(networkName: string): boolean {
    return validateNetworkForEnvironment(networkName) && !!this.#networkConfigs.configs[networkName];
  }

  getNetworkType(): SerializableNetworkConfig["type"] {
    return this.#currentNetworkConfig.type;
  }

  isLocalNetwork(): boolean {
    return this.#currentNetworkConfig.type === "pact-server" || this.#currentNetworkConfig.type === "chainweb-devnet";
  }

  isProductionNetwork(): boolean {
    return this.#currentNetworkConfig.type === "chainweb";
  }

  subscribe(listener: NetworkChangeListener): () => void {
    this.#listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #notifyNetworkChange(networkName: string, config: SerializableNetworkConfig): void {
    // Notify all listeners
    this.#listeners.forEach((listener) => {
      try {
        listener(networkName, config);
      } catch (error) {
        console.error("Error in network change listener:", error);
      }
    });

    // Also emit DOM event for compatibility
    if (typeof window !== "undefined" && window.dispatchEvent) {
      const event = new CustomEvent("pact-toolbox-network-changed", {
        detail: { networkName, config },
      });
      window.dispatchEvent(event);
    }
  }
}

// Global context management
// @ts-expect-error
let globalContext: ToolboxNetworkContext | null = globalThis["__PACT_TOOLBOX_CONTEXT__"];
export function createToolboxNetworkContext(
  networkConfigs?: MultiNetworkConfig,
  setAsGlobal?: boolean,
): ToolboxNetworkContext {
  const context = new ToolboxNetworkContext(networkConfigs);
  if (setAsGlobal || !globalContext) {
    globalContext = context;
    // Set both context references for compatibility
    (globalThis as any).__PACT_TOOLBOX_CONTEXT__ = globalContext;
    (globalThis as any).__PACT_TOOLBOX_NETWORK_CONTEXT__ = globalContext;
  }
  return context;
}

export function getGlobalNetworkContext(): ToolboxNetworkContext {
  if (!globalContext) {
    globalContext = createToolboxNetworkContext();
  }
  return globalContext;
}
