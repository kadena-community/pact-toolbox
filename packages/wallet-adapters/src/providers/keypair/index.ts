export { KeypairWalletProvider } from "./provider";
export { KeypairWallet } from "./wallet";
export type { KeypairWalletConfig } from "./wallet";

// Auto-register the provider
import { WalletRegistry } from "../../wallet-registry";
import { KeypairWalletProvider } from "./provider";

if (typeof window !== "undefined") {
  WalletRegistry.registerClass(KeypairWalletProvider);
}