import type { MultiNetworkConfig, SerializableNetworkConfig } from "@pact-toolbox/types";

export interface NetworkConfigProvider {
  /**
   * Get a specific network configuration by ID
   * @param networkId - The network ID to retrieve. If not provided, returns current network
   */
  getNetwork(networkId?: string): SerializableNetworkConfig;
  
  /**
   * Get the full multi-network configuration
   */
  getMultiNetworkConfig(): MultiNetworkConfig;
  
  /**
   * Get the currently selected network configuration
   */
  getCurrentNetwork(): SerializableNetworkConfig;
  
  /**
   * Set the current network by ID
   * @param networkId - The network ID to set as current
   */
  setCurrentNetwork(networkId: string): void;
  
  /**
   * Get available network IDs
   */
  getNetworkIds(): string[];
  
  /**
   * Check if a network ID exists
   */
  hasNetwork(networkId: string): boolean;
}

export interface NetworkConfigOptions {
  /**
   * Initial network configuration
   */
  networks?: MultiNetworkConfig;
  
  /**
   * Whether to use injected global config as fallback
   */
  useGlobalFallback?: boolean;
  
  /**
   * Custom network ID to use as current
   */
  currentNetworkId?: string;
}