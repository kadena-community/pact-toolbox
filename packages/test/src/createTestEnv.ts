import type { PactToolboxConfigObj } from "@pact-toolbox/config";

import { resolveConfig } from "@pact-toolbox/config";
import { PactToolboxNetwork } from "@pact-toolbox/network";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/node-utils";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { configureWalletUI } from "@pact-toolbox/transaction";

import { injectNetworkConfig, updatePorts } from "./utils";

export interface PactTestEnv {
  client: PactToolboxClient;
  stop: () => Promise<void>;
  start: () => Promise<void>;
  restart: () => Promise<void>;
  config: PactToolboxConfigObj;
  wallet: Wallet;
  network: PactToolboxNetwork;
}

export interface CreatePactTestEnvOptions {
  network?: string;
  client?: PactToolboxClient;
  configOverrides?: Partial<PactToolboxConfigObj>;
  config?: Required<PactToolboxConfigObj>;
  isStateless?: boolean;
  privateKey?: string;
  accountName?: string;
}

export async function createPactTestEnv({
  network,
  client,
  config,
  configOverrides,
  privateKey,
  accountName,
}: CreatePactTestEnvOptions = {}): Promise<PactTestEnv> {
  logger.pauseLogs();

  // Set global test mode flag
  (globalThis as any).__PACT_TOOLBOX_TEST_MODE__ = true;

  if (!config) {
    config = await resolveConfig(configOverrides);
  }

  if (network) {
    config.defaultNetwork = network;
  }

  // Update ports to avoid conflicts
  await updatePorts(config);
  injectNetworkConfig(config);

  // Get the network configuration
  const defaultNetworkKey = config.defaultNetwork || Object.keys(config.networks)[0];
  if (!defaultNetworkKey) {
    throw new Error("No network configurations found");
  }

  const networkConfig = config.networks[defaultNetworkKey];
  if (!networkConfig) {
    throw new Error(`Network configuration for '${defaultNetworkKey}' not found`);
  }

  // Dynamic import to avoid resolution issues in test environment
  const { KeypairWallet } = await import("@pact-toolbox/wallet-adapters/keypair");

  // Create keypair wallet for testing
  const wallet = new KeypairWallet({
    networkId: networkConfig.networkId || "development",
    rpcUrl: networkConfig.rpcUrl || "http://localhost:8080",
    privateKey: privateKey || undefined, // Will generate if not provided
    accountName: accountName || undefined,
    chainId: "0",
  });

  // Connect the wallet
  await wallet.connect();

  // Configure wallet UI to use the test wallet automatically
  configureWalletUI({
    showUI: false, // Disable UI in tests
    walletSelector: async () => wallet, // Always return the test wallet
  });

  if (!client) {
    client = new PactToolboxClient(config);
  }

  // Set the wallet in the network context
  const context = client.getContext();
  if (context && typeof context.setWallet === "function") {
    context.setWallet(wallet);
  }

  const localNetwork = new PactToolboxNetwork(config, {
    client,
    detached: true,
    logAccounts: false,
    stateless: true,
  });

  return {
    start: async () => localNetwork.start(),
    stop: async () => localNetwork.stop(),
    restart: async () => localNetwork.restart(),
    client,
    config,
    wallet,
    network: localNetwork,
  };
}
