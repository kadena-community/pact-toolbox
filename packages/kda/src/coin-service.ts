import { execution, type ToolboxNetworkContext } from "@pact-toolbox/transaction";
import type { PactKeyset, ChainId } from "@pact-toolbox/types";
import type { Wallet } from "@pact-toolbox/wallet-core";

/**
 * Configuration for the CoinService
 */
export interface CoinServiceConfig {
  /** Network context for blockchain operations */
  context: ToolboxNetworkContext;
  /** Default chain ID to use when not specified */
  defaultChainId?: ChainId;
  /** Wallet for signing transactions */
  wallet?: Wallet;
}

/**
 * Options for coin operations
 */
export interface CoinOperationOptions {
  /** Chain ID for this specific operation */
  chainId?: ChainId;
  /** Gas limit override */
  gasLimit?: number;
  /** Gas price override */
  gasPrice?: number;
  /** Time to live override */
  ttl?: number;
}

/**
 * Options for account creation
 */
export interface CreateAccountOptions extends CoinOperationOptions {
  /** Account name to create */
  account: string;
  /** Guard for the account */
  guard: PactKeyset;
}

/**
 * Options for coin transfers
 */
export interface TransferOptions extends CoinOperationOptions {
  /** Source account */
  from: string;
  /** Destination account */
  to: string;
  /** Amount to transfer */
  amount: string;
}

/**
 * Options for transfer-create operations
 */
export interface TransferCreateOptions extends TransferOptions {
  /** Guard for the destination account if it doesn't exist */
  toGuard: PactKeyset;
}

/**
 * Options for cross-chain transfers
 */
export interface CrosschainTransferOptions extends TransferCreateOptions {
  /** Target chain ID for cross-chain transfer */
  targetChainId: ChainId;
}

/**
 * Account information
 */
export interface AccountInfo {
  /** Account balance */
  balance: string;
  /** Account guard */
  guard: PactKeyset;
}

/**
 * Service for coin operations on Kadena blockchain
 *
 * This service provides a high-level interface for common coin operations
 * like transfers, account creation, and balance queries. It uses the configured
 * chainweb client and wallet for all operations.
 */
export class CoinService {
  private readonly config: CoinServiceConfig;

  constructor(config: CoinServiceConfig) {
    this.config = config;
  }

  /**
   * Get account balance
   */
  async getBalance(account: string, options?: CoinOperationOptions): Promise<string> {
    const chainId = options?.chainId || this.config.defaultChainId || "0";

    const result = await execution<any>(`(coin.get-balance "${account}")`)
      .withChainId(chainId)
      .withContext(this.config.context)
      .build()
      .dirtyRead();

    // Handle Pact decimal object
    if (typeof result === "object" && result !== null && "decimal" in result) {
      return result.decimal;
    }

    return String(result);
  }

  /**
   * Get account details (balance and guard)
   */
  async getAccountDetails(account: string, options?: CoinOperationOptions): Promise<AccountInfo> {
    const chainId = options?.chainId || this.config.defaultChainId || "0";

    const result = await execution<any>(`(coin.details "${account}")`)
      .withChainId(chainId)
      .withContext(this.config.context)
      .build()
      .dirtyRead();

    // Handle Pact decimal object in balance
    if (result && typeof result.balance === "object" && "decimal" in result.balance) {
      result.balance = result.balance.decimal;
    }

    return result;
  }

  /**
   * Check if account exists
   */
  async accountExists(account: string, options?: CoinOperationOptions): Promise<boolean> {
    try {
      await this.getAccountDetails(account, options);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new coin account
   */
  async createAccount(options: CreateAccountOptions): Promise<string> {
    const { account, guard, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the default signer (usually sender00 in tests)
    const defaultSigner = this.config.context.getDefaultSigner();
    if (!defaultSigner) {
      throw new Error("No default signer configured");
    }

    return execution(`(coin.create-account "${account}" (read-keyset 'account-guard))`)
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: defaultSigner.address,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("account-guard", guard)
      .withSigner(defaultSigner.pubKey, (withCapability) => [withCapability("coin.GAS")])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Transfer coins between existing accounts
   */
  async transfer(options: TransferOptions): Promise<string> {
    const { from, to, amount, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the public key for the sender
    const signerKeys = this.config.context.getSignerKeys(from);

    return execution(`(coin.transfer "${from}" "${to}" ${amount})`)
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER", from, to, { decimal: amount }),
      ])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Transfer coins and create destination account if it doesn't exist
   */
  async transferCreate(options: TransferCreateOptions): Promise<string> {
    const { from, to, amount, toGuard, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the public key for the sender
    const signerKeys = this.config.context.getSignerKeys(from);

    return execution(`(coin.transfer-create "${from}" "${to}" (read-keyset 'to-guard) ${amount})`)
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("to-guard", toGuard)
      .withSigner(signerKeys.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER", from, to, { decimal: amount }),
      ])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Cross-chain coin transfer
   */
  async transferCrosschain(options: CrosschainTransferOptions): Promise<string> {
    const { from, to, amount, targetChainId, toGuard, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the public key for the sender
    const signerKeys = this.config.context.getSignerKeys(from);

    const code = toGuard
      ? `(coin.transfer-crosschain "${from}" "${to}" (read-keyset 'receiver-guard) "${targetChainId}" ${amount})`
      : `(coin.transfer-crosschain "${from}" "${to}" (at 'guard (coin.details "${to}")) "${targetChainId}" ${amount})`;

    const builder = execution(code)
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER_XCHAIN", from, to, { decimal: amount }, targetChainId),
      ]);

    if (toGuard) {
      builder.withKeyset("receiver-guard", toGuard);
    }

    return builder.sign(this.config.wallet).submitAndListen() as Promise<string>;
  }

  /**
   * Smart transfer that uses transfer-create if destination account doesn't exist
   */
  async fund(options: TransferCreateOptions): Promise<string> {
    const exists = await this.accountExists(options.to, options);

    if (exists) {
      return this.transfer(options);
    } else {
      return this.transferCreate(options);
    }
  }
}
