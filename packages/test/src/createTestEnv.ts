import type { PactToolboxConfigObj } from "@pact-toolbox/config";

import { resolveConfig } from "@pact-toolbox/config";
import { PactToolboxNetwork } from "@pact-toolbox/network";
import { PactDeployer } from "@pact-toolbox/deployer";
import { logger } from "@pact-toolbox/node-utils";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { setupWalletManager } from "@pact-toolbox/wallet-manager";

import { injectNetworkConfig, updatePorts } from "./utils";

export interface PactTestEnv {
  deployer: PactDeployer;
  stop: () => Promise<void>;
  start: () => Promise<void>;
  restart: () => Promise<void>;
  config: PactToolboxConfigObj;
  wallet: Wallet;
  network: PactToolboxNetwork;
}

export interface CreatePactTestEnvOptions {
  network?: string;
  deployer?: PactDeployer;
  configOverrides?: Partial<PactToolboxConfigObj>;
  config?: Required<PactToolboxConfigObj>;
  isStateless?: boolean;
  privateKey?: string;
  accountName?: string;
}

export async function createPactTestEnv({
  network,
  deployer,
  config,
  configOverrides,
  privateKey: _privateKey,
  accountName: _accountName,
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
  // {
  //   wallets: {
  //     keypair: {
  //       deterministic: true,
  //       privateKey: privateKey,
  //       accountName: accountName || "test-account",
  //     },
  //   },
  //   preferences: {
  //     autoConnect: false, // We'll manually connect
  //   },
  //   ui: {
  //     showOnConnect: false, // No UI in tests
  //   },
  // }
  const walletSystem = await setupWalletManager();

  // Connect to keypair wallet
  const wallet = await walletSystem.connect();

  if (!deployer) {
    deployer = new PactDeployer(config);
  }

  // Set the wallet in the network context
  // const context = deployer.getContext();
  // if (context && typeof context.setWallet === "function") {
  //   context.setWallet(wallet);
  // }

  const localNetwork = new PactToolboxNetwork(config, {
    deployer,
    detached: true,
    logAccounts: false,
    stateless: true,
  });

  return {
    start: () => localNetwork.start(),
    stop: () => localNetwork.stop(),
    restart: () => localNetwork.restart(),
    deployer,
    config,
    wallet,
    network: localNetwork,
  };
}
