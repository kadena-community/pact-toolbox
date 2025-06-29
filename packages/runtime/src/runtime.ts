import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import { logger } from "@pact-toolbox/node-utils";
import type { PactTransactionBuilder, ToolboxNetworkContext } from "@pact-toolbox/transaction";
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
} from "@pact-toolbox/types";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "pathe";

import {
  defaultConfig,
  defaultMeta,
  getSerializableMultiNetworkConfig,
  isPactServerNetworkConfig,
} from "@pact-toolbox/config";
import { createToolboxNetworkContext, execution, getKAccountKey } from "@pact-toolbox/transaction";

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
 * Provides high-level APIs for contract deployment, transaction execution, and blockchain queries.
 *
 * @example
 * ```typescript
 * const client = new PactToolboxClient({
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
  /** The network context that manages connections and configuration */
  public context: ToolboxNetworkContext;

  /**
   * Creates a new PactToolboxClient instance.
   * @param config - The configuration object for the client
   * @param network - Optional network name to use (overrides defaultNetwork in config)
   */
  constructor(
    private config: PactToolboxConfigObj = defaultConfig,
    private network?: string,
  ) {
    const multiNetworkConfig = getSerializableMultiNetworkConfig(config, { isDev: true, defaultNetwork: network });
    this.context = createToolboxNetworkContext(multiNetworkConfig, true);
  }

  /**
   * Updates the client configuration at runtime.
   * Useful for switching between different environments or configurations.
   * @param config - The new configuration object
   */
  setConfig(config: PactToolboxConfigObj): void {
    this.config = config;
    this.context = createToolboxNetworkContext(
      getSerializableMultiNetworkConfig(config, { isDev: true, defaultNetwork: this.network }),
      true,
    );
  }

  /**
   * Gets the current network context.
   * Provides access to low-level network operations.
   * @returns The current ToolboxNetworkContext instance
   */
  getContext(): ToolboxNetworkContext {
    return this.context;
  }

  /**
   * Gets the current network configuration.
   * @returns The active network configuration
   */
  getNetworkConfig(): SerializableNetworkConfig {
    return this.context.getCurrentNetworkConfig();
  }

  /**
   * Checks if the current network is a Pact server (local development).
   * @returns True if connected to a Pact server, false otherwise
   */
  isPactServerNetwork(): boolean {
    return isPactServerNetworkConfig(this.context.getCurrentNetworkConfig());
  }

  /**
   * Checks if the current network is a Chainweb network (devnet/testnet/mainnet).
   * @returns True if connected to Chainweb, false otherwise
   */
  isChainwebNetwork(): boolean {
    return this.context.getNetworkType().includes("chainweb");
  }

  /**
   * Gets the contracts directory path.
   * @returns The path to the contracts directory (default: "pact")
   */
  getContractsDir(): string {
    return this.config.contractsDir ?? "pact";
  }

  /**
   * Gets the scripts directory path.
   * @returns The path to the scripts directory (default: "scripts")
   */
  getScriptsDir(): string {
    return this.config.scriptsDir ?? "scripts";
  }

  /**
   * Gets the prelude directory path.
   * @returns The path to the prelude directory (default: "<contractsDir>/prelude")
   */
  getPreludeDir(): string {
    return join(this.getContractsDir(), "prelude");
  }

  /**
   * Gets the complete client configuration.
   * @returns The full configuration object
   */
  getConfig(): PactToolboxConfigObj<Record<string, NetworkConfig>> {
    return this.config;
  }

  /**
   * Retrieves a signer based on the provided address or defaults to the sender account.
   * @param address - The signer address or key pair.
   * @param args - Additional arguments for environment-based signer retrieval.
   * @returns The signer key pair.
   */
  getSignerKeys(signerLike?: PactSignerLike | KeyPair): KeyPair {
    if (isKeyPair(signerLike)) {
      return signerLike;
    }
    if (typeof signerLike === "string") {
      return this.context.getSignerKeys(signerLike);
    }

    if (typeof signerLike === "object") {
      return this.context.getSignerKeys(signerLike.address ?? getKAccountKey(signerLike.pubKey));
    }

    const fromEnv = getSignerFromEnvVars(this.context.getNetworkId().toUpperCase());
    if (fromEnv?.secretKey && fromEnv?.publicKey) {
      return {
        publicKey: fromEnv.publicKey,
        secretKey: fromEnv.secretKey,
        account: fromEnv.account ?? getKAccountKey(fromEnv.publicKey),
      };
    }
    const account =
      fromEnv?.account ||
      (fromEnv?.publicKey ? getKAccountKey(fromEnv?.publicKey) : this.context.getSignerKeys().account);
    return this.context.getSignerKeys(account);
  }

  /**
   * Gets or creates a wallet for transaction signing.
   * @param walletLike - Optional wallet, signer, or keypair to use
   * @returns A Wallet instance for signing transactions
   * @example
   * ```typescript
   * // Use default wallet from context
   * const wallet = client.getWallet();
   *
   * // Use custom keypair
   * const wallet = client.getWallet({
   *   publicKey: 'public-key',
   *   secretKey: 'secret-key'
   * });
   * ```
   */
  getWallet(walletLike?: PactSignerLike | KeyPair | Wallet): Wallet {
    if (typeof walletLike === "object" && walletLike !== null && "getAccount" in walletLike && "sign" in walletLike) {
      return walletLike;
    }
    const wallet = this.context.getWallet();
    if (wallet && !walletLike) {
      return wallet;
    }
    const signer = this.getSignerKeys(walletLike);
    return new KeypairWallet({
      networkId: this.context.getNetworkId(),
      rpcUrl: this.context.getNetworkConfig().rpcUrl,
      accountName: signer.account,
      chainId: this.context.getMeta().chainId,
      networkName: this.context.getNetworkConfig().name,
      privateKey: signer.secretKey,
    });
  }

  /**
   * Creates an execution builder for running Pact commands.
   * This is the primary method for building and executing transactions.
   * @param command - The Pact command to execute
   * @returns A PactTransactionBuilder instance for method chaining
   * @example
   * ```typescript
   * // Simple query
   * const balance = await client.execution('(coin.get-balance "alice")')
   *   .dirtyRead();
   *
   * // Transaction with data and capabilities
   * const result = await client.execution('(coin.transfer "alice" "bob" amount)')
   *   .addData({ amount: 10.0 })
   *   .addCapability('coin.TRANSFER', 'alice', 'bob', 10.0)
   *   .submitAndListen();
   * ```
   */
  execution<Result = unknown>(command: string): PactTransactionBuilder<PactExecPayload, Result> {
    // Get sender account safely - use default if no signer keys available
    let sender: string;
    try {
      sender = this.context.getSignerKeys().account;
    } catch {
      // If no signer keys in context, use sender00 as default
      sender = "sender00";
    }

    return execution<Result>(command, this.context)
      .withContext(this.context)
      .withMeta({
        ...defaultMeta,
        ...this.context.getMeta(),
        sender,
      })
      .withNetworkId(this.context.getNetworkId());
  }

  /**
   * Deploys Pact code to the blockchain.
   * Supports single chain or multi-chain deployment.
   * @param code - The Pact code to deploy
   * @param options - Deployment options
   * @param chainId - Chain ID(s) to deploy to (optional)
   * @returns Transaction descriptor or request key
   * @example
   * ```typescript
   * // Deploy to default chain
   * await client.deployCode('(module my-module ...)');
   *
   * // Deploy to specific chains
   * await client.deployCode('(module my-module ...)', {}, ['0', '1']);
   * ```
   */

  async deployCode(
    code: string,
    options?: DeployContractOptions,
    chainId?: ChainId,
  ): Promise<PactTransactionDescriptor | string>;
  async deployCode(
    code: string,
    options?: DeployContractOptions,
    chainId?: ChainId[],
  ): Promise<PactTransactionDescriptor[] | string[]>;
  async deployCode(
    code: string,
    options: DeployContractOptions = {},
    chainId?: ChainId | ChainId[],
  ): Promise<PactTransactionDescriptor | PactTransactionDescriptor[] | string | string[]> {
    const { preflight, listen = true, skipSign, wallet: walletLike, builder } = options;
    let txBuilder = this.execution<string>(code).withContext(this.context);
    const wallet = this.getWallet(walletLike);
    if (typeof builder === "function") {
      await builder(txBuilder);
    } else {
      this.prepareTransaction(txBuilder, builder);
    }

    if (skipSign) {
      return listen
        ? txBuilder.build().submitAndListen(chainId as any, preflight)
        : txBuilder.build().submit(chainId as any, preflight);
    }

    if (wallet) {
      const signer = await wallet.getAccount();
      txBuilder = txBuilder.withSigner(signer.publicKey, (signFor) => [signFor("coin.GAS")]);
    } else {
      // If no explicit signer provided, add the default signer with gas capability
      const defaultSigner = this.context.getSignerKeys();
      txBuilder = txBuilder.withSigner(defaultSigner.publicKey, (signFor) => [signFor("coin.GAS")]);
    }
    const signedTxBuilder = txBuilder.sign(wallet);
    return listen
      ? signedTxBuilder.submitAndListen(chainId as any, preflight)
      : signedTxBuilder.submit(chainId as any, preflight);
  }

  /**
   * Deploys a contract from a file.
   * @param contract - Path to the contract file (relative to contractsDir or absolute)
   * @param options - Deployment options
   * @param chainId - Chain ID(s) to deploy to (optional)
   * @returns Transaction descriptor or request key
   * @example
   * ```typescript
   * // Deploy from contracts directory
   * await client.deployContract('token.pact');
   *
   * // Deploy with options
   * await client.deployContract('token.pact', {
   *   listen: true,
   *   preflight: false
   * });
   * ```
   */
  async deployContract(
    contract: string,
    options?: DeployContractOptions,
    chainId?: ChainId,
  ): Promise<PactTransactionDescriptor | string>;
  async deployContract(
    contract: string,
    options?: DeployContractOptions,
    chainId?: ChainId[],
  ): Promise<PactTransactionDescriptor[] | string[]>;
  async deployContract(
    contract: string,
    options?: DeployContractOptions,
    chainId?: ChainId | ChainId[],
  ): Promise<PactTransactionDescriptor | PactTransactionDescriptor[] | string | string[]> {
    const contractCode = await this.getContractCode(contract);
    return this.deployCode(contractCode, options, chainId as any);
  }

  /**
   * Deploys multiple contracts in parallel.
   * @param contracts - Array of contract file paths
   * @param options - Deployment options
   * @param chainId - Chain ID(s) to deploy to (optional)
   * @returns Array of transaction descriptors or request keys
   * @example
   * ```typescript
   * // Deploy multiple contracts
   * await client.deployContracts([
   *   'base.pact',
   *   'token.pact',
   *   'exchange.pact'
   * ]);
   * ```
   */
  async deployContracts(
    contracts: string[],
    options?: DeployContractOptions,
    chainId?: ChainId,
  ): Promise<(PactTransactionDescriptor | string)[]>;
  async deployContracts(
    contracts: string[],
    options?: DeployContractOptions,
    chainId?: ChainId[],
  ): Promise<(PactTransactionDescriptor[] | string[])[]>;
  async deployContracts(
    contracts: string[],
    options?: DeployContractOptions,
    chainId?: ChainId | ChainId[],
  ): Promise<(PactTransactionDescriptor | string)[] | (PactTransactionDescriptor[] | string[])[]> {
    const results = await Promise.all(
      contracts.map((contract) => this.deployContract(contract, options, chainId as any)),
    );
    return results.flat();
  }

  /**
   * Prepares a transaction builder with common configuration.
   * Internal helper method for consistent transaction setup.
   * @param txBuilder - The transaction builder to configure
   * @param data - Transaction configuration data
   * @returns The configured transaction builder
   * @private
   */
  private prepareTransaction(
    txBuilder: PactTransactionBuilder<any>,
    data?: TransactionBuilderData,
  ): PactTransactionBuilder<any> {
    const {
      senderAccount,
      chainId = this.context.getMeta().chainId ?? "0",
      init = true,
      namespace,
      keysets,
      data: txData,
      upgrade = false,
    } = data ?? {};

    txBuilder.withData("upgrade", upgrade).withData("init", init);

    if (chainId) {
      txBuilder.withMeta({ chainId });
    }

    if (senderAccount) {
      txBuilder.withMeta({ sender: senderAccount });
    }

    if (namespace) {
      txBuilder.withData("namespace", namespace).withData("ns", namespace);
    }

    if (keysets) {
      txBuilder.withKeysetMap(keysets);
    }

    if (txData) {
      txBuilder.withDataMap(txData);
    }

    return txBuilder;
  }

  /**
   * Lists all deployed modules on the current chain.
   * @returns Array of module names
   * @example
   * ```typescript
   * const modules = await client.listModules();
   * console.log('Deployed modules:', modules);
   * ```
   */
  async listModules(): Promise<string[]> {
    return this.execution<string[]>(`(list-modules)`).build().dirtyRead();
  }

  /**
   * Gets detailed information about a deployed module.
   * @param module - The module name to describe
   * @returns Module interface information
   * @example
   * ```typescript
   * const info = await client.describeModule('coin');
   * console.log('Module interface:', info);
   * ```
   */
  async describeModule(module: string): Promise<string> {
    return this.execution<string>(`(describe-module "${module}")`).build().dirtyRead();
  }

  /**
   * Gets information about a namespace.
   * @param namespace - The namespace name
   * @returns Namespace information
   * @example
   * ```typescript
   * const info = await client.describeNamespace('free');
   * ```
   */
  async describeNamespace(namespace: string): Promise<string> {
    return this.execution<string>(`(describe-namespace "${namespace}")`).build().dirtyRead();
  }

  /**
   * Checks if a namespace is defined.
   * @param namespace - The namespace name to check
   * @returns True if namespace exists, false otherwise
   * @example
   * ```typescript
   * if (await client.isNamespaceDefined('my-namespace')) {
   *   console.log('Namespace exists');
   * }
   * ```
   */
  async isNamespaceDefined(namespace: string): Promise<boolean> {
    try {
      await this.describeNamespace(namespace);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a module/contract is deployed.
   * @param module - The module name to check
   * @returns True if module is deployed, false otherwise
   * @example
   * ```typescript
   * if (!await client.isContractDeployed('my-module')) {
   *   await client.deployContract('my-module.pact');
   * }
   * ```
   */
  async isContractDeployed(module: string): Promise<boolean> {
    try {
      await this.describeModule(module);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads contract code from the filesystem.
   * @param contractPath - Path to the contract file (relative to contractsDir or absolute)
   * @returns The contract code as a string
   * @throws Error if the contract file is not found
   * @example
   * ```typescript
   * // Read from contracts directory
   * const code = await client.getContractCode('token.pact');
   *
   * // Read from absolute path
   * const code = await client.getContractCode('/path/to/contract.pact');
   * ```
   */
  async getContractCode(contractPath: string): Promise<string> {
    const contractsDir = this.getContractsDir();
    let resolvedPath =
      isAbsolute(contractPath) || contractPath.startsWith(contractsDir)
        ? resolve(contractPath)
        : resolve(contractsDir, contractPath);

    if (!resolvedPath.endsWith(".pact")) {
      logger.warn("Contract file does not have a .pact extension, appending .pact");
      resolvedPath += ".pact";
    }

    try {
      await stat(resolvedPath);
    } catch {
      throw new Error(`Contract file not found: ${resolvedPath}`);
    }
    return readFile(resolvedPath, "utf-8");
  }
}
