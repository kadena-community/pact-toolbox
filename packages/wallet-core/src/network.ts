import type { WalletNetwork } from "@pact-toolbox/types";

/**
 * Common Kadena networks
 */
export const KadenaNetworks: Record<string, WalletNetwork> = {
  mainnet01: {
    id: "mainnet01",
    networkId: "mainnet01", 
    name: "Kadena Mainnet",
    url: "https://api.chainweb.com",
    explorer: "https://explorer.chainweb.com/mainnet",
    isDefault: true,
  },
  testnet04: {
    id: "testnet04",
    networkId: "testnet04",
    name: "Kadena Testnet",
    url: "https://api.testnet.chainweb.com",
    explorer: "https://explorer.chainweb.com/testnet",
  },
  development: {
    id: "development",
    networkId: "development",
    name: "Local DevNet",
    url: "http://localhost:8080",
    explorer: "http://localhost:8080/explorer",
  },
};

/**
 * Network capabilities for wallets
 */
export interface NetworkCapabilities {
  /** Can switch between networks */
  canSwitchNetwork: boolean;
  /** Can add custom networks */
  canAddNetwork: boolean;
  /** Supported network IDs */
  supportedNetworks: string[];
}

/**
 * Enhanced wallet interface with network management
 */
export interface NetworkAwareWallet {
  /** Get current network */
  getCurrentNetwork(): Promise<WalletNetwork>;
  /** Switch to a different network */
  switchNetwork?(networkId: string): Promise<void>;
  /** Add a custom network */
  addNetwork?(network: WalletNetwork): Promise<void>;
  /** Get network capabilities */
  getNetworkCapabilities?(): NetworkCapabilities;
}

/**
 * Check if wallet supports network management
 */
export function supportsNetworkManagement(wallet: any): wallet is NetworkAwareWallet {
  return typeof wallet.getCurrentNetwork === 'function';
}

/**
 * Network validation
 */
export function validateNetwork(network: WalletNetwork): string[] {
  const errors: string[] = [];

  if (!network.id) {
    errors.push("Network ID is required");
  }

  if (!network.networkId) {
    errors.push("Kadena network ID is required");
  }

  if (!network.name) {
    errors.push("Network name is required");
  }

  if (!network.url) {
    errors.push("Network URL is required");
  }

  try {
    new URL(network.url);
  } catch {
    errors.push("Invalid network URL");
  }

  if (network.explorer) {
    try {
      new URL(network.explorer);
    } catch {
      errors.push("Invalid explorer URL");
    }
  }

  return errors;
}

/**
 * Get network by ID
 */
export function getNetworkById(networkId: string): WalletNetwork | undefined {
  return KadenaNetworks[networkId];
}

/**
 * Get default network
 */
export function getDefaultNetwork(): WalletNetwork {
  return Object.values(KadenaNetworks).find(n => n.isDefault) || KadenaNetworks.mainnet01;
}