import type { PartiallySignedTransaction, SignedTransaction, Wallet, WalletAccount, WalletNetwork } from "@pact-toolbox/types";
import type { NetworkAwareWallet, NetworkCapabilities } from "./network";
import { getNetworkById, getDefaultNetwork } from "./network";

/**
 * Abstract base class for wallet implementations
 * Provides common properties and basic implementations
 */
export abstract class BaseWallet implements Wallet, Partial<NetworkAwareWallet> {
  /** Wallet provider ID */
  readonly id?: string;
  
  protected account: WalletAccount | null = null;
  protected network: WalletNetwork | null = null;
  protected connected = false;

  abstract isInstalled(): boolean;
  abstract connect(networkId?: string): Promise<WalletAccount>;
  abstract sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  abstract sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;

  async getAccount(networkId?: string): Promise<WalletAccount> {
    if (!this.connected || !this.account) {
      return this.connect(networkId);
    }
    return this.account;
  }

  async getNetwork(): Promise<WalletNetwork> {
    if (!this.connected || !this.network) {
      await this.connect();
    }
    return this.network!;
  }

  async isConnected(_networkId?: string): Promise<boolean> {
    return this.connected;
  }

  async disconnect(_networkId?: string): Promise<void> {
    this.connected = false;
    this.account = null;
    this.network = null;
  }

  /**
   * Get current network - base implementation
   */
  async getCurrentNetwork(): Promise<WalletNetwork> {
    if (!this.network) {
      this.network = await this.getNetwork();
    }
    return this.network;
  }

  /**
   * Get network capabilities - base implementation
   */
  getNetworkCapabilities?(): NetworkCapabilities {
    return {
      canSwitchNetwork: false,
      canAddNetwork: false,
      supportedNetworks: [this.network?.networkId || "mainnet01"],
    };
  }
}

/**
 * Utility function to detect browser extension wallets
 */
export function detectBrowserExtension(globalProp: string, timeout = 3000): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    if ((window as any)[globalProp]) {
      resolve(true);
      return;
    }

    const checkInterval = 100;
    let elapsed = 0;

    const intervalId = setInterval(() => {
      if ((window as any)[globalProp]) {
        clearInterval(intervalId);
        resolve(true);
      } else if (elapsed >= timeout) {
        clearInterval(intervalId);
        resolve(false);
      }
      elapsed += checkInterval;
    }, checkInterval);
  });
}