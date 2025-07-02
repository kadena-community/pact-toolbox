import { getStore } from "./store";
import type { PactToolboxContext, ContextConfig } from "./types";

// Vanilla JS hook for using the context
export function usePactToolbox(config?: ContextConfig): PactToolboxContext {
  const store = getStore(config);

  // Return a proxy that always returns current values
  return new Proxy({} as PactToolboxContext, {
    get(_, prop) {
      return (store as any)[prop];
    },
  });
}

// Helper to get current state without proxy
export function getPactToolboxState() {
  const store = getStore();
  return {
    network: store.network,
    networks: store.networks,
    wallet: store.wallet,
    wallets: store.wallets,
    isConnecting: store.isConnecting,
    client: store.client,
    isWalletModalOpen: store.isWalletModalOpen,
    environment: store.environment,
    isDevNet: store.isDevNet,
  };
}

// Helper to get actions
export function getPactToolboxActions() {
  const store = getStore();
  return {
    setNetwork: store.setNetwork.bind(store),
    connectWallet: store.connectWallet.bind(store),
    disconnectWallet: store.disconnectWallet.bind(store),
    setWallet: store.setWallet.bind(store),
    openWalletModal: store.openWalletModal.bind(store),
    closeWalletModal: store.closeWalletModal.bind(store),
    getClient: store.getClient.bind(store),
    updateConfig: store.updateConfig.bind(store),
  };
}
