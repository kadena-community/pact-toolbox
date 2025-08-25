import type { ConnectOptions, Wallet, WalletMetadata, WalletProvider } from "@pact-toolbox/types";

/**
 * Base class for wallet providers with auto-registration support
 */
export abstract class BaseWalletProvider implements WalletProvider {
  // Static properties for auto-registration
  static id: string;
  static autoRegister = false;
  static priority = 0;

  abstract metadata: WalletMetadata;
  abstract isAvailable(): Promise<boolean>;
  abstract createWallet(options?: ConnectOptions): Promise<Wallet>;

  /**
   * Optional configuration method for providers that need it
   */
  configure?(config: any): Promise<void> | void;

  /**
   * Helper method for graceful availability checks
   */
  protected async safeIsAvailable(check: () => Promise<boolean>): Promise<boolean> {
    try {
      return await check();
    } catch {
      return false;
    }
  }
}
