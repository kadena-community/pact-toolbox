// Core SolidJS components
export { WalletSelector } from "./components/wallet-selector";
export { WalletConnectButton } from "./components/wallet-connect-button";
export { NetworkSelector } from "./components/network-selector";
export * from "./wallet-ui-manager";

// Initialize global styles from ui-shared
import { initializeGlobalStyles } from "@pact-toolbox/ui-shared";

// Auto-initialize global styles if in browser environment
if (typeof window !== "undefined") {
  initializeGlobalStyles();
}
