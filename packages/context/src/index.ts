// Export types
export * from "./types";

// Export event system
export { eventBus, emit, on, off, createEventListener } from "./events";

// Export store
export { PactToolboxStore, getStore, resetStore } from "./store";

// Export configuration helpers
export { createConfig, mergeConfigs, createConfigWithGlobal, getGlobalConfig } from "./config";

// Export convenience hooks for vanilla JS
export { usePactToolbox, getPactToolboxState, getPactToolboxActions } from "./use-context";

// Export React provider and hooks
export {
  PactToolboxProvider,
  usePactToolboxContext,
  useNetwork,
  useWallet,
  useClient,
  useWalletModal,
  usePactToolboxEvent,
  walletPresets,
  type PactToolboxProviderProps,
  type PactToolboxContextConfig,
} from "./react";

// Export non-React initialization
export {
  initializePactToolbox,
  getPactToolbox,
  resetPactToolbox,
  type PactToolboxInitOptions,
  type PactToolboxInstance,
} from "./initialize";
