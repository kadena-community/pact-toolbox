import { execution, type ToolboxNetworkContext } from "@pact-toolbox/transaction";
import type { PactKeyset, ChainId, PactValue } from "@pact-toolbox/types";
import type { Wallet } from "@pact-toolbox/wallet-core";

/**
 * Configuration for the MarmaladeService
 */
export interface MarmaladeServiceConfig {
  /** Network context for blockchain operations */
  context: ToolboxNetworkContext;
  /** Default chain ID to use when not specified */
  defaultChainId?: ChainId;
  /** Wallet for signing transactions */
  wallet?: Wallet;
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
 * Token sale options
 */
export interface CreateSaleOptions extends MarmaladeOperationOptions {
  /** Token ID */
  tokenId: string;
  /** Seller account */
  seller: string;
  /** Sale price */
  price: string;
  /** Sale timeout in seconds */
  timeout: number;
}

/**
 * Token purchase options
 */
export interface BuyTokenOptions extends MarmaladeOperationOptions {
  /** Token ID */
  tokenId: string;
  /** Buyer account */
  buyer: string;
  /** Amount to buy */
  amount: string;
}

/**
 * Policy information
 */
export interface PolicyInfo {
  /** Policy name */
  name: string;
  /** Implemented interfaces */
  implements: string[];
}

/**
 * Account details for a token
 */
export interface TokenAccountInfo {
  /** Account balance for this token */
  balance: string;
  /** Account guard */
  guard: PactValue;
}

/**
 * Service for Marmalade NFT operations on Kadena blockchain
 *
 * This service provides a high-level interface for Marmalade token operations
 * including creation, minting, transfers, and sales. It uses the configured
 * chainweb client and wallet for all operations.
 */
export class MarmaladeService {
  private readonly config: MarmaladeServiceConfig;

  constructor(config: MarmaladeServiceConfig) {
    this.config = config;
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenId: string, options?: MarmaladeOperationOptions): Promise<TokenInfo> {
    const chainId = options?.chainId || this.config.defaultChainId || "0";

    return execution<TokenInfo>(`(marmalade-v2.ledger.get-token-info "${tokenId}")`)
      .withChainId(chainId)
      .withContext(this.config.context)
      .build()
      .dirtyRead();
  }

  /**
   * Get token balance for an account
   */
  async getBalance(tokenId: string, account: string, options?: MarmaladeOperationOptions): Promise<string> {
    const chainId = options?.chainId || this.config.defaultChainId || "0";

    return execution<string>(`(marmalade-v2.ledger.get-balance "${tokenId}" "${account}")`)
      .withChainId(chainId)
      .withContext(this.config.context)
      .build()
      .dirtyRead();
  }

