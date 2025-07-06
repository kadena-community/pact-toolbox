import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import { logger } from "@pact-toolbox/node-utils";
import type { PactTransactionBuilder } from "@pact-toolbox/transaction";
import { Container } from "@pact-toolbox/utils";
import type {
  ChainId,
  KeyPair,
  PactCmdPayload,
  PactExecPayload,
  PactKeyset,
  PactSignerLike,
  PactTransactionDescriptor,
  Serializable,
  SerializableNetworkConfig,
  INetworkProvider,
  IChainwebClient,
  TOKENS,
} from "@pact-toolbox/types";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "pathe";

import {
  defaultConfig,
  defaultMeta,
  getSerializableMultiNetworkConfig,
  isPactServerNetworkConfig,
} from "@pact-toolbox/config";
import { execution, getKAccountKey } from "@pact-toolbox/transaction";
import { GlobalNetworkConfigProvider } from "@pact-toolbox/network-config";
import { ChainwebClient } from "@pact-toolbox/chainweb-client";

import type { Wallet } from "@pact-toolbox/wallet-core";
import { getSignerFromEnvVars, isKeyPair } from "./utils";
import { KeypairWallet } from "@pact-toolbox/wallet-adapters/keypair";

/**
 * Data structure for configuring transaction builder operations.
 * Used to provide common transaction data in a structured format.
 */
export interface TransactionBuilderData {
  /** The account that will pay for gas fees */
  senderAccount?: string;
  /** The chain ID where the transaction will be executed */
  chainId?: ChainId;
  /** Whether to initialize the contract (default: true) */
  init?: boolean;
  /** The namespace for the contract deployment */
  namespace?: string;
  /** Map of keyset names to their configurations */
  keysets?: Record<string, PactKeyset>;
  /** Additional data to include in the transaction */
  data?: Record<string, Serializable>;
  /** Whether this is an upgrade operation (default: false) */
  upgrade?: boolean;
}

/**
 * Options for deploying contracts to the blockchain.
 * Provides control over transaction execution and signing behavior.
 */
export interface DeployContractOptions {
  /** Whether to perform preflight validation before submission (default: true) */
  preflight?: boolean;
  /** Whether to wait for transaction confirmation (default: true) */
  listen?: boolean;
  /** Skip signing the transaction (useful for unsigned transactions) */
  skipSign?: boolean;
  /** Wallet or signer configuration for transaction signing */
  wallet?: Wallet | PactSignerLike | KeyPair | string;
  /**
   * Custom transaction builder configuration.
   * Can be either static data or a function that modifies the transaction builder.
   */
  builder?:
    | TransactionBuilderData
    | (<T extends PactCmdPayload>(
        tx: PactTransactionBuilder<T>,
      ) => PactTransactionBuilder<T> | Promise<PactTransactionBuilder<T>>);
}

/**
 * Options for local execution of Pact code.
 * Used for testing and validation without blockchain submission.
 */
export interface LocalOptions {
  /** Whether to perform preflight checks */
  preflight?: boolean;
  /** Whether to verify signatures during local execution */
  signatureVerification?: boolean;
}

/**
 * Main client class for interacting with Pact smart contracts on Kadena blockchain.
 * Uses dependency injection for better modularity and testability.
 *
 * @example
 * ```typescript
 * const container = new Container();
 * const client = new PactToolboxClient(container, {
 *   defaultNetwork: 'devnet',
 *   networks: {
 *     devnet: {
 *       type: 'chainweb-devnet',
 *       name: 'local-devnet',
 *       networkId: 'devnet',
 *       rpcUrl: 'http://localhost:8080'
 *     }
 *   }
 * });
 * ```
 */
export class PactToolboxClient {
  private networkProvider: INetworkProvider;
  private chainwebClient: IChainwebClient;

  /**
   * Creates a new PactToolboxClient instance.
   * @param container - The DI container instance
   * @param config - The configuration object for the client
   * @param network - Optional network name to use (overrides defaultNetwork in config)
   */
  constructor(
    private container: Container,
    private config: PactToolboxConfigObj = defaultConfig,
    private network?: string,
  ) {
    // Initialize network configuration
    const multiNetworkConfig = getSerializableMultiNetworkConfig(config, { isDev: true, defaultNetwork: network });
    
    // Register services in the container if not already registered
    if (!container.has(TOKENS.NetworkProvider)) {
      const networkProvider = new GlobalNetworkConfigProvider({
        networks: multiNetworkConfig,
        currentNetworkId: network || multiNetworkConfig.default,
      });
      container.register(TOKENS.NetworkProvider, networkProvider);
    }
    
    if (!container.has(TOKENS.ChainwebClient)) {
      const currentNetwork = multiNetworkConfig.configs[network || multiNetworkConfig.default];
      const chainwebClient = new ChainwebClient({
        networkId: currentNetwork.networkId,
        chainId: currentNetwork.meta.chainId,
        rpcUrl: (networkId: string, chainId: string) =>
          currentNetwork.rpcUrl.replace("{networkId}", networkId).replace("{chainId}", chainId),
      });
      container.register(TOKENS.ChainwebClient, chainwebClient);
    }
    
    // Resolve services from container
    this.networkProvider = container.resolve(TOKENS.NetworkProvider);
    this.chainwebClient = container.resolve(TOKENS.ChainwebClient);
  }

