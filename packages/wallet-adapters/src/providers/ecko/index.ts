export { EckoWalletProvider } from "./provider";
export { EckoWallet } from "./wallet";

// Auto-register the provider
import { WalletRegistry } from "../../wallet-registry";
import { EckoWalletProvider } from "./provider";

if (typeof window !== "undefined") {
  WalletRegistry.registerClass(EckoWalletProvider);
}
