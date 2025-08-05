import type { PactToolboxConfigObj } from "@pact-toolbox/config";

import { resolveConfig } from "@pact-toolbox/config";
import { PactToolboxNetwork } from "@pact-toolbox/network";
import { PactToolboxClient } from "@pact-toolbox/deployer";
import { logger } from "@pact-toolbox/node-utils";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { getWalletSystem } from "@pact-toolbox/wallet-adapters";

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

  // Initialize wallet system with test configuration
  const walletSystem = await getWalletSystem({
    wallets: {
      keypair: {
        deterministic: true,
        privateKey: privateKey,
        accountName: accountName || "test-account",
      },
    },
    preferences: {
      autoConnect: false, // We'll manually connect
    },
    ui: {
      showOnConnect: false, // No UI in tests
    },
  });

  // Connect to keypair wallet
  const wallet = await walletSystem.connect();

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
    start: () => localNetwork.start(),
    stop: () => localNetwork.stop(),
    restart: () => localNetwork.restart(),
    client,
    config,
    wallet,
    network: localNetwork,
  };
}
