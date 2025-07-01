import { ChainwebClient } from "@pact-toolbox/chainweb-client";
import { defaultMeta, getSerializableMultiNetworkConfig, type PactToolboxConfigObj } from "@pact-toolbox/config";
import { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { existsSync, logger, readFile } from "@pact-toolbox/node-utils";
import { execution, getKAccountKey } from "@pact-toolbox/transaction";
import type {
  ChainId,
  KeyPair,
  PactCapability,
  PactEnvData,
  PactKeyset,
  PactSignerLike,
  PactTransactionDescriptor,
  SerializableNetworkConfig,
} from "@pact-toolbox/types";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { KeypairWallet } from "@pact-toolbox/wallet-core";
import { resolve } from "pathe";
import { getSignerFromEnvVars, isKeyPair, isWallet } from "./utils";

// Base deployment interfaces and types
export interface DeploymentOptions {
  gasLimit?: number;
  gasPrice?: number;
  data?: PactEnvData;
  keysets?: Record<string, PactKeyset>;
  capabilities?: PactCapability[];
  skipIfAlreadyDeployed?: boolean;
  tags?: string[];
  dependencies?: string[];
  /** Deploy to specific chains. If not provided, uses network default */
  chains?: string[];
  /** Deploy to all chains (0-19) */
  deployToAllChains?: boolean;
  /** Transaction sender account */
  from?: string;
  /** Maximum retry attempts for deployment (default: 3) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Whether to use exponential backoff for retries (default: true) */
  exponentialBackoff?: boolean;

  /** Deployment hooks */
  hooks?: {
    preDeploy?: (contractName: string, source: string) => Promise<void>;
    postDeploy?: (contractName: string, result: DeployResult | MultiChainDeployResult) => Promise<void>;
    onError?: (contractName: string, error: Error) => Promise<void>;
    onRetry?: (contractName: string, attempt: number, error: Error) => Promise<void>;
  };
  /** Environment-specific configuration */
  environment?: Record<string, any>;
  /** Wallet or signer configuration for transaction signing */
  wallet?: Wallet | PactSignerLike | KeyPair | string;
  /** Skip transaction signing (for unsigned transactions) */
  skipSign?: boolean;
  /** Whether to preflight the transaction before submission */
  preflight?: boolean;
  /** Timeout for transaction listening in milliseconds (default: 120000) */
  timeout?: number;
}

export interface ContractInfo {
  name: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface DeployResult {
  contractName: string;
  transactionHash: string;
  deployedAt: Date;
  chainId: string;
  status: "success" | "failed" | "timeout" | "rejected";
  error?: string;
  gasUsed?: number;
  result?: any;
  attempts?: number;
}

export interface MultiChainDeployResult {
  contractName: string;
  deployedAt: Date;
  results: DeployResult[];
  failed: Array<{ chainId: string; error: string }>;
  totalChains: number;
  successfulChains: number;
  failedChains: number;
}

export class PactDeployer {
  #network!: string;
  #contractsDir!: string;
  #networkProvider!: NetworkConfigProvider;
  #chainwebClient!: ChainwebClient;
  #config: PactToolboxConfigObj;

  constructor(config: PactToolboxConfigObj, network?: string) {
    this.#config = config;
    this.updateConfig(config, network);
  }

  /**
   * Deploy a contract
   */
  async deploy(contractName: string, options: DeploymentOptions = {}): Promise<DeployResult | MultiChainDeployResult> {
    logger.info(`🚀 Starting deployment of ${contractName}`);

    try {
      // Run pre-deployment hook
      if (options.hooks?.preDeploy) {
        const contractSource = await this.loadContractSource(contractName);
        await options.hooks.preDeploy(contractName, contractSource);
      }

      // Check if contract already exists
      if (options.skipIfAlreadyDeployed) {
        const targetChains = this.getTargetChains(options);
        const allDeployed = await Promise.all(targetChains.map((chainId) => this.isDeployed(contractName, chainId)));

        if (allDeployed.every((deployed) => deployed)) {
          logger.warn(`Contract ${contractName} already deployed on all target chains, skipping`);
          return {
            contractName,
            transactionHash: "",
            deployedAt: new Date(),
            chainId: targetChains[0] || "0",
            status: "success",
            result: { message: "Already deployed" },
          };
        }
      }

      // Execute deployment
      const result = await this.deployContract(contractName, options);

      // Run post-deployment hook
      if (options.hooks?.postDeploy) {
        await options.hooks.postDeploy(contractName, result);
      }

      logger.success(`✅ Deployment of ${contractName} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`❌ Deployment of ${contractName} failed:`, error);

      // Run error hook
      if (options.hooks?.onError) {
        await options.hooks.onError(contractName, error as Error);
      }

      throw error;
    }
  }

  /**
   * Deploy multiple contracts with dependency resolution
   */
  async deployMany(
    contracts: Array<{
      name: string;
      options?: DeploymentOptions;
    }>,
    globalOptions: DeploymentOptions = {},
  ): Promise<DeployResult[]> {
    logger.info(`🚀 Starting batch deployment of ${contracts.length} contracts`);

    // Build dependency graph and get deployment order
    const deploymentOrder = await this.resolveDependencyOrder(contracts);
    logger.info(`📋 Deployment order: ${deploymentOrder.map((c) => c.name).join(" → ")}`);

    const results: DeployResult[] = [];
    const failed: Array<{ name: string; error: Error }> = [];

    for (const contract of deploymentOrder) {
      try {
        const mergedOptions = { ...globalOptions, ...contract.options };
        const result = await this.deploy(contract.name, mergedOptions);

        if ("results" in result) {
          // Multi-chain result
          results.push(...result.results);
        } else {
          // Single chain result
          results.push(result);
        }

        logger.success(`✅ ${contract.name} deployed successfully`);
      } catch (error) {
        logger.error(`❌ ${contract.name} deployment failed:`, error);
        failed.push({ name: contract.name, error: error as Error });

        // Stop on first failure unless configured to continue
        if (!globalOptions.skipIfAlreadyDeployed) {
          break;
        }
      }
    }

    if (failed.length > 0) {
      const failedNames = failed.map((f) => f.name).join(", ");
      logger.error(`❌ Batch deployment failed for: ${failedNames}`);
      throw new Error(`Batch deployment failed for: ${failedNames}`);
    }

    logger.success(`✅ Batch deployment completed: ${contracts.length} contracts deployed`);
    return results;
  }

  /**
   * Deploy a contract to the blockchain (single or multi-chain)
   */
  async deployContract(
    contractName: string,
    options: DeploymentOptions = {},
  ): Promise<DeployResult | MultiChainDeployResult> {
    // Determine target chains
    const targetChains = this.getTargetChains(options);

    if (targetChains.length === 0) {
      throw new Error("No target chains specified for deployment");
    }

    if (targetChains.length === 1) {
      // Single chain deployment
      return this.deploySingleChain(contractName, options, targetChains[0]!);
    } else {
      // Multi-chain deployment
      return this.deployMultiChain(contractName, options, targetChains);
    }
  }

  /**
   * Deploy a contract to a single chain
   */
  private async deploySingleChain(
    contractName: string,
    options: DeploymentOptions,
    chainId: string,
  ): Promise<DeployResult> {
    // Check dependencies
    if (options.dependencies) {
      for (const dep of options.dependencies) {
        if (!(await this.isDeployed(dep, chainId))) {
          throw new Error(`Dependency ${dep} not deployed for contract ${contractName} on chain ${chainId}`);
        }
      }
    }

    logger.info(`🚀 Deploying ${contractName} to chain ${chainId}...`);

    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    const exponentialBackoff = options.exponentialBackoff !== false;

    let lastError: Error | undefined;
    let attempts = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attempts = attempt;

      try {
        logger.info(`  Attempt ${attempt}/${maxRetries}...`);

        // Load contract source
        const contractSource = await this.loadContractSource(contractName);
        const networkConfig = this.#networkProvider.getNetwork(this.#network);

        // Get wallet for signing
        const wallet = this.getWallet(options.wallet);
        const signingAccount = await wallet.getAccount();

        // Build transaction
        let tx = execution(contractSource, this.#networkProvider)
          .withChainId(chainId as ChainId)
          .withMeta({
            gasLimit: options.gasLimit || networkConfig.meta?.gasLimit || 150000,
            gasPrice: options.gasPrice || networkConfig.meta?.gasPrice || 0.00001,
            ttl: networkConfig.meta?.ttl || 600,
            sender: signingAccount?.address || networkConfig.senderAccount || "sender00",
          });

        // Add data if provided
        if (options.data) {
          tx = tx.withDataMap(options.data);
        }

        // Add keysets if provided
        if (options.keysets) {
          tx = tx.withKeysets(options.keysets);
        }

        // Add signer
        if (signingAccount && !options.skipSign) {
          tx = tx.withSigner(signingAccount.publicKey, (signFor) => [
            signFor("coin.GAS"),
            ...(options.capabilities || []),
          ]);
        }

        // Preflight if requested
        if (options.preflight) {
          logger.info(`  Running preflight check...`);
          const preflightResult = await tx.build().local();
          if ((preflightResult as any).result?.status === "failure") {
            throw new Error(`Preflight failed: ${JSON.stringify(preflightResult)}`);
          }
        }

        // Sign and submit transaction
        const dispatcher = options.skipSign ? tx.build() : tx.sign(wallet);
        console.dir(dispatcher.getCommand(), { depth: null });
        console.log((await dispatcher.getSignedTransaction()).sigs);

        // Submit with timeout
        const timeout = options.timeout || 120000;

        // First submit the transaction to get the request key
        const submitResult = (await dispatcher.submit()) as PactTransactionDescriptor;
        const requestKey = submitResult.requestKey;

        // Then listen for the result with timeout
        const listenPromise = this.#chainwebClient.listen(requestKey);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Transaction timeout")), timeout),
        );

        const listenResult = await Promise.race([listenPromise, timeoutPromise]);
        if (listenResult.result.status !== "success") {
          throw new Error(`Transaction failed: ${JSON.stringify(listenResult)}`);
        }
        const deployResult: DeployResult = {
          contractName,
          transactionHash: requestKey,
          deployedAt: new Date(),
          chainId,
          status: "success",
          gasUsed: listenResult.gas,
          result: listenResult,
          attempts,
        };
        console.dir(deployResult, { depth: null });

        logger.success(`✅ Deployed ${contractName} to chain ${chainId} (tx: ${deployResult.transactionHash})`);
        return deployResult;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`  Attempt ${attempt} failed: ${lastError.message}`);

        // Run retry hook
        if (options.hooks?.onRetry && attempt < maxRetries) {
          await options.hooks.onRetry(contractName, attempt, lastError);
        }

        if (attempt < maxRetries) {
          // Calculate delay with optional exponential backoff
          const delay = exponentialBackoff ? Math.min(retryDelay * Math.pow(2, attempt - 1), 30000) : retryDelay;

          logger.info(`  Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    throw new Error(
      `Failed to deploy ${contractName} to chain ${chainId} after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Deploy a contract to multiple chains
   */
  private async deployMultiChain(
    contractName: string,
    options: DeploymentOptions,
    chainIds: string[],
  ): Promise<MultiChainDeployResult> {
    logger.info(`🚀 Deploying ${contractName} to ${chainIds.length} chains: ${chainIds.join(", ")}`);

    const results: DeployResult[] = [];
    const failed: Array<{ chainId: string; error: string }> = [];
    const startTime = new Date();

    // Deploy in parallel batches for efficiency
    const batchSize = 5; // Process 5 chains at a time
    for (let i = 0; i < chainIds.length; i += batchSize) {
      const batch = chainIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (chainId) => {
        try {
          const result = await this.deploySingleChain(contractName, options, chainId);
          results.push(result);
        } catch (error) {
          failed.push({
            chainId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.all(batchPromises);
    }

    const result: MultiChainDeployResult = {
      contractName,
      deployedAt: startTime,
      results,
      failed,
      totalChains: chainIds.length,
      successfulChains: results.filter((r) => r.status === "success").length,
      failedChains: failed.length,
    };

    if (failed.length > 0) {
      logger.warn(`⚠️ ${contractName} deployment completed with ${failed.length} failures`);
    } else {
      logger.success(`✅ ${contractName} deployed successfully to all ${chainIds.length} chains`);
    }

    return result;
  }

  /**
   * Determine target chains for deployment
   */
  private getTargetChains(options: DeploymentOptions): string[] {
    if (options.deployToAllChains) {
      // Deploy to all Kadena chains (0-19)
      return Array.from({ length: 20 }, (_, i) => i.toString());
    }

    if (options.chains && options.chains.length > 0) {
      return options.chains;
    }

    // Default to network's default chain
    const networkConfig = this.#networkProvider.getNetwork(this.#network);
    return [networkConfig.meta?.chainId?.toString() || "0"];
  }

  /**
   * Check if a contract is deployed on the blockchain
   */
  async isDeployed(contractName: string, chainId?: string): Promise<boolean> {
    const networkConfig = this.#networkProvider.getNetwork(this.#network);
    const targetChainId = chainId || networkConfig.meta?.chainId?.toString() || "0";
    try {
      // Try to describe the module
      const result = await execution(`(describe-module "${contractName}")`, this.#networkProvider)
        .withChainId(targetChainId as ChainId)
        .build()
        .dirtyRead();
      console.log("Describe module result:", result);
      return result !== null && result !== undefined && !(result as any).error;
    } catch (error) {
      // If describe fails, module doesn't exist
      logger.debug(`Contract ${contractName} not found on chain ${targetChainId}: ${error}`);
      return false;
    }
  }

  /**
   * Load contract source code
   */
  private async loadContractSource(contractName: string): Promise<string> {
    const contractPath = this.getContractPath(contractName);
    if (!existsSync(contractPath)) {
      throw new Error(`Contract file not found: ${contractPath}`);
    }
    return readFile(contractPath, "utf-8");
  }

  /**
   * Get contract file path
   */
  private getContractPath(contractName: string): string {
    // Support both .pact extension and without
    const basePath = resolve(this.#contractsDir, contractName);
    if (existsSync(basePath)) {
      return basePath;
    }
    return resolve(this.#contractsDir, `${contractName}.pact`);
  }

  /**
   * Resolve dependency order using topological sort
   */
  private async resolveDependencyOrder(
    contracts: Array<{ name: string; options?: DeploymentOptions }>,
  ): Promise<Array<{ name: string; options?: DeploymentOptions }>> {
    const result: Array<{ name: string; options?: DeploymentOptions }> = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const contractMap = new Map(contracts.map((c) => [c.name, c]));

    // Auto-detect dependencies if not specified
    for (const contract of contracts) {
      if (!contract.options?.dependencies) {
        const dependencies = await this.analyzeDependencies(contract.name);
        if (dependencies.length > 0) {
          contract.options = {
            ...contract.options,
            dependencies,
          };
        }
      }
    }

    const visit = (contractName: string) => {
      if (visited.has(contractName)) {
        return;
      }

      if (visiting.has(contractName)) {
        throw new Error(`Circular dependency detected involving contract: ${contractName}`);
      }

      visiting.add(contractName);

      const contract = contractMap.get(contractName);
      if (contract) {
        const dependencies = contract.options?.dependencies || [];

        // Visit all dependencies first
        for (const dep of dependencies) {
          if (!contractMap.has(dep)) {
            logger.warn(`Dependency ${dep} for ${contractName} not found in deployment list`);
            continue;
          }
          visit(dep);
        }

        visiting.delete(contractName);
        visited.add(contractName);
        result.push(contract);
      }
    };

    // Visit all contracts
    for (const contract of contracts) {
      visit(contract.name);
    }

    return result;
  }

  /**
   * Analyze contract source for dependencies
   */
  async analyzeDependencies(contractName: string): Promise<string[]> {
    try {
      const contractSource = await this.loadContractSource(contractName);
      const dependencies: string[] = [];

      // Look for module references in the contract
      // Pattern: (use module-name)
      const useMatches = contractSource.match(/\(use\s+([^\s)]+)/g);
      if (useMatches) {
        for (const match of useMatches) {
          const moduleName = match.replace(/\(use\s+/, "").trim();
          // Skip built-in modules
          if (!this.isBuiltinModule(moduleName)) {
            dependencies.push(moduleName);
          }
        }
      }

      // Pattern: module-name.function-name calls
      const moduleCallMatches = contractSource.match(/\(([a-zA-Z0-9\-_.]+)\./g);
      if (moduleCallMatches) {
        for (const match of moduleCallMatches) {
          const moduleName = match.replace(/\(/, "").replace(/\.$/, "");
          if (!this.isBuiltinModule(moduleName) && !dependencies.includes(moduleName)) {
            dependencies.push(moduleName);
          }
        }
      }

      logger.debug(`Found dependencies for ${contractName}: ${dependencies.join(", ")}`);
      return dependencies;
    } catch (error) {
      logger.warn(`Could not analyze dependencies for ${contractName}: ${error}`);
      return [];
    }
  }

  /**
   * Check if module is a built-in Pact module
   */
  private isBuiltinModule(moduleName: string): boolean {
    const builtinModules = [
      "coin",
      "fungible-v2",
      "poly-fungible-v2",
      "non-fungible-token-v1",
      "pact-util",
      "kip",
      "util",
      "guards",
      "gas-station-v1",
      "ns",
      "free",
    ];
    return builtinModules.includes(moduleName) || moduleName.startsWith("free.");
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
      return this.#networkProvider.getSignerKeys(signerLike);
    }

    if (typeof signerLike === "object") {
      return this.#networkProvider.getSignerKeys(signerLike.address ?? getKAccountKey(signerLike.pubKey));
    }
    const networkConfig = this.getNetworkConfig();
    const fromEnv = getSignerFromEnvVars(networkConfig.networkId.toUpperCase());
    if (fromEnv?.secretKey && fromEnv?.publicKey) {
      return {
        publicKey: fromEnv.publicKey,
        secretKey: fromEnv.secretKey,
        account: fromEnv.account ?? getKAccountKey(fromEnv.publicKey),
      };
    }
    const account =
      fromEnv?.account ||
      (fromEnv?.publicKey ? getKAccountKey(fromEnv?.publicKey) : this.#networkProvider.getSignerKeys().account);
    return this.#networkProvider.getSignerKeys(account);
  }

  getWallet(walletLike?: Wallet | PactSignerLike | KeyPair | string): Wallet {
    if (isWallet(walletLike)) {
      return walletLike;
    }
    const networkConfig = this.getNetworkConfig();
    const keyPair = this.getSignerKeys(walletLike);
    if (!keyPair) {
      throw new Error(`Signer not found in config or environment`);
    }
    return new KeypairWallet({
      rpcUrl: networkConfig.rpcUrl,
      chainId: networkConfig.meta.chainId || defaultMeta.chainId,
      privateKey: keyPair.secretKey,
      accountName: keyPair.account,
      networkId: networkConfig.networkId,
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: PactToolboxConfigObj, network?: string): void {
    this.#network = network || config.defaultNetwork || "development";
    this.#contractsDir = config.contractsDir || "./pact";
    this.#networkProvider = NetworkConfigProvider.getInstance(
      getSerializableMultiNetworkConfig(config, { isDev: true, defaultNetwork: this.#network }),
    );
    const networkConfig = this.#networkProvider.getNetwork(this.#network);
    this.#chainwebClient = ChainwebClient.getInstance({
      networkId: networkConfig.networkId,
      rpcUrl: networkConfig.rpcUrl,
      chainId: networkConfig.meta?.chainId?.toString() || "0",
    });
    this.#config = config;
  }

  getConfig(): PactToolboxConfigObj {
    return this.#config;
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(): SerializableNetworkConfig {
    return this.#networkProvider.getNetwork(this.#network);
  }

  /**
   * Get prelude directory
   */
  getPreludeDir(): string {
    return resolve(this.#contractsDir, "prelude");
  }

  /**
   * Check if a contract is deployed
   */
  async isContractDeployed(contractName: string, chainId?: string): Promise<boolean> {
    return this.isDeployed(contractName, chainId);
  }

  /**
   * Check if a namespace is defined
   */
  async isNamespaceDefined(namespace: string): Promise<boolean> {
    try {
      const result = await execution(`(describe-namespace "${namespace}")`, this.#networkProvider)
        .withChainId((this.getNetworkConfig().meta?.chainId?.toString() || "0") as ChainId)
        .build()
        .dirtyRead();
      return result !== null && result !== undefined && !(result as any).error;
    } catch {
      return false;
    }
  }

  /**
   * Create execution builder
   */
  execution(pactCode: string): ReturnType<typeof execution> {
    return execution(pactCode, this.#networkProvider);
  }

  /**
   * Get network provider
   */
  getNetworkProvider(): NetworkConfigProvider {
    return this.#networkProvider;
  }

  /**
   * Get ChainwebClient instance
   */
  getChainwebClient(): ChainwebClient {
    return this.#chainwebClient;
  }
}

/**
 * Create a PactDeployer instance
 */
export function createPactDeployer(config: PactToolboxConfigObj, network?: string): PactDeployer {
  return new PactDeployer(config, network);
}
