import type { SerializableNetworkConfig, MultiNetworkConfig } from "../config";

/**
 * Network configuration provider interface
 */
export interface INetworkProvider {
  /**
   * Get a specific network configuration by ID
   * @param networkId - The network ID to retrieve. If not provided, returns current network
   */
  getNetwork(networkId?: string): SerializableNetworkConfig;
  
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
   * Get the full multi-network configuration
   */
  getMultiNetworkConfig(): MultiNetworkConfig;
  
  /**
   * Get available network IDs
   */
  getNetworkIds(): string[];
  
  /**
   * Check if a network ID exists
   */
  hasNetwork(networkId: string): boolean;
}