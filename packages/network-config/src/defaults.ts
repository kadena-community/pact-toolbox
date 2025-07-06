import type { SerializableNetworkConfig } from "@pact-toolbox/types";
import { DEFAULT_GAS_LIMIT, DEFAULT_GAS_PRICE, DEFAULT_TTL, DEFAULT_KEY_PAIRS, DEFAULT_KEYSETS } from "./constants";

export function createDefaultDevNetwork(): SerializableNetworkConfig {
  return {
    networkId: "development",
    name: "Development",
    type: "chainweb-devnet",
    rpcUrl: "http://localhost:8080/chainweb/0.0/development/chain/0/pact",
    meta: {
      chainId: "0",
      gasLimit: DEFAULT_GAS_LIMIT,
      gasPrice: DEFAULT_GAS_PRICE,
      ttl: DEFAULT_TTL,
    },
    keyPairs: DEFAULT_KEY_PAIRS,
    keysets: DEFAULT_KEYSETS,
    senderAccount: "sender00",
  };
}

export function createDefaultTestNetwork(): SerializableNetworkConfig {
  return {
    networkId: "testnet04",
    name: "Testnet",
    type: "chainweb",
    rpcUrl: "https://api.testnet.chainweb.com/chainweb/0.0/testnet04/chain/0/pact",
    meta: {
      chainId: "0",
      gasLimit: DEFAULT_GAS_LIMIT,
      gasPrice: DEFAULT_GAS_PRICE,
      ttl: DEFAULT_TTL,
    },
    keyPairs: [],
    keysets: {},
    senderAccount: "",
  };
}

export function createDefaultMainNetwork(overrides?: Partial<SerializableNetworkConfig>): SerializableNetworkConfig {
  return {
    networkId: "mainnet01",
    name: "Mainnet",
    type: "chainweb",
    rpcUrl: "https://api.chainweb.com/chainweb/0.0/mainnet01/chain/0/pact",
    meta: {
      chainId: "0",
      gasLimit: DEFAULT_GAS_LIMIT,
      gasPrice: DEFAULT_GAS_PRICE,
      ttl: DEFAULT_TTL,
    },
    keyPairs: [],
    keysets: {},
    senderAccount: "",
    ...overrides,
  };
}
