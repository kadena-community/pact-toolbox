/**
 * @pact-toolbox/chainweb-client
 *
 * Fast, lightweight client for Chainweb and Pact APIs
 * Simple, powerful API that works across web, Node.js, and React Native
 */

// Core client
export { ChainwebClient } from "./client";

// Types and interfaces
export type {
  NetworkConfig,
  SendResult,
  ListenResult,
  TransactionResult,
  LocalResult,
  PollRequest,
  PollResponse,
  BatchResult,
  NetworkInfo,
  ChainInfo,
  CutInfo,
  HealthCheck,
  RequestConfig,
  ChainwebErrorCode,
  SignedTransaction,
} from "./types";

// Error class
export { ChainwebClientError } from "./types";

// Utility functions for creating clients
import { ChainwebClient } from "./client";
import type { NetworkConfig } from "./types";

/**
 * Create a client for mainnet
 */
export function createMainnetClient(config?: Partial<NetworkConfig>): ChainwebClient {
  return new ChainwebClient({
    networkId: "mainnet01",
    chainId: "0",
    rpcUrl: (networkId, chainId) => `https://api.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
    ...config,
  });
}

/**
 * Create a client for testnet
 */
export function createTestnetClient(config?: Partial<NetworkConfig>): ChainwebClient {
  return new ChainwebClient({
    networkId: "testnet04",
    chainId: "0",
    rpcUrl: (networkId, chainId) =>
      `https://api.testnet.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
    ...config,
  });
}

/**
 * Create a client for development/local network
 */
export function createDevnetClient(port: number, config?: Partial<NetworkConfig>): ChainwebClient {
  return new ChainwebClient({
    networkId: "development",
    chainId: "0",
    rpcUrl: (networkId, chainId) => `http://localhost:${port}/chainweb/0.0/${networkId}/chain/${chainId}/pact/api/v1`,
    ...config,
  });
}

export function createPactServerClient(port: number, config?: Partial<NetworkConfig>): ChainwebClient {
  return new ChainwebClient({
    networkId: "development",
    chainId: "0",
    rpcUrl: () => `http://localhost:${port}/api/v1/local`,
    ...config,
  });
}

/**
 * Create a client with custom configuration
 */
export function createCustomClient(config: NetworkConfig): ChainwebClient {
  return new ChainwebClient(config);
}

// Helper functions
export {
  type Client,
  type ChainwebClientHelpers,
  getClient,
  getTxDataOrFail,
  dirtyReadOrFail,
  localOrFail,
  preflight,
  submit,
  listen,
  submitAndListen,
  createClientHelpers,
} from "./helpers";

// Note: No default export to avoid mixed export patterns
// Use `import { ChainwebClient } from '@pact-toolbox/chainweb-client'` instead