  /**
   * Updates the client configuration at runtime.
   * Useful for switching between different environments or configurations.
   * @param config - The new configuration object
   */
  setConfig(config: PactToolboxConfigObj): void {
    this.config = config;
    const multiNetworkConfig = getSerializableMultiNetworkConfig(config, { isDev: true, defaultNetwork: this.network });
    
    // Update network provider with new configuration
    const networkProvider = new GlobalNetworkConfigProvider({
      networks: multiNetworkConfig,
      currentNetworkId: this.network || multiNetworkConfig.default,
    });
    this.container.register(TOKENS.NetworkProvider, networkProvider, { override: true });
    this.networkProvider = networkProvider;
    
    // Update chainweb client
    const currentNetwork = multiNetworkConfig.configs[this.network || multiNetworkConfig.default];
    const chainwebClient = new ChainwebClient({
      networkId: currentNetwork.networkId,
      chainId: currentNetwork.meta.chainId,
      rpcUrl: (networkId: string, chainId: string) =>
        currentNetwork.rpcUrl.replace("{networkId}", networkId).replace("{chainId}", chainId),
    });
    this.container.register(TOKENS.ChainwebClient, chainwebClient, { override: true });
    this.chainwebClient = chainwebClient;
  }

  /**
   * Gets the DI container for accessing registered services.
   * @returns The container instance
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Gets the current network configuration.
   * @returns The active network configuration
   */
  getNetworkConfig(): SerializableNetworkConfig {
    return this.networkProvider.getCurrentNetwork();
  }

  /**
   * Switches to a different network configuration.
   * @param networkId - The ID of the network to switch to
   */
  switchNetwork(networkId: string): void {
    this.networkProvider.setCurrentNetwork(networkId);
    
    // Update chainweb client with new network
    const currentNetwork = this.networkProvider.getCurrentNetwork();
    const chainwebClient = new ChainwebClient({
      networkId: currentNetwork.networkId,
      chainId: currentNetwork.meta.chainId,
      rpcUrl: (networkId: string, chainId: string) =>
        currentNetwork.rpcUrl.replace("{networkId}", networkId).replace("{chainId}", chainId),
    });
    this.container.register(TOKENS.ChainwebClient, chainwebClient, { override: true });
    this.chainwebClient = chainwebClient;
  }

  /**
   * Creates a transaction builder for executing Pact code.
   * This is the primary interface for building and executing transactions.
   *
   * @param pactCode - The Pact code to execute
   * @returns A transaction builder instance for fluent API usage
   *
   * @example
   * ```typescript
   * const result = await client.execution('(+ 1 2)').build().dirtyRead();
   * console.log(result); // 3
   * ```
   */
  execution(pactCode: string): PactTransactionBuilder<PactExecPayload> {
    return execution(pactCode);
  }

