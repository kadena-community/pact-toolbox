export { ZelcoreWallet } from "./wallet";
export { ZelcoreWalletProvider } from "./provider";
export type { 
  ZelcoreConnectionOptions,
  ZelcoreSignRequest,
  ZelcoreSignResponse,
  ZelcoreAccountsResponse,
  ZelcoreErrorResponse
} from "./types";

// Auto-register the provider
import { WalletRegistry } from "../../wallet-registry";
import { ZelcoreWalletProvider } from "./provider";

WalletRegistry.registerClass(ZelcoreWalletProvider);