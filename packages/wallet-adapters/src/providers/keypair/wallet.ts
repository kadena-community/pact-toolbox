import type { PactCommand, PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import { BaseWallet } from "@pact-toolbox/wallet-core";
import type { WalletAccount } from "@pact-toolbox/wallet-core";
import { WalletError } from "@pact-toolbox/wallet-core";
import {
  finalizeTransaction,
  KeyPairSigner,
} from "@pact-toolbox/signers";

/**
 * Configuration for KeypairWallet
 */
export interface KeypairWalletConfig {
  /** Network ID */
  networkId: string;
  /** Network name */
  networkName?: string;
  /** RPC URL */
  rpcUrl: string;
  /** Private key (hex string) - if not provided, generates new key */
  privateKey?: string;
  /** Account name override */
  accountName?: string;
  /** Chain ID */
  chainId?: string;
}

/**
 * Simplified Keypair wallet implementation
 */
export class KeypairWallet extends BaseWallet {
  private keyPairSigner: KeyPairSigner | null = null;
  private config: KeypairWalletConfig;

  constructor(config: KeypairWalletConfig) {
    super();
    this.config = {
      chainId: "0",
      ...config,
    };
  }

  /**
   * Get or create the keypair
   */
  private async getKeyPairSigner(): Promise<KeyPairSigner> {
    if (!this.keyPairSigner) {
      if (this.config.privateKey) {
        // Use provided private key
        this.keyPairSigner = await KeyPairSigner.fromPrivateKeyHex(this.config.privateKey);
      } else {
        this.keyPairSigner = await KeyPairSigner.generate();
      }
    }
    return this.keyPairSigner!;
  }

  isInstalled(): boolean {
    return true; // Always available
  }

  async connect(networkId?: string): Promise<WalletAccount> {
    const keyPairSigner = await this.getKeyPairSigner();
    const accountName = this.config.accountName || `k:${keyPairSigner.address}`;

    this.connected = true;
    this.account = {
      address: accountName,
      publicKey: keyPairSigner.address,
    };

    // Set up network info
    const networkId2 = networkId || this.config.networkId || "development";
    this.network = {
      id: networkId2,
      networkId: networkId2,
      name: this.config.networkName || networkId2,
      url: this.config.rpcUrl,
    };

    return this.account;
  }

  async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    txOrTxs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.connected || !this.keyPairSigner) {
      throw WalletError.notConnected("keypair");
    }
    const transactions = Array.isArray(txOrTxs) ? txOrTxs : [txOrTxs];
    try {
      const cmds = transactions.map((tx) => JSON.parse(tx.cmd) as PactCommand);
      const signed = await this.keyPairSigner.signPactCommands(cmds);
      return Array.isArray(txOrTxs) ? signed.map(finalizeTransaction) : finalizeTransaction(signed[0]!);
    } catch (error) {
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Create from private key
   */
  static fromPrivateKey(privateKey: string, config: Partial<KeypairWalletConfig> = {}): KeypairWallet {
    return new KeypairWallet({
      networkId: "development",
      rpcUrl: "http://localhost:8080",
      ...config,
      privateKey,
    });
  }

  /**
   * Create from seed
   */
  // static fromSeed(seed: string, config: Partial<KeypairWalletConfig> = {}): KeypairWallet {
  //   const privateKey = hash(seed); // Simple deterministic key generation
  //   return KeypairWallet.fromPrivateKey(privateKey, config);
  // }
}
