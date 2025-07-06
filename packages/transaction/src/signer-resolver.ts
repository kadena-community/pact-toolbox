import type { 
  ISigner, 
  ISignerResolver,
  IWalletManager,
  Wallet,
  KeyPair
} from "@pact-toolbox/types";
import { createKeypairSigner } from "./signer";

/**
 * Basic signer implementation that wraps a wallet
 */
class WalletSigner implements ISigner {
  constructor(private readonly wallet: Wallet) {}

  async sign(transaction: any, options?: any): Promise<any> {
    return this.wallet.sign(transaction, options);
  }

  getKeys(): string[] {
    return this.wallet.keys;
  }
}

/**
 * Default signer resolver implementation
 */
export class SignerResolver implements ISignerResolver {
  private defaultSigner: ISigner | null = null;

  constructor(
    private readonly walletManager?: IWalletManager
  ) {}

  getDefaultSigner(): ISigner | null {
    // First check if a default signer was explicitly set
    if (this.defaultSigner) {
      return this.defaultSigner;
    }

    // If we have a wallet manager, try to get signer from current wallet
    if (this.walletManager) {
      const wallet = this.walletManager.getCurrentWallet();
      if (wallet) {
        return new WalletSigner(wallet);
      }
    }

    return null;
  }

  getSignerKeys(account?: string): string[] {
    const signer = this.getDefaultSigner();
    if (!signer) {
      return [];
    }

    return signer.getKeys();
  }

  createSigner(keypairs: KeyPair[]): ISigner {
    return createKeypairSigner(keypairs);
  }

  /**
   * Set an explicit default signer
   */
  setDefaultSigner(signer: ISigner | null): void {
    this.defaultSigner = signer;
  }

  /**
   * Clear the default signer
   */
  clearDefaultSigner(): void {
    this.defaultSigner = null;
  }
}

/**
 * Create a signer resolver with optional dependencies
 */
export function createSignerResolver(
  walletManager?: IWalletManager
): ISignerResolver {
  return new SignerResolver(walletManager);
}