  /**
   * Deploys a Pact smart contract to the blockchain.
   * Handles contract loading, transaction building, signing, and submission.
   *
   * @param contractPath - Path to the Pact contract file
   * @param options - Deployment configuration options
   * @returns The transaction result descriptor
   *
   * @example
   * ```typescript
   * const result = await client.deploy('./contracts/hello.pact', {
   *   listen: true,
   *   builder: {
   *     senderAccount: 'k:abc123...',
   *     chainId: '0',
   *     keysets: {
   *       'hello-admin': {
   *         keys: ['abc123...'],
   *         pred: 'keys-all'
   *       }
   *     }
   *   }
   * });
   * ```
   */
  async deploy(
    contractPath: string,
    options: DeployContractOptions = {},
  ): Promise<PactTransactionDescriptor> {
    const networkConfig = this.getNetworkConfig();
    const pactCode = await this.loadContractFile(contractPath);

    const mainConfig = this.config.networks?.[this.network || this.config.defaultNetwork];
    if (!mainConfig) {
      throw new Error(`Network ${this.network || this.config.defaultNetwork} not found in configuration`);
    }

    const keyPairs = (mainConfig as NetworkConfig).keyPairs;
    const keysets = (mainConfig as NetworkConfig).keysets;

    const builderOptions = options.builder || {};
    const builderData = typeof builderOptions === "function" ? {} : builderOptions;

    const defaultSenderAccount = builderData.senderAccount || (mainConfig as NetworkConfig).senderAccount;

    let tx = this.execution(pactCode).withChainId(builderData.chainId || defaultMeta.chainId);

    // Handle wallet/signer configuration
    let wallet: Wallet | undefined;
    let signer: PactSignerLike | undefined;

    if (options.wallet) {
      if (typeof options.wallet === "string") {
        const keyPair = keyPairs?.find((kp: KeyPair) => kp.account === options.wallet);
        if (!keyPair) {
          throw new Error(`Signer ${options.wallet} not found in config`);
        }
        signer = keyPair;
        wallet = new KeypairWallet([keyPair]);
      } else if (isKeyPair(options.wallet)) {
        signer = options.wallet;
        wallet = new KeypairWallet([options.wallet]);
      } else if ("sign" in options.wallet) {
        wallet = options.wallet;
      } else {
        signer = options.wallet as PactSignerLike;
      }
    } else {
      // Try to get signer from environment or config
      signer = getSignerFromEnvVars() || keyPairs?.[0];
      if (signer && isKeyPair(signer)) {
        wallet = new KeypairWallet([signer]);
      }
    }

    // Apply meta configuration
    const usedAccount = builderData.senderAccount || signer?.account || defaultSenderAccount || "sender00";
    const meta = (mainConfig as NetworkConfig).meta;
    tx = tx.withMeta({
      gasLimit: meta.gasLimit || defaultMeta.gasLimit,
      gasPrice: meta.gasPrice || defaultMeta.gasPrice,
      ttl: meta.ttl || defaultMeta.ttl,
      sender: usedAccount,
    });

    // Apply keysets from builder data
    if (builderData.keysets) {
      tx = tx.withKeysets(builderData.keysets);
    } else if (keysets && !options.skipSign) {
      // Apply keysets from config if not overridden
      tx = tx.withKeysets(keysets);
    }

    // Apply additional data
    if (builderData.data) {
      tx = tx.withDataMap(builderData.data);
    }

    // Apply custom builder function if provided
    if (typeof builderOptions === "function") {
      tx = await builderOptions(tx);
    }

    // Add signer if available
    if (signer && !options.skipSign) {
      tx = tx.withSigner(signer.publicKey, (signFor) => [signFor("coin.GAS")]);
    }

    // Sign transaction if wallet is available
    if (wallet && !options.skipSign) {
      tx = tx.sign(wallet);
    }

    // Build and send transaction
    const descriptor = await tx.build().send();
    logger.info(`Transaction sent: ${descriptor.requestKey}`);

    // Listen for result if requested
    if (options.listen) {
      logger.info("Waiting for transaction confirmation...");
      const result = await descriptor.listen();
      if (result.result === "failure") {
        throw new Error(`Transaction failed: ${JSON.stringify(result.error)}`);
      }
      logger.success("Transaction confirmed successfully");
    }

    return descriptor;
  }

  /**
   * Executes Pact code locally without submitting to the blockchain.
   * Useful for testing, validation, and read-only operations.
   *
   * @param pactCode - The Pact code to execute locally
   * @param options - Local execution options
   * @returns The execution result
   *
   * @example
   * ```typescript
   * const result = await client.dirtyRead('(coin.get-balance "k:abc123...")');
   * console.log(result); // { balance: 100.0 }
   * ```
   */
  async dirtyRead(pactCode: string, options: LocalOptions = {}): Promise<any> {
    const descriptor = await this.execution(pactCode).build().dirtyRead();
    return descriptor;
  }

  /**
   * Loads a contract file from the filesystem.
   * Supports both absolute and relative paths.
   *
   * @param contractPath - Path to the contract file
   * @returns The contract source code
   * @throws Error if the file cannot be read
   */
  private async loadContractFile(contractPath: string): Promise<string> {
    const resolvedPath = isAbsolute(contractPath) ? contractPath : resolve(process.cwd(), contractPath);

    try {
      const stats = await stat(resolvedPath);
      if (!stats.isFile()) {
        throw new Error(`Path ${resolvedPath} is not a file`);
      }
    } catch (error) {
      throw new Error(`Contract file not found: ${resolvedPath}`);
    }

    return readFile(resolvedPath, "utf-8");
  }

  /**
   * Gets the Chainweb API client for direct blockchain interactions.
   * @returns The chainweb client instance
   */
  getChainwebClient(): IChainwebClient {
    return this.chainwebClient;
  }

  /**
   * Gets the network provider for network configuration management.
   * @returns The network provider instance
   */
  getNetworkProvider(): INetworkProvider {
    return this.networkProvider;
  }
}

/**
 * Creates a new PactToolboxClient instance with a fresh container.
 * This is a convenience function for simple use cases.
 *
 * @param config - The configuration object
 * @param network - Optional network name
 * @returns A configured client instance
 */
export function createClient(
  config: PactToolboxConfigObj = defaultConfig,
  network?: string,
): PactToolboxClient {
  const container = new Container();
  return new PactToolboxClient(container, config, network);
}