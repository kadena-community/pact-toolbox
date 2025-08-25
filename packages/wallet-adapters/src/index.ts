// Core types and interfaces from types package
export type {
  AutoConnectOptions,
  ConnectOptions,
  Wallet,
  WalletAccount,
  WalletErrorType,
  WalletEvents,
  WalletMetadata,
  WalletNetwork,
  WalletProvider,
} from "@pact-toolbox/types";

// Implementation classes from wallet-core
export { WalletError, BaseWallet, detectBrowserExtension } from "@pact-toolbox/wallet-core";

export * from "./wallet-manager";
export * from "./react";
export * from "./persistence";
export * from "./environment";
export * from "./config";
