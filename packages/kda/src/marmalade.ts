import { execution } from "@pact-toolbox/transaction";
import type {
  PactKeyset,
  ChainId,
  PactValue,
  INetworkProvider,
  ISignerResolver,
  ISigner,
  IChainwebClient,
  Wallet,
} from "@pact-toolbox/types";
import { resolve } from "@pact-toolbox/utils";
import { TOKENS } from "@pact-toolbox/types";

/**
 * Configuration for the MarmaladeService with DI
 */
export interface MarmaladeServiceConfig {
  /** Network provider for network configuration */
  networkProvider?: INetworkProvider;
  /** Signer resolver for signing operations */
  signerResolver?: ISignerResolver;
  /** Chainweb client for blockchain operations */
  chainwebClient?: IChainwebClient;
  /** Default chain ID to use when not specified */
  defaultChainId?: ChainId;
  /** Default wallet/signer for operations */
  defaultSigner?: ISigner | Wallet;
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
  /** Custom signer for this operation */
  signer?: ISigner | Wallet;
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
 * Service for Marmalade NFT operations on Kadena blockchain using DI
 */
export class MarmaladeService {
  private readonly networkProvider: INetworkProvider;
  private readonly signerResolver: ISignerResolver;
  private readonly chainwebClient: IChainwebClient;
  private readonly defaultChainId: ChainId;
  private readonly defaultSigner?: ISigner | Wallet;

  constructor(config?: MarmaladeServiceConfig) {
    // Resolve dependencies from DI container with fallbacks
    this.networkProvider = config?.networkProvider ?? resolve(TOKENS.NetworkProvider);
    this.signerResolver = config?.signerResolver ?? resolve(TOKENS.SignerResolver);
    this.chainwebClient = config?.chainwebClient ?? resolve(TOKENS.ChainwebClient);
    this.defaultChainId = config?.defaultChainId ?? "0";
    this.defaultSigner = config?.defaultSigner;
  }

