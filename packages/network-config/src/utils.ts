import type { SerializableNetworkConfig } from "@pact-toolbox/types";

/**
 * Check if pact-toolbox is installed (has injected config)
 */
export function isToolboxInstalled(): boolean {
  return (
    !!(globalThis as any).__PACT_TOOLBOX_NETWORKS__ ||
    !!(globalThis as any).__PACT_TOOLBOX_CONTEXT__ ||
    !!(globalThis as any).__PACT_TOOLBOX_STORE__
  );
}

/**
 * Detect the appropriate network based on environment
 */
export function detectNetworkFromEnvironment(): string {
  // In browser, check hostname
  if (typeof globalThis !== "undefined" && "window" in globalThis) {
    const win = globalThis as any;
    if (win.window?.location?.hostname) {
      const hostname = win.window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
        return "development";
      }
    }
  }

  // Check NODE_ENV
  const nodeEnv = process.env?.["NODE_ENV"];
  if (nodeEnv === "test") {
    return "development";
  }
  if (nodeEnv === "development") {
    return "testnet04";
  }

  // Default to mainnet in production
  return "mainnet01";
}

/**
 * Check if a network is a local/development network
 */
export function isLocalNetwork(network: SerializableNetworkConfig): boolean {
  // Check network ID
  if (network.networkId === "development" || network.networkId === "fast-development") {
    return true;
  }

  // Check RPC URL
  const rpcUrl = network.rpcUrl.toLowerCase();
  return (
    rpcUrl.includes("localhost") ||
    rpcUrl.includes("127.0.0.1") ||
    rpcUrl.includes("0.0.0.0") ||
    rpcUrl.includes("host.docker.internal")
  );
}

/**
 * Get chain ID from network config with fallback
 */
export function getChainId(network: SerializableNetworkConfig): string {
  return network.meta?.chainId || "0";
}

/**
 * Create a network config URL for a specific chain
 */
export function getChainUrl(network: SerializableNetworkConfig, chainId?: string): string {
  const chain = chainId ?? getChainId(network);
  const baseUrl = network.rpcUrl;

  // If URL already contains chain path, replace it
  const chainPattern = /\/chain\/\d+\//;
  if (chainPattern.test(baseUrl)) {
    return baseUrl.replace(chainPattern, `/chain/${chain}/`);
  }

  // Otherwise, build the full URL
  const urlParts = baseUrl.split("/");
  const pactIndex = urlParts.findIndex((part) => part === "pact");

  if (pactIndex > 0) {
    // Insert chain path before 'pact'
    urlParts.splice(pactIndex, 0, "chain", chain);
    return urlParts.join("/");
  }

  // Fallback: append chain path
  return `${baseUrl}/chain/${chain}/pact`;
}
