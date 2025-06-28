// Core components
export { PactWalletModal } from "./components/wallet-modal";
export { PactWalletSelector } from "./components/wallet-selector";
export { PactWalletConnect } from "./components/wallet-connect-button";
export { ModalManager } from "./modal-manager";

// Define all components for web components registration
export async function defineWalletComponents() {
  // Components will auto-register via @customElement decorator
  // This function ensures they are loaded
  const promises = [
    import("./components/wallet-modal"),
    import("./components/wallet-selector"),
    import("./components/wallet-connect-button"),
  ];

  return Promise.all(promises);
}

// Auto-register if in browser environment
if (typeof window !== "undefined" && typeof window.customElements !== "undefined") {
  defineWalletComponents();
}