  /**
   * Get a signer for operations
   */
  private getSigner(options?: { signer?: ISigner | Wallet; account?: string }): ISigner | Wallet | null {
    // Priority: operation signer > default signer > resolver
    if (options?.signer) {
      return options.signer;
    }

    if (this.defaultSigner) {
      return this.defaultSigner;
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
   * Get token information
   */
  async getTokenInfo(tokenId: string, options?: MarmaladeOperationOptions): Promise<TokenInfo> {
    const chainId = options?.chainId || this.defaultChainId;

    const result = await execution<any>(`(marmalade.ledger.get-token-info "${tokenId}")`, {
      networkProvider: this.networkProvider,
    })
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
   * Create a new token
   */
  async createToken(options: CreateTokenOptions): Promise<string> {
    const { id, precision, uri, policies, creator, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer });
    if (!operationSigner) {
      throw new Error("No signer available for create token operation");
    }

    // Get creator public key
    const creatorKey = creator || this.getSignerKeys("")[0];
    if (!creatorKey) {
      throw new Error("No creator key available");
    }

    const policyList = policies.map((p) => `"${p}"`).join(" ");

    return execution(
      `(marmalade.ledger.create-token "${id}" ${precision} "${uri}" [${policyList}] (read-keyset 'creator-guard))`,
      { networkProvider: this.networkProvider },
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: "sender00",
        gasLimit: gasLimit || 2000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("creator-guard", {
        keys: [creatorKey],
        pred: "keys-all",
      })
      .withSigner(creatorKey, (withCapability) => [withCapability("marmalade.ledger.TOKEN", id)])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Mint tokens
   */
  async mint(options: MintTokenOptions): Promise<string> {
    const { tokenId, account, guard, amount, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer });
    if (!operationSigner) {
      throw new Error("No signer available for mint operation");
    }

    const signerKeys = this.getSignerKeys("");
    if (signerKeys.length === 0) {
      throw new Error("No signer keys found");
    }

    return execution(`(marmalade.ledger.mint "${tokenId}" "${account}" (read-keyset 'account-guard) ${amount})`, {
      networkProvider: this.networkProvider,
    })
      .withChainId(resolvedChainId)
      .withMeta({
        sender: "sender00",
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("account-guard", guard)
      .withSigner(signerKeys[0] as string, (withCapability) => [
        withCapability("marmalade.ledger.MINT", tokenId, account, { decimal: amount }),
      ])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Transfer tokens
   */
  async transfer(options: TransferTokenOptions): Promise<string> {
    const { tokenId, from, to, amount, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer, account: from });
    if (!operationSigner) {
      throw new Error(`No signer available for transfer from account: ${from}`);
    }

    const signerKeys = this.getSignerKeys(from);
    if (signerKeys.length === 0) {
      throw new Error(`No signer keys found for account: ${from}`);
    }

    return execution(`(marmalade.ledger.transfer "${tokenId}" "${from}" "${to}" ${amount})`, {
      networkProvider: this.networkProvider,
    })
      .withChainId(resolvedChainId)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys[0] as string, (withCapability) => [
        withCapability("marmalade.ledger.TRANSFER", tokenId, from, to, { decimal: amount }),
      ])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Transfer tokens and create destination account if needed
   */
  async transferCreate(options: TransferCreateTokenOptions): Promise<string> {
    const { tokenId, from, to, toGuard, amount, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer, account: from });
    if (!operationSigner) {
      throw new Error(`No signer available for transfer-create from account: ${from}`);
    }

    const signerKeys = this.getSignerKeys(from);
    if (signerKeys.length === 0) {
      throw new Error(`No signer keys found for account: ${from}`);
    }

    return execution(
      `(marmalade.ledger.transfer-create "${tokenId}" "${from}" "${to}" (read-keyset 'to-guard)${amount})`,
      { networkProvider: this.networkProvider },
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: from,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("to-guard", toGuard)
      .withSigner(signerKeys[0] as string, (withCapability) => [
        withCapability("marmalade.ledger.TRANSFER", tokenId, from, to, { decimal: amount }),
      ])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Burn tokens
   */
  async burn(options: BurnTokenOptions): Promise<string> {
    const { tokenId, account, amount, chainId, gasLimit, gasPrice, ttl, signer } = options;
    const resolvedChainId = chainId || this.defaultChainId;

    // Get the signer for this operation
    const operationSigner = this.getSigner({ signer, account });
    if (!operationSigner) {
      throw new Error(`No signer available for burn from account: ${account}`);
    }

    const signerKeys = this.getSignerKeys(account);
    if (signerKeys.length === 0) {
      throw new Error(`No signer keys found for account: ${account}`);
    }

    return execution(`(marmalade.ledger.burn "${tokenId}" "${account}" ${amount})`, {
      networkProvider: this.networkProvider,
    })
      .withChainId(resolvedChainId)
      .withMeta({
        sender: account,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withSigner(signerKeys[0] as string, (withCapability) => [
        withCapability("marmalade.ledger.BURN", tokenId, account, { decimal: amount }),
      ])
      .sign(operationSigner)
      .submitAndListen() as Promise<string>;
  }

  /**
   * Get token balance for an account
   */
  async getBalance(options: GetBalanceOptions): Promise<string> {
    const { tokenId, account, chainId } = options;
    const resolvedChainId = chainId || this.defaultChainId;

    const result = await execution<any>(`(marmalade.ledger.get-balance "${tokenId}" "${account}")`, {
      networkProvider: this.networkProvider,
    })
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
  async getTotalSupply(tokenId: string, options?: MarmaladeOperationOptions): Promise<string> {
    const chainId = options?.chainId || this.defaultChainId;

    const result = await execution<any>(`(marmalade.ledger.total-supply "${tokenId}")`, {
      networkProvider: this.networkProvider,
    })
      .withChainId(chainId)
      .build()
      .dirtyRead();

    // Handle Pact decimal object
    if (typeof result === "object" && result !== null && "decimal" in result) {
      return result.decimal;
    }

    return String(result);
  }
}

/**
 * Create a marmalade service instance with optional configuration
 */
export function createMarmaladeService(config?: MarmaladeServiceConfig): MarmaladeService {
  return new MarmaladeService(config);
}
