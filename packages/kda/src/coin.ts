import { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { execution, getWallet } from "@pact-toolbox/transaction";
import type { ChainId, PactKeyset, WalletLike } from "@pact-toolbox/types";
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
  /** Custom wallet for this operation */
  wallet?: WalletLike;
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
 * Options for safe transfer operations
 */
export interface SafeTransferOptions extends CoinOperationOptions {
  /** Source account */
  from: string;
  /** Source account public keys (needed for safe transfer) */
  fromPublicKeys: string[];
  /** Destination account */
  to: string;
  /** Destination account public keys (needed for safe transfer) */
  toPublicKeys: string[];
  /** Amount to transfer */
  amount: string;
}

/**
 * Options for transfer-all operations
 */
export interface TransferAllOptions extends CoinOperationOptions {
  /** Source account */
  from: string;
  /** Destination account */
  to: string;
  /** Guard for destination account if it doesn't exist */
  toGuard?: PactKeyset;
}

/**
 * Options for rotate operations
 */
export interface RotateOptions extends CoinOperationOptions {
  /** Account to rotate */
  account: string;
  /** New guard for the account */
  newGuard: PactKeyset;
}

/**
 * Options for discover account operations
 */
export interface DiscoverAccountOptions extends CoinOperationOptions {
  /** Public key to search for */
  publicKey: string;
  /** Chains to search (defaults to all chains 0-19) */
  chains?: ChainId[];
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

  constructor(networkProvider?: NetworkConfigProvider) {
    this.#networkProvider = networkProvider || NetworkConfigProvider.getInstance();
  }

  /**
   * Get the current network configuration
   */
  private getNetworkConfig() {
    return this.#networkProvider.getNetwork();
  }

  /**
   * Get account balance
   */
  async getBalance(account: string, options?: CoinOperationOptions): Promise<string> {
    const chainId = options?.chainId || "0";
    const result = await execution<any>(`(coin.get-balance "${account}")`, this.#networkProvider)
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
    const chainId = options?.chainId || "0";
    const result = await execution<any>(`(coin.details "${account}")`, this.#networkProvider)
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
    const { account, guard, sender, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || "0";
    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for create account operation");
    }

    // Determine sender account
    const senderAccount = sender || operationSigner.address;

    return execution<string>(`(coin.create-account "${account}" (read-keyset 'account-guard))`, this.#networkProvider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: senderAccount,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("account-guard", guard)
      .withSigner(operationSigner.publicKey, (withCapability) => [withCapability("coin.GAS")])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Transfer coins between existing accounts
   */
  async transfer(options: TransferOptions): Promise<string> {
    const { from, to, amount, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || "0";
    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for create account operation");
    }

    // Determine sender account
    const senderAccount = from || operationSigner.address;

    return execution<string>(`(coin.transfer "${from}" "${to}" ${amount})`, this.#networkProvider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: senderAccount,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER", from, to, { decimal: amount }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Transfer coins and create destination account if it doesn't exist
   */
  async transferCreate(options: TransferCreateOptions): Promise<string> {
    const { from, to, amount, toGuard, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || "0";
    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for create account operation");
    }

    // Determine sender account
    const senderAccount = from || operationSigner.address;
    return execution<string>(
      `(coin.transfer-create "${from}" "${to}" (read-keyset 'to-guard) ${amount})`,
      this.#networkProvider,
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: senderAccount,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("to-guard", toGuard)
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER", from, to, { decimal: amount }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Safe transfer - ensures receiver can accept funds
   * Performs a small test transfer first to verify receiver account
   */
  async safeTransfer(options: SafeTransferOptions): Promise<string> {
    const { from, fromPublicKeys, to, toPublicKeys, amount, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || "0";
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for safe transfer operation");
    }

    // Safe transfer sends a small amount back to verify receiver can sign
    const smallAmount = "0.0000001";
    const amountPlusSmall = (parseFloat(amount) + parseFloat(smallAmount)).toFixed(12);

    // Build the safe transfer as two transfers in one transaction
    const code = `
      (coin.transfer "${from}" "${to}" ${amountPlusSmall})
      (coin.transfer "${to}" "${from}" ${smallAmount})
    `;

    return execution<string>(code, this.#networkProvider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER", from, to, { decimal: amountPlusSmall }),
      ])
      .withSigner(toPublicKeys[0]!, (withCapability) => [
        withCapability("coin.TRANSFER", to, from, { decimal: smallAmount }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Transfer all balance from one account to another
   */
  async transferAll(options: TransferAllOptions): Promise<string> {
    const { from, to, toGuard, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || "0";
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for transfer-all operation");
    }

    // Get the balance first
    const balance = await this.getBalance(from, { chainId: resolvedChainId });

    // Calculate amount after gas (leave a small buffer for gas)
    const gasBuffer = "0.0001";
    const transferAmount = (parseFloat(balance) - parseFloat(gasBuffer)).toFixed(12);

    if (parseFloat(transferAmount) <= 0) {
      throw new Error("Insufficient balance to cover transfer and gas");
    }

    // Use transfer-create if toGuard is provided, otherwise normal transfer
    if (toGuard) {
      return this.transferCreate({
        from,
        to,
        amount: transferAmount,
        toGuard,
        chainId: resolvedChainId,
        gasLimit,
        gasPrice,
        ttl,
        wallet,
      });
    } else {
      return this.transfer({
        from,
        to,
        amount: transferAmount,
        chainId: resolvedChainId,
        gasLimit,
        gasPrice,
        ttl,
        wallet,
      });
    }
  }

  /**
   * Rotate account guard (change keys)
   */
  async rotate(options: RotateOptions): Promise<string> {
    const { account, newGuard, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || "0";
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for rotate operation");
    }

    return execution<string>(`(coin.rotate "${account}" (read-keyset 'new-guard))`, this.#networkProvider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: account,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("new-guard", newGuard)
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.ROTATE", account),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Discover accounts for a public key across chains
   */
  async discoverAccounts(options: DiscoverAccountOptions): Promise<{ chainId: ChainId; account: string; balance: string }[]> {
    const { publicKey, chains = Array.from({ length: 20 }, (_, i) => i.toString() as ChainId) } = options;
    const kAccount = `k:${publicKey}`;

    const promises = chains.map(async (chainId) => {
      try {
        const balance = await this.getBalance(kAccount, { chainId });
        if (parseFloat(balance) > 0) {
          return {
            chainId,
            account: kAccount,
            balance,
          };
        }
        return null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((result): result is { chainId: ChainId; account: string; balance: string } => result !== null);
  }

  /**
   * Cross-chain coin transfer
   */
  async transferCrosschain(options: CrosschainTransferOptions): Promise<string> {
    const { from, to, amount, targetChainId, toGuard, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || "0";

    const networkConfig = this.getNetworkConfig();

    // Get the signer for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for create account operation");
    }

    // Determine sender account
    const senderAccount = from || operationSigner.address;

    const code = toGuard
      ? `(coin.transfer-crosschain "${from}" "${to}" (read-keyset 'receiver-guard) "${targetChainId}" ${amount})`
      : `(coin.transfer-crosschain "${from}" "${to}" (at 'guard (coin.details "${to}")) "${targetChainId}" ${amount})`;

    const builder = execution<string>(code, this.#networkProvider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: senderAccount,
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("coin.TRANSFER_XCHAIN", from, to, { decimal: amount }, targetChainId),
      ]);

    if (toGuard) {
      builder.withKeyset("receiver-guard", toGuard);
    }

    return builder.sign(walletLike).submitAndListen();
  }
}

/**
 * Create a coin service instance with optional configuration
 */
export function createCoinContract(networkProvider?: NetworkConfigProvider): CoinContract {
  return new CoinContract(networkProvider);
}
