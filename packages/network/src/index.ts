/**
 * @module @pact-toolbox/network
 * 
 * Network management for Pact development environments.
 * Supports both Pact Server and Chainweb DevNet networks.
 */

export { 
  PactToolboxNetwork, 
  createNetwork,
  type NetworkOptions 
} from "./network";

export { 
  PactServerNetwork 
} from "./networks/pactServer";

export { 
  DevNetNetwork 
} from "./networks/devnet";

export type {
  NetworkApi,
  NetworkStartOptions,
  NetworkType,
  NetworkHealth
} from "./types";

// Re-export config types that users need
export type {
  NetworkConfig,
  PactServerNetworkConfig,
  DevNetworkConfig
} from "@pact-toolbox/config";