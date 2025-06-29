/**
 * Network API types for Pact Toolbox
 */

import type { PactToolboxClient } from "@pact-toolbox/runtime";

/**
 * Network types supported by Pact Toolbox
 */
export type NetworkType = "pact-server" | "chainweb-devnet";

/**
 * Options for starting a network
 */
export interface NetworkStartOptions {
  /** Run network in background (default: true) */
  detached?: boolean;
  /** Don't persist data between restarts (default: false) */
  stateless?: boolean;
  /** Custom client instance */
  client?: PactToolboxClient;
}

/**
 * Core network API that all network implementations must provide
 */
export interface NetworkApi {
  /** Unique identifier for this network instance */
  readonly id: string;

  /** Start the network */
  start(options?: NetworkStartOptions): Promise<void>;

  /** Stop the network */
  stop(): Promise<void>;

  /** Restart the network */
  restart(options?: NetworkStartOptions): Promise<void>;

  /** Check if network is healthy */
  isHealthy(): Promise<boolean>;

  /** Get the main service port */
  getPort(): number;

  /** Get the RPC endpoint URL */
  getRpcUrl(): string;

  /** Check if network supports on-demand mining */
  hasOnDemandMining(): boolean;

  /** Get mining endpoint URL (if supported) */
  getMiningUrl(): string | null;
}

/**
 * Network health status
 */
export interface NetworkHealth {
  healthy: boolean;
  latency?: number;
  error?: string;
  timestamp: number;
}

/**
 * DevNet service definition (internal use)
 */
export interface DevNetServiceDefinition {
  networkName: string;
  clusterId: string;
  volumes: string[];
  services: Record<string, any>;
}
