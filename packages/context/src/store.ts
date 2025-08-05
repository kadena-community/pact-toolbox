import type { Wallet } from "@pact-toolbox/wallet-core";
import { ChainwebClient } from "@pact-toolbox/chainweb-client";
import type { IStore } from "@pact-toolbox/types";
import type { ContextConfig, ContextState, PactToolboxContext, SerializableNetworkConfig } from "./types";
import { eventBus } from "./events";
import { initializeWalletSystem, createWalletModal } from "./wallet-integration";
import type { WalletSystem } from "@pact-toolbox/wallet-adapters";

let globalStore: PactToolboxStore | null = null;

export class PactToolboxStore implements PactToolboxContext, IStore {
  private _state: ContextState;
  private _config: ContextConfig;
  private _walletSystem?: WalletSystem;
  private _walletModal?: HTMLElement | null;

  constructor(config: ContextConfig) {
    this._config = config;
    const environment = config.networks?.environment || "development";
    const defaultNetwork = config.networks?.configs[config.networks.default];
    const firstNetwork = Object.values(config.networks?.configs || {})[0]!;
    const currentNetworkConfig = defaultNetwork ?? firstNetwork;
    this._state = {
      network: currentNetworkConfig,
      networks: config.networks || null,
      wallet: null,
      wallets: [],
      isConnecting: false,
      client: null,
      clients: new Map(),
      isWalletModalOpen: false,
      environment,
      isDevNet: currentNetworkConfig?.type === "chainweb-devnet",
    };
    this.createClientForNetwork(currentNetworkConfig);
    
    // Initialize wallet system if enabled
    if (config.enableWalletUI !== false) {
      this.initializeWallets();
    }
  }

  // Getters for state
  get network() {
    return this._state.network;
  }
  get networks() {
    return this._state.networks;
  }
  get wallet() {
    return this._state.wallet;
  }
  get wallets() {
    return this._state.wallets;
  }
  get isConnecting() {
    return this._state.isConnecting;
  }
  get client() {
    return this._state.client;
  }
  get clients() {
    return this._state.clients;
  }
  get isWalletModalOpen() {
    return this._state.isWalletModalOpen;
  }
  get environment() {
    return this._state.environment;
  }
  get isDevNet() {
    return this._state.isDevNet;
  }

  // Network actions
  async setNetwork(networkId: string): Promise<void> {
    if (!this.networks || !this.networks.configs[networkId]) {
      throw new Error(`Network ${networkId} not found`);
    }

    const network = this.networks.configs[networkId];
    const previous = this._state.network;
    this._state.network = network;

    // Create or get client for this network
    this.createClientForNetwork(network);

    // Disconnect wallet if network changed
    if (previous && previous.networkId !== networkId && this.wallet) {
      await this.disconnectWallet();
    }

    eventBus.emit("network:changed", { network, previous });
  }

  // Wallet actions
  async connectWallet(walletId?: string): Promise<void> {
    if (!this._walletSystem) {
      throw new Error("Wallet system not initialized");
    }

    this._state.isConnecting = true;
    try {
      const wallet = await this._walletSystem.connect(walletId);
      this._state.wallet = wallet;
      // Event will be emitted by wallet integration
    } finally {
      this._state.isConnecting = false;
    }
  }

  async disconnectWallet(): Promise<void> {
    if (!this._walletSystem) return;
    
    await this._walletSystem.disconnect();
    this._state.wallet = null;
    // Event will be emitted by wallet integration
  }

  setWallet(wallet: Wallet | null): void {
    const previous = this._state.wallet;
    this._state.wallet = wallet;
    eventBus.emit("wallet:changed", { wallet, previous });
  }

  // UI actions
  openWalletModal(): void {
    this._state.isWalletModalOpen = true;
    eventBus.emit("wallet:modal:open");
    
    // Show modal if available
    if (this._walletModal && typeof window !== "undefined") {
      this._walletModal.setAttribute("open", "true");
      document.body.appendChild(this._walletModal);
    }
  }

  closeWalletModal(): void {
    this._state.isWalletModalOpen = false;
    eventBus.emit("wallet:modal:close");
    
    // Hide modal if available
    if (this._walletModal && typeof window !== "undefined") {
      this._walletModal.setAttribute("open", "false");
      if (this._walletModal.parentNode) {
        this._walletModal.parentNode.removeChild(this._walletModal);
      }
    }
  }

  // Client actions
  getClient(networkId?: string): ChainwebClient {
    const targetNetworkId = networkId || this.network?.networkId;
    if (!targetNetworkId) {
      throw new Error("No network selected");
    }

    const client = this.clients.get(targetNetworkId);
    if (!client) {
      throw new Error(`No client found for network ${targetNetworkId}`);
    }

    return client;
  }

  // Configuration
  updateConfig(config: Partial<ContextConfig>): void {
    this._config = { ...this._config, ...config };
    eventBus.emit("config:updated", { config: this._config });
  }

  // Private methods
  private createClientForNetwork(network: SerializableNetworkConfig): void {
    if (!this.clients.has(network.networkId)) {
      const client = new ChainwebClient({
        networkId: network.networkId,
        chainId: network.meta.chainId,
        rpcUrl: (networkId: string, chainId: string) =>
          network.rpcUrl.replace("{networkId}", networkId).replace("{chainId}", chainId),
      });
      this.clients.set(network.networkId, client);
    }

    this._state.client = this.clients.get(network.networkId) || null;
  }

  // Initialize wallet system
  private async initializeWallets(): Promise<void> {
    try {
      const { walletSystem, availableWallets } = await initializeWalletSystem(this._config);
      this._walletSystem = walletSystem;
      this._state.wallets = availableWallets as any[];
      
      // Create modal if UI is enabled
      if (this._config.enableWalletUI && typeof window !== "undefined") {
        this._walletModal = createWalletModal();
      }

      // Sync initial wallet state
      const primaryWallet = walletSystem.getPrimary();
      if (primaryWallet) {
        this._state.wallet = primaryWallet;
      }
    } catch (error) {
      console.error("Failed to initialize wallet system:", error);
    }
  }
}

// Singleton accessor
export function getStore(config?: ContextConfig): PactToolboxStore {
  if (!globalStore) {
    if (!config) {
      throw new Error("PactToolboxStore not initialized. Please provide config on first call.");
    }
    globalStore = new PactToolboxStore(config);
  }
  return globalStore;
}

// Reset store (useful for testing)
export function resetStore(): void {
  globalStore = null;
}
