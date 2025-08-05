export { ChainweaverWalletProvider } from "./provider";
export { ChainweaverWallet } from "./wallet";
export type { ChainweaverConnectionOptions } from "./types";

// Auto-register the provider
import { WalletRegistry } from "../../wallet-registry";
import { ChainweaverWalletProvider } from "./provider";

WalletRegistry.registerClass(ChainweaverWalletProvider);
