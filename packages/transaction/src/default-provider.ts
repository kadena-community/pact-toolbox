import type { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { GlobalNetworkConfigProvider } from "@pact-toolbox/network-config";

/**
 * Creates a default network provider for development use
 * This allows the transaction builder to work without DI setup
 */
export function createDefaultNetworkProvider(): NetworkConfigProvider {
  return new GlobalNetworkConfigProvider({
    currentNetworkId: "development",
    networks: {
      default: "development",
      environment: "development",
      configs: {
        development: {
          networkId: "development",
          chainId: "0",
          rpcUrl: "http://localhost:8080",
          networkHost: "http://localhost:8080",
        }
      }
    }
  });
}