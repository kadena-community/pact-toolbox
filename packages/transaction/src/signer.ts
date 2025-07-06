import { resolve } from "@pact-toolbox/utils";
import { TOKENS, type Wallet, type ISigner, type KeyPair } from "@pact-toolbox/types";
import { sign as cryptoSign } from "@pact-toolbox/crypto";

/**
 * Options for signing a transaction
 */
export interface SigningOptions {
  /**
   * Custom signer (wallet) to use
   */
  signer?: Wallet;

  /**
   * Whether to show UI for signer selection (handled by integration layer)
   */
  showUI?: boolean;

  /**
   * Any additional options for the signer
   */
  [key: string]: any;
}

/**
 * Get a signer using the DI container
 * 
 * @throws Error if no wallet provider is registered in the DI container
 */
export async function getSigner(options?: SigningOptions): Promise<Wallet> {
  if (options?.signer) {
    return options.signer;
  }

  try {
    const walletProvider = resolve(TOKENS.WalletProvider);
    return await walletProvider(options);
  } catch (error) {
    if (error instanceof Error && error.message.includes("WalletProvider not registered")) {
      throw new Error(
        "No wallet provider configured. Please set up the wallet system first:\n\n" +
        "import { setupWalletDI } from '@pact-toolbox/wallet-adapters';\n\n" +
        "await setupWalletDI({\n" +
        "  wallets: {\n" +
        "    chainweaver: true,\n" +
        "    walletconnect: { projectId: 'your-project-id' }\n" +
        "  }\n" +
        "});\n\n" +
        "Or provide a wallet directly: .sign({ signer: myWallet })"
      );
    }
    throw error;
  }
}

/**
 * Keypair-based signer implementation
 */
class KeypairSigner implements ISigner {
  constructor(private readonly keypairs: KeyPair[]) {}

  async sign(transaction: any, options?: any): Promise<any> {
    // Implementation would depend on transaction format
    // For now, we'll use the crypto sign function
    const signatures = [];
    for (const keypair of this.keypairs) {
      const signature = await cryptoSign(transaction, keypair);
      signatures.push(signature);
    }
    return signatures;
  }

  getKeys(): string[] {
    return this.keypairs.map(kp => kp.publicKey);
  }
}

/**
 * Create a signer from keypairs
 */
export function createKeypairSigner(keypairs: KeyPair[]): ISigner {
  return new KeypairSigner(keypairs);
}