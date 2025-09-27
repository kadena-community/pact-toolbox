import { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { execution, getWallet } from "@pact-toolbox/transaction";
import type { ChainId, PactKeyset, WalletLike } from "@pact-toolbox/types";

/**
 * Configuration for the MarmaladeContract with DI
 */
export interface MarmaladeContractConfig {
  /** Network provider for network configuration */
  networkProvider?: NetworkConfigProvider;
  /** Default chain ID to use when not specified */
  defaultChainId?: ChainId;
  /** Default wallet for operations */
  defaultWallet?: WalletLike;
}

/**
 * Base options for marmalade operations
 */
export interface MarmaladeOperationOptions {
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
 * Token information
 */
export interface TokenInfo {
  /** Token ID */
  id: string;
  /** Token supply */
  supply: string;
  /** Token precision */
  precision: number;
  /** Token URI */
  uri: string;
  /** Associated policies */
  policies: string[];
}

/**
 * Token creation options
 */
export interface CreateTokenOptions extends MarmaladeOperationOptions {
  /** Token ID */
  id: string;
  /** Token precision */
  precision: number;
  /** Token URI (metadata) */
  uri: string;
  /** Token policies */
  policies: string[];
  /** Creator public key */
  creator?: string;
}

/**
 * Token minting options
 */
export interface MintTokenOptions extends MarmaladeOperationOptions {
  /** Token ID */
  tokenId: string;
  /** Destination account */
  account: string;
  /** Account guard */
  guard: PactKeyset;
  /** Amount to mint */
  amount: string;
}

/**
 * Token transfer options
 */
export interface TransferTokenOptions extends MarmaladeOperationOptions {
  /** Token ID */
  tokenId: string;
  /** Source account */
  from: string;
  /** Destination account */
  to: string;
  /** Amount to transfer */
  amount: string;
}

/**
 * Token transfer-create options
 */
export interface TransferCreateTokenOptions extends TransferTokenOptions {
  /** Guard for destination account if it doesn't exist */
  toGuard: PactKeyset;
}

/**
 * Token burning options
 */
export interface BurnTokenOptions extends MarmaladeOperationOptions {
  /** Token ID */
  tokenId: string;
  /** Account to burn from */
  account: string;
  /** Amount to burn */
  amount: string;
}

/**
 * Account balance query options
 */
export interface GetBalanceOptions extends MarmaladeOperationOptions {
  /** Token ID */
  tokenId: string;
  /** Account to query */
  account: string;
}

/**
 * Options for sale operations
 */
export interface OfferTokenOptions extends MarmaladeOperationOptions {
  /** Token ID */
  tokenId: string;
  /** Seller account */
  seller: string;
  /** Amount to sell */
  amount: string;
  /** Price per token */
  price: string;
  /** Timeout for the sale (in seconds) */
  timeout?: number;
}

/**
 * Options for buy operations
 */
export interface BuyTokenOptions extends MarmaladeOperationOptions {
  /** Sale ID or pact ID */
  saleId: string;
  /** Buyer account */
  buyer: string;
  /** Buyer guard */
  buyerGuard: PactKeyset;
  /** Amount to buy */
  amount: string;
}

/**
 * Options for withdraw operations
 */
export interface WithdrawTokenOptions extends MarmaladeOperationOptions {
  /** Sale ID */
  saleId: string;
  /** Seller account */
  seller: string;
}

/**
 * Service for Marmalade NFT operations on Kadena blockchain using DI
 * Supports both Marmalade v1 and v2
 */
export class MarmaladeContract {
  #networkProvider: NetworkConfigProvider;
  #defaultChainId: ChainId;
  #defaultWallet?: WalletLike;

  constructor(config?: MarmaladeContractConfig) {
    this.#networkProvider = config?.networkProvider || NetworkConfigProvider.getInstance();
    this.#defaultChainId = config?.defaultChainId ?? "0";
    this.#defaultWallet = config?.defaultWallet;
  }

  /**
   * Get the current network configuration
   */
  private getNetworkConfig() {
    return this.#networkProvider.getNetwork();
  }

  /**
   * Get marmalade version preference
   */
  private getMarmaladeModule(version: "v1" | "v2" = "v2"): string {
    return version === "v2" ? "marmalade-v2.ledger" : "marmalade.ledger";
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenId: string, options?: MarmaladeOperationOptions & { version?: "v1" | "v2" }): Promise<TokenInfo> {
    const chainId = options?.chainId || this.#defaultChainId;
    const module = this.getMarmaladeModule(options?.version);

    const result = await execution<any>(`(${module}.get-token-info "${tokenId}")`, this.#networkProvider)
      .withChainId(chainId)
      .build()
      .dirtyRead();

    // Handle Pact decimal object in supply
    if (result && typeof result.supply === "object" && "decimal" in result.supply) {
      result.supply = result.supply.decimal;
    }

    return result;
  }

  /**
   * Create a new token (v2 by default)
   */
  async createToken(options: CreateTokenOptions & { version?: "v1" | "v2" }): Promise<string> {
    const { id, precision, uri, policies, creator, chainId, gasLimit, gasPrice, ttl, wallet, version = "v2" } = options;
    const resolvedChainId = chainId || this.#defaultChainId;
    const networkConfig = this.getNetworkConfig();
    const module = this.getMarmaladeModule(version);

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet || this.#defaultWallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for create token operation");
    }

    // Get creator public key
    const creatorKey = creator || operationSigner.publicKey;

    const policyList = policies.map((p) => `"${p}"`).join(" ");

    // For v2, we need to handle creation guard differently
    const creationGuard = version === "v2"
      ? `(read-keyset 'creation-guard)`
      : `(read-keyset 'creator-guard)`;

    return execution<string>(
      `(${module}.create-token "${id}" ${precision} "${uri}" [${policyList}] ${creationGuard})`,
      this.#networkProvider,
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: operationSigner.address,
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset(version === "v2" ? "creation-guard" : "creator-guard", {
        keys: [creatorKey],
        pred: "keys-all",
      })
      .withSigner(creatorKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability(version === "v2" ? `${module}.CREATE-TOKEN` : `${module}.TOKEN`, id, {
          keys: [creatorKey],
          pred: "keys-all",
        }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Mint tokens (v2 by default)
   */
  async mint(options: MintTokenOptions & { version?: "v1" | "v2" }): Promise<string> {
    const { tokenId, account, guard, amount, chainId, gasLimit, gasPrice, ttl, wallet, version = "v2" } = options;
    const resolvedChainId = chainId || this.#defaultChainId;
    const networkConfig = this.getNetworkConfig();
    const module = this.getMarmaladeModule(version);

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet || this.#defaultWallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for mint operation");
    }

    return execution<string>(`(${module}.mint "${tokenId}" "${account}" (read-keyset 'account-guard) ${amount})`, this.#networkProvider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: operationSigner.address,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("account-guard", guard)
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability(`${module}.MINT`, tokenId, account, { decimal: amount }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Transfer tokens
   */
  async transfer(options: TransferTokenOptions): Promise<string> {
    const { tokenId, from, to, amount, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || this.#defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet || this.#defaultWallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error(`No signer available for transfer from account: ${from}`);
    }

    return execution<string>(`(marmalade-v2.ledger.transfer "${tokenId}" "${from}" "${to}" ${amount})`, this.#networkProvider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.TRANSFER", tokenId, from, to, { decimal: amount }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Transfer tokens and create destination account if needed
   */
  async transferCreate(options: TransferCreateTokenOptions): Promise<string> {
    const { tokenId, from, to, toGuard, amount, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || this.#defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet || this.#defaultWallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error(`No signer available for transfer-create from account: ${from}`);
    }

    return execution<string>(
      `(marmalade-v2.ledger.transfer-create "${tokenId}" "${from}" "${to}" (read-keyset 'to-guard) ${amount})`,
      this.#networkProvider,
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("to-guard", toGuard)
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.TRANSFER", tokenId, from, to, { decimal: amount }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Burn tokens
   */
  async burn(options: BurnTokenOptions): Promise<string> {
    const { tokenId, account, amount, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || this.#defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet || this.#defaultWallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error(`No signer available for burn from account: ${account}`);
    }

    return execution<string>(`(marmalade.ledger.burn "${tokenId}" "${account}" ${amount})`, this.#networkProvider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: account,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade.ledger.BURN", tokenId, account, { decimal: amount }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Get token balance for an account
   */
  async getBalance(options: GetBalanceOptions): Promise<string> {
    const { tokenId, account, chainId } = options;
    const resolvedChainId = chainId || this.#defaultChainId;

    const result = await execution<any>(`(marmalade.ledger.get-balance "${tokenId}" "${account}")`, this.#networkProvider)
      .withChainId(resolvedChainId)
      .build()
      .dirtyRead();

    // Handle Pact decimal object
    if (typeof result === "object" && result !== null && "decimal" in result) {
      return result.decimal;
    }

    return String(result);
  }

  /**
   * Get total supply of a token
   */
  async getTotalSupply(tokenId: string, options?: MarmaladeOperationOptions & { version?: "v1" | "v2" }): Promise<string> {
    const chainId = options?.chainId || this.#defaultChainId;
    const module = this.getMarmaladeModule(options?.version);

    const result = await execution<any>(`(${module}.total-supply "${tokenId}")`, this.#networkProvider)
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
   * Offer token for sale (v2)
   */
  async offerToken(options: OfferTokenOptions): Promise<string> {
    const { tokenId, seller, amount, timeout = 3600, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || this.#defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet || this.#defaultWallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for offer operation");
    }

    const expiry = Math.floor(Date.now() / 1000) + timeout;

    return execution<string>(
      `(marmalade-v2.ledger.sale "${tokenId}" "${seller}" ${amount} ${expiry})`,
      this.#networkProvider,
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: seller,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.OFFER", tokenId, seller, { decimal: amount }),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Buy token from sale (v2)
   */
  async buyToken(options: BuyTokenOptions): Promise<string> {
    const { saleId, buyer, buyerGuard, amount, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || this.#defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet || this.#defaultWallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for buy operation");
    }

    return execution<string>(
      `(marmalade-v2.ledger.buy "${saleId}" "${buyer}" (read-keyset 'buyer-guard) ${amount})`,
      this.#networkProvider,
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: buyer,
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("buyer-guard", buyerGuard)
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.BUY", saleId),
      ])
      .sign(walletLike)
      .submitAndListen();
  }

  /**
   * Withdraw token from sale (v2)
   */
  async withdrawToken(options: WithdrawTokenOptions): Promise<string> {
    const { saleId, seller, chainId, gasLimit, gasPrice, ttl, wallet } = options;
    const resolvedChainId = chainId || this.#defaultChainId;
    const networkConfig = this.getNetworkConfig();

    // Get the wallet for this operation
    const walletLike = await getWallet(wallet || this.#defaultWallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for withdraw operation");
    }

    return execution<string>(
      `(marmalade-v2.ledger.withdraw "${saleId}")`,
      this.#networkProvider,
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: seller,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(operationSigner.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.WITHDRAW", saleId),
      ])
      .sign(walletLike)
      .submitAndListen();
  }
}

/**
 * Create a marmalade service instance with optional configuration
 */
export function createMarmaladeContract(networkProvider?: NetworkConfigProvider): MarmaladeContract {
  return new MarmaladeContract({ networkProvider });
}
