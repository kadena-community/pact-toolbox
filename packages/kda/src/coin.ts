import { execution } from "@pact-toolbox/transaction";
import type { PactKeyset, ChainId, Wallet, PactSignerLike } from "@pact-toolbox/types";
import { NetworkConfigProvider } from "@pact-toolbox/network-config";
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
  /** Custom signer for this operation */
  signer?: PactSignerLike;
}

/**
 * Options for account creation
 */
export interface CreateAccountOptions extends CoinOperationOptions {
  /** Account name to create */
  account: string;
  /** Guard for the account */
  guard: PactKeyset;
  /** Sender account (defaults to using default signer) */
  sender?: string;
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
 * Service for coin operations on Kadena blockchain using DI
 *
 * This service provides a high-level interface for common coin operations
 * like transfers, account creation, and balance queries. It uses dependency
 * injection to resolve network configuration and signing services.
 */
export class CoinContract {
  #networkProvider: NetworkConfigProvider;
  #wallet?: Wallet;

  constructor(networkProvider?: NetworkConfigProvider) {
    this.#networkProvider = networkProvider || NetworkConfigProvider.getInstance();
  }

  /**
   * Get the current network configuration
   */
  private getNetworkConfig() {
    return this.#networkProvider.getCurrentNetwork();
  }

  /**
   * Get a signer for operations
   */
  private getSigner(options?: { signer?: ISigner | Wallet; account?: string }): ISigner | Wallet | null {
    // Priority: operation signer > default signer > resolver
    if (options?.signer) {
      return options.signer;
    }

    if (this.#wallet) {
      return this.#wallet;
    }

    return this.signerResolver.getDefaultSigner();
  }

  /**
   * Get signer keys for an account
   */
  private getSignerKeys(account: string): string[] {
    return this.signerResolver.getSignerKeys(account);
  }

  /**
   * Get account balance
   */
  async getBalance(account: string, options?: CoinOperationOptions): Promise<string> {
    const chainId = options?.chainId || this.defaultChainId;
    const result = await execution<any>(`(coin.get-balance "${account}")`, { networkProvider: this.#networkProvider })
      .withChainId(chainId)
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
    const chainId = options?.chainId || this.defaultChainId;
    const result = await execution<any>(`(coin.details "${account}")`, { networkProvider: this.#networkProvider })
      .withChainId(chainId)
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
    const { account, guard, sender, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer });
    if (!operationSigner) {
      throw new Error("No signer available for create account operation");
    }

    // Determine sender account
    const senderAccount = sender || "sender00"; // Default for gas station
    const signerKeys = this.getSignerKeys(senderAccount);

    if (signerKeys.length === 0) {
      throw new Error(`No signer keys found for account: ${senderAccount}`);
    }

    return execution(`(coin.create-account "${account}" (read-keyset 'account-guard))`, {
      networkProvider: this.#networkProvider,
    })
      .withChainId(resolvedChainId)
      .withMeta({
        sender: senderAccount,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("account-guard", guard)
      .withSigner(signerKeys[0] as string, (withCapability) => [withCapability("coin.GAS")])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Transfer coins between existing accounts
   */
  async transfer(options: TransferOptions): Promise<string> {
    const { from, to, amount, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;
    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer, account: from });
    if (!operationSigner) {
      throw new Error(`No signer available for transfer from account: ${from}`);
    }

    // Get the public key for the sender
    const signerKeys = this.getSignerKeys(from);
    if (signerKeys.length === 0) {
      throw new Error(`No signer keys found for account: ${from}`);
    }

    return execution(`(coin.transfer "${from}" "${to}" ${amount})`, { networkProvider: this.#networkProvider })
      .withChainId(resolvedChainId)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys[0] as string, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER", from, to, { decimal: amount }),
      ])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Transfer coins and create destination account if it doesn't exist
   */
  async transferCreate(options: TransferCreateOptions): Promise<string> {
    const { from, to, amount, toGuard, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer, account: from });
    if (!operationSigner) {
      throw new Error(`No signer available for transfer-create from account: ${from}`);
    }

    // Get the public key for the sender
    const signerKeys = this.getSignerKeys(from);
    if (signerKeys.length === 0) {
      throw new Error(`No signer keys found for account: ${from}`);
    }

    return execution(`(coin.transfer-create "${from}" "${to}" (read-keyset 'to-guard) ${amount})`, {
      networkProvider: this.#networkProvider,
    })
      .withChainId(resolvedChainId)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("to-guard", toGuard)
      .withSigner(signerKeys[0] as string, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER", from, to, { decimal: amount }),
      ])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Cross-chain coin transfer
   */
  async transferCrosschain(options: CrosschainTransferOptions): Promise<string> {
    const { from, to, amount, targetChainId, toGuard, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer, account: from });
    if (!operationSigner) {
      throw new Error(`No signer available for cross-chain transfer from account: ${from}`);
    }

    // Get the public key for the sender
    const signerKeys = this.getSignerKeys(from);
    if (signerKeys.length === 0) {
      throw new Error(`No signer keys found for account: ${from}`);
    }

    const code = toGuard
      ? `(coin.transfer-crosschain "${from}" "${to}" (read-keyset 'receiver-guard) "${targetChainId}" ${amount})`
      : `(coin.transfer-crosschain "${from}" "${to}" (at 'guard (coin.details "${to}")) "${targetChainId}" ${amount})`;

    const builder = execution(code, {
      networkProvider: this.#networkProvider,
    })
      .withChainId(resolvedChainId)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys[0] as string, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER_XCHAIN", from, to, { decimal: amount }, targetChainId),
      ]);

    if (toGuard) {
      builder.withKeyset("receiver-guard", toGuard);
    }

    return builder.sign(operationSigner).submitAndListen() as Promise<string>;
  }
}

/**
 * Create a coin service instance with optional configuration
 */
export function createCoinService(config?: CoinServiceConfig): CoinService {
  return new CoinService(config);
}