  /**
   * Check if token exists
   */
  async tokenExists(tokenId: string, options?: MarmaladeOperationOptions): Promise<boolean> {
    try {
      await this.getTokenInfo(tokenId, options);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new token
   */
  async createToken(options: CreateTokenOptions): Promise<string> {
    const { id, precision, uri, policies, creator, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    const policiesCode = policies.length > 0 ? `[${policies.map((p) => `"${p}"`).join(" ")}]` : "[]";

    // Get the default signer if creator not provided
    const signer = creator || this.config.context.getDefaultSigner()?.address || "sender00";
    const signerKeys = this.config.context.getSignerKeys(signer);

    return execution(
      `(marmalade-v2.ledger.create-token "${id}" ${precision} "${uri}" ${policiesCode} (read-keyset 'creation-guard))`,
    )
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: signer,
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("creation-guard", {
        keys: [signerKeys.publicKey],
        pred: "keys-all",
      })
      .withSigner(signerKeys.publicKey, (withCapability) => [withCapability("coin.GAS")])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Mint tokens to an account
   */
  async mintToken(options: MintTokenOptions): Promise<string> {
    const { tokenId, account, guard, amount, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the default signer (usually the token creator or admin)
    const defaultSigner = this.config.context.getDefaultSigner();
    if (!defaultSigner) {
      throw new Error("No default signer configured for minting");
    }

    return execution(`(marmalade-v2.ledger.mint "${tokenId}" "${account}" (read-keyset 'guard) ${amount})`)
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: defaultSigner.address,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("guard", guard)
      .withSigner(defaultSigner.pubKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.MINT", tokenId, account, { decimal: amount }),
      ])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Transfer tokens between accounts
   */
  async transferToken(options: TransferTokenOptions): Promise<string> {
    const { tokenId, from, to, amount, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the public key for the sender
    const signerKeys = this.config.context.getSignerKeys(from);

    return execution(`(marmalade-v2.ledger.transfer "${tokenId}" "${from}" "${to}" ${amount})`)
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.TRANSFER", tokenId, from, to, { decimal: amount }),
      ])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Transfer tokens and create destination account if needed
   */
  async transferCreateToken(options: TransferCreateTokenOptions): Promise<string> {
    const { tokenId, from, to, amount, toGuard, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the public key for the sender
    const signerKeys = this.config.context.getSignerKeys(from);

    return execution(
      `(marmalade-v2.ledger.transfer-create "${tokenId}" "${from}" "${to}" (read-keyset 'receiver-guard) ${amount})`,
    )
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("receiver-guard", toGuard)
      .withSigner(signerKeys.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.TRANSFER", tokenId, from, to, { decimal: amount }),
      ])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Burn tokens from an account
   */
  async burnToken(options: BurnTokenOptions): Promise<string> {
    const { tokenId, account, amount, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the public key for the account
    const signerKeys = this.config.context.getSignerKeys(account);

    return execution(`(marmalade-v2.ledger.burn "${tokenId}" "${account}" ${amount})`)
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: account,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.BURN", tokenId, account, { decimal: amount }),
      ])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Create a token sale
   */
  async createSale(options: CreateSaleOptions): Promise<string> {
    const { tokenId, seller, price, timeout, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the public key for the seller
    const signerKeys = this.config.context.getSignerKeys(seller);

    return execution(`(marmalade-v2.sale.sale "${tokenId}" "${seller}" 1.0 ${timeout})`)
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: seller,
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.ledger.TRANSFER", tokenId, seller, "marmalade-v2.sale", { decimal: "1.0" }),
        withCapability("marmalade-v2.sale.SELL", tokenId, seller, { decimal: "1.0" }, timeout),
      ])
      .withData("price", { decimal: price })
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Buy a token from sale
   */
  async buyToken(options: BuyTokenOptions): Promise<string> {
    const { tokenId, buyer, amount, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Get the public key for the buyer
    const signerKeys = this.config.context.getSignerKeys(buyer);

    return execution(
      `(marmalade-v2.sale.buy "${tokenId}" "${buyer}" (read-keyset 'buyer-guard) ${amount} (read-msg "price"))`,
    )
      .withChainId(resolvedChainId)
      .withContext(this.config.context)
      .withMeta({
        sender: buyer,
        gasLimit: gasLimit || 2500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("buyer-guard", {
        keys: [signerKeys.publicKey],
        pred: "keys-all",
      })
      .withSigner(signerKeys.publicKey, (withCapability) => [
        withCapability("coin.GAS"),
        withCapability("marmalade-v2.sale.BUY", tokenId, buyer, { decimal: amount }),
      ])
      .sign(this.config.wallet)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Get policy information
   */
  async getPolicyInfo(policyName: string, options?: MarmaladeOperationOptions): Promise<PolicyInfo> {
    const chainId = options?.chainId || this.config.defaultChainId || "0";

    return execution<PolicyInfo>(`(${policyName}.get-policy-info)`)
      .withChainId(chainId)
      .withContext(this.config.context)
      .build()
      .dirtyRead();
  }

  /**
   * List all tokens (requires indexing in practice)
   */
  async listTokens(options?: MarmaladeOperationOptions): Promise<string[]> {
    const chainId = options?.chainId || this.config.defaultChainId || "0";

    return execution<string[]>(`(keys marmalade-v2.ledger.tokens)`)
      .withChainId(chainId)
      .withContext(this.config.context)
      .build()
      .dirtyRead();
  }

  /**
   * Get account details for a token
   */
  async getAccountDetails(
    tokenId: string,
    account: string,
    options?: MarmaladeOperationOptions,
  ): Promise<TokenAccountInfo> {
    const chainId = options?.chainId || this.config.defaultChainId || "0";

    return execution<TokenAccountInfo>(`(marmalade-v2.ledger.details "${tokenId}" "${account}")`)
      .withChainId(chainId)
      .withContext(this.config.context)
      .build()
      .dirtyRead();
  }
}
