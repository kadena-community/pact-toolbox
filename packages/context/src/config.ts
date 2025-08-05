import type { ContextConfig, MultiNetworkConfig } from "./types";

export function createConfig(config: Partial<ContextConfig> = {}): ContextConfig {
  const defaults: ContextConfig = {
    enableWalletUI: true,
    autoConnectWallet: false,
    preferredWallets: [],
    devMode: true,
    clientConfig: {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    },
  };

  return mergeConfigs(defaults, config);
}

export function mergeConfigs(...configs: Partial<ContextConfig>[]): ContextConfig {
  const result: ContextConfig = {
    enableWalletUI: true,
    autoConnectWallet: false,
    preferredWallets: [],
    devMode: false,
    clientConfig: {},
  };

  for (const config of configs) {
    if (config.networks) {
      result.networks = config.networks;
    }

    if (config.enableWalletUI !== undefined) {
      result.enableWalletUI = config.enableWalletUI;
    }

    if (config.autoConnectWallet !== undefined) {
      result.autoConnectWallet = config.autoConnectWallet;
    }

    if (config.preferredWallets) {
      result.preferredWallets = [...new Set([...result.preferredWallets!, ...config.preferredWallets])];
    }

    if (config.devMode !== undefined) {
      result.devMode = config.devMode;
    }

    if (config.clientConfig) {
      result.clientConfig = {
        ...result.clientConfig,
        ...config.clientConfig,
      };
    }
  }

  return result;
}

// Helper to get config from global context (injected by unplugin)
export function getGlobalConfig(): Partial<ContextConfig> | null {
  if (typeof globalThis !== "undefined") {
    const global = globalThis as any;
    if (global.__PACT_TOOLBOX_CONFIG__) {
      return global.__PACT_TOOLBOX_CONFIG__;
    }

    // Use the existing injected MultiNetworkConfig
    if (global.__PACT_TOOLBOX_NETWORKS__) {
      return {
        networks: global.__PACT_TOOLBOX_NETWORKS__ as MultiNetworkConfig,
      };
    }
  }

  return null;
}

// Initialize config with global config if available
export function createConfigWithGlobal(config: Partial<ContextConfig> = {}): ContextConfig {
  const globalConfig = getGlobalConfig();
  if (globalConfig) {
    return createConfig(mergeConfigs(globalConfig, config));
  }
  return createConfig(config);
}
