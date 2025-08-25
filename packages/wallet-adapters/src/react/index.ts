export {
  WalletProvider,
  useWallet,
  usePrimaryWallet,
  useWalletConnection,
  useAvailableWallets,
  useWalletSign,
  type WalletContextValue,
  type WalletProviderProps,
} from "./provider";

// Note: The standalone hooks are available but the provider-based ones are recommended
// export * from "./hooks";