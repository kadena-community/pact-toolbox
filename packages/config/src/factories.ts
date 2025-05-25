import { defu } from "defu";

import type { ChainwebNetworkConfig, DevNetworkConfig, PactServerConfig, PactServerNetworkConfig } from "./config";
import { defaultKeyPairs, defaultKeysets, defaultMeta } from "./defaults";
import { createChainwebRpcUrl } from "./utils";

export function createPactServerConfig(overrides?: Partial<PactServerConfig>): Required<PactServerConfig> {
  const defaults = {
    port: "9091",
    logDir: ".pact-toolbox/pact/logs",
    persistDir: ".pact-toolbox/pact/persist",
    verbose: true,
    pragmas: [],
    execConfig: ["DisablePact44", "AllowReadInLocal"],
  };
  return {
    ...defaults,
    ...overrides,
  } as Required<PactServerConfig>;
}

export function createLocalNetworkConfig(overrides?: Partial<PactServerNetworkConfig>): PactServerNetworkConfig {
  const defaults = {
    type: "pact-server",
    rpcUrl: "http://localhost:{port}",
    networkId: "development",
    keyPairs: defaultKeyPairs,
    keysets: defaultKeysets,
    senderAccount: "sender00",
    autoStart: true,
    serverConfig: createPactServerConfig(),
    meta: defaultMeta,
  } satisfies PactServerNetworkConfig;
  return defu(overrides ?? {}, defaults) as PactServerNetworkConfig;
}

export function createDevNetNetworkConfig(overrides?: Partial<DevNetworkConfig>): DevNetworkConfig {
  const defaults = {
    type: "chainweb-devnet",
    rpcUrl: createChainwebRpcUrl(),
    networkId: "development",
    keyPairs: defaultKeyPairs,
    keysets: defaultKeysets,
    senderAccount: "sender00",
    autoStart: true,
    containerConfig: {
      port: "8080",
      persistDb: true,
    },
    meta: defaultMeta,
  } satisfies DevNetworkConfig;
  return defu(overrides ?? {}, defaults) as DevNetworkConfig;
}

export function createChainwebNetworkConfig(overrides?: Partial<ChainwebNetworkConfig>): ChainwebNetworkConfig {
  const defaults = {
    type: "chainweb",
    rpcUrl: createChainwebRpcUrl({
      host: "https://testnet.chainweb.com",
    }),
    networkId: "testnet04",
    keyPairs: [],
    keysets: {},
    senderAccount: "",
    meta: defaultMeta,
  } as ChainwebNetworkConfig;

  return defu(overrides ?? {}, defaults) as ChainwebNetworkConfig;
}
export function createTestNetNetworkConfig(overrides?: Partial<ChainwebNetworkConfig>): ChainwebNetworkConfig {
  const defaults = {
    type: "chainweb",
    rpcUrl: createChainwebRpcUrl({
      host: "https://testnet.chainweb.com",
    }),
    networkId: "testnet04",
    keyPairs: [],
    keysets: {},
    senderAccount: "",
    meta: defaultMeta,
  } satisfies ChainwebNetworkConfig;

  return defu(overrides ?? {}, defaults) as ChainwebNetworkConfig;
}

export function createMainNetNetworkConfig(overrides?: Partial<ChainwebNetworkConfig>): ChainwebNetworkConfig {
  const defaults = {
    type: "chainweb",
    rpcUrl: createChainwebRpcUrl({
      host: "https://mainnet.chainweb.com",
    }),
    networkId: "mainnet01",
    keyPairs: [],
    keysets: {},
    senderAccount: "",
    meta: defaultMeta,
  } satisfies ChainwebNetworkConfig;

  return defu(overrides ?? {}, defaults) as ChainwebNetworkConfig;
}
