import type { PactToolboxClient } from "@pact-toolbox/runtime";
import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import { logger, readFile, existsSync } from "@pact-toolbox/node-utils";
import { resolve } from "pathe";
import type { WalletManager } from "./wallet-manager";
import type { NamespaceHandler, NamespaceHandlingOptions } from "./namespace-handler";
// Base deployment interfaces and types
export interface DeploymentOptions {
  gasLimit?: number;
  gasPrice?: number;
  data?: Record<string, any>;
  upgradePolicy?: "capability" | "governance" | "none";
  verify?: boolean;
  waitForConfirmation?: boolean;
  confirmations?: number;
  timeout?: number;
  from?: string;
  skipIfAlreadyDeployed?: boolean;
  tags?: string[];
  dependencies?: string[];
  /** Deploy to specific chains. If not provided, uses network default */
  chains?: string[];
  /** Deploy to all chains (0-19) */
  deployToAllChains?: boolean;
}

export interface ContractInfo {
  name: string;
  source: string;
  abi?: any;
  metadata?: Record<string, any>;
}

export interface DeployResult {
  contractName: string;
  transactionHash: string;
  deployedAt: Date;
  chainId: string;
}

export interface MultiChainDeployResult {
  contractName: string;
  deployedAt: Date;
  results: DeployResult[];
  failed: Array<{ chainId: string; error: string }>;
  totalChains: number;
  successfulChains: number;
}

export interface AdvancedDeploymentOptions extends DeploymentOptions {
  /** Namespace handling configuration */
  namespaceHandling?: NamespaceHandlingOptions;
  /** Pre-deployment validation */
  validate?: boolean;
  /** Post-deployment verification */
  verify?: boolean;
  /** Deployment hooks */
  hooks?: {
    preDeploy?: (contractName: string, source: string) => Promise<void>;
    postDeploy?: (contractName: string, result: DeployResult) => Promise<void>;
    onError?: (contractName: string, error: Error) => Promise<void>;
  };
  /** Environment-specific configuration */
  environment?: Record<string, any>;
  /** Contract initialization data */
  initData?: Record<string, any>;
  /** Migration strategy for upgrades */
  migrationStrategy?: "replace" | "upgrade" | "migrate";
}

export interface AdvancedDeployResult extends DeployResult {
  /** Namespace operation result if applicable */
  namespaceOperation?: {
    created: boolean;
    namespaceName: string;
    transactionHash?: string;
  };
  /** Contract validation results */
  validation?: {
    passed: boolean;
    issues: string[];
  };
}

export class DeploymentHelper {
  private client: PactToolboxClient;
  private config: PactToolboxConfigObj;
  private network: string;
  private contractsDir: string;
  private walletManager: WalletManager;
  private namespaceHandler: NamespaceHandler;

  constructor(
    client: PactToolboxClient,
    config: PactToolboxConfigObj,
    network: string,
    walletManager: WalletManager,
    namespaceHandler: NamespaceHandler,
    options: {
      contractsDir?: string;
    } = {},
  ) {
    this.client = client;
    this.config = config;
    this.network = network;
    this.walletManager = walletManager;
    this.namespaceHandler = namespaceHandler;
    this.contractsDir = options.contractsDir || config.contractsDir || "./pact";
  }

  /**
   * Enhanced deploy method with namespace handling and validation
   */
  async deploy(contractName: string, options: AdvancedDeploymentOptions = {}): Promise<AdvancedDeployResult> {
    logger.info(`🚀 Starting enhanced deployment of ${contractName}`);

    try {
      // Run pre-deployment hook
      if (options.hooks?.preDeploy) {
        const contractSource = await this.loadContractSource(contractName);
        await options.hooks.preDeploy(contractName, contractSource);
      }

      // Handle namespace requirements
      const namespaceResult = await this.handleNamespaceRequirements(contractName, options);

      // Validate contract if requested
      const validationResult = options.validate ? await this.validateContract(contractName, options) : undefined;

      // Check if validation failed and should block deployment
      if (validationResult && !validationResult.passed && options.validate) {
        throw new Error(`Contract validation failed: ${validationResult.issues.join(", ")}`);
      }

      // Check if contract already exists
      if (options.skipIfAlreadyDeployed && (await this.isDeployed(contractName))) {
        logger.warn(`Contract ${contractName} already deployed, skipping`);
        return {
          contractName,
          transactionHash: "",
          deployedAt: new Date(),
          chainId: "",
          namespaceOperation: namespaceResult?.operation,
          validation: validationResult,
        };
      }

      // Prepare enhanced deployment options
      const enhancedOptions = await this.prepareDeploymentOptions(contractName, options);

      // Execute deployment
      const baseResult = await this.deployContract(contractName, enhancedOptions);

      // Create enhanced result
      const enhancedResult: AdvancedDeployResult = {
        ...(baseResult as DeployResult),
        namespaceOperation: namespaceResult?.operation,
        validation: validationResult,
      };

      // Run post-deployment hook
      if (options.hooks?.postDeploy) {
        await options.hooks.postDeploy(contractName, enhancedResult);
      }

      logger.success(`✅ Enhanced deployment of ${contractName} completed successfully`);
      return enhancedResult;
    } catch (error) {
      logger.error(`❌ Enhanced deployment of ${contractName} failed:`, error);

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
      options?: AdvancedDeploymentOptions;
    }>,
    globalOptions: AdvancedDeploymentOptions = {},
  ): Promise<AdvancedDeployResult[]> {
    logger.info(`🚀 Starting batch deployment of ${contracts.length} contracts`);

    // Build dependency graph and get deployment order
    const deploymentOrder = this.resolveDependencyOrder(contracts);
    logger.info(`📋 Deployment order: ${deploymentOrder.map((c) => c.name).join(" → ")}`);

    const results: AdvancedDeployResult[] = [];
    const failed: Array<{ name: string; error: Error }> = [];

    for (const contract of deploymentOrder) {
      try {
        const mergedOptions = { ...globalOptions, ...contract.options };
        const result = await this.deploy(contract.name, mergedOptions);
        results.push(result);
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
   * Handle namespace requirements for contract deployment
   */
  private async handleNamespaceRequirements(
    contractName: string,
    options: AdvancedDeploymentOptions,
  ): Promise<{ detection: any; operation?: any } | undefined> {
    if (!options.namespaceHandling || options.namespaceHandling.skipNamespaceHandling) {
      return undefined;
    }

    const contractPath = this.getContractPath(contractName);

    logger.info(`🔍 Analyzing namespace requirements for ${contractName}`);

    const result = await this.namespaceHandler.analyzeAndHandleContract(contractPath, options.namespaceHandling);

    if (result.operation?.created) {
      logger.success(`✅ Namespace ${result.detection.namespaceName} created successfully`);
    } else if (result.operation?.existed) {
      logger.info(`ℹ️ Namespace ${result.detection.namespaceName} already exists`);
    }

    return result;
  }

  /**
   * Validate contract before deployment
   */
  private async validateContract(
    contractName: string,
    _options: AdvancedDeploymentOptions,
  ): Promise<{ passed: boolean; issues: string[] }> {
    logger.info(`🔍 Validating contract ${contractName}`);

    const issues: string[] = [];
    const contractSource = await this.loadContractSource(contractName);

    // Basic syntax validation
    if (!contractSource.includes("(module ")) {
      issues.push("No module definition found");
    }

    const passed = issues.length === 0;

    if (passed) {
      logger.success(`✅ Contract ${contractName} validation passed`);
    } else {
      logger.warn(`⚠️ Contract ${contractName} validation found issues: ${issues.join(", ")}`);
    }

    return { passed, issues };
  }

  /**
   * Prepare deployment options with wallet integration
   */
  private async prepareDeploymentOptions(
    contractName: string,
    options: AdvancedDeploymentOptions,
  ): Promise<DeploymentOptions> {
    const signer = this.walletManager.getCurrentSigner();
    if (!signer) {
      throw new Error("No signer configured");
    }

    // Merge init data with environment-specific data
    const data = {
      ...options.initData,
      ...options.environment,
      ...options.data,
    };

    return {
      ...options,
      from: options.from || signer.account,
      data,
    };
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
    return resolve(this.contractsDir, `${contractName}.pact`);
  }

  /**
   * Generate explorer URL for transaction
   */
  private generateExplorerUrl(transactionHash: string): string {
    // This would be configured based on the network
    const baseUrl = "https://explorer.chainweb.com"; // Example
    return `${baseUrl}/tx/${transactionHash}`;
  }

  // Base deployment methods (previously in DeploymentHelper)

  /**
   * Deploy a contract to the blockchain (single or multi-chain)
   */
  async deployContract(
    contractName: string,
    options: DeploymentOptions = {},
  ): Promise<DeployResult | MultiChainDeployResult> {
    // Determine target chains
    const targetChains = this.getTargetChains(options);

    if (targetChains.length === 1) {
      // Single chain deployment
      return this.deploySingleChain(contractName, options, targetChains[0]);
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

    logger.info(`Deploying ${contractName} to chain ${chainId}...`);

    try {
      // Load contract source
      const contractInfo = await this.loadContract(contractName);

      // Debug: Log the client's network configuration
      const clientNetworkConfig = this.client.getNetworkConfig();
      logger.debug(`Deployment network config:`, {
        networkId: clientNetworkConfig?.networkId,
        chainId,
        rpcUrl: clientNetworkConfig?.rpcUrl,
        type: clientNetworkConfig?.type,
      });

      if (clientNetworkConfig?.rpcUrl) {
        logger.debug(`Deployment RPC URL:`, clientNetworkConfig.rpcUrl);
      }

      // Log the actual transaction being built
      logger.debug(
        `Building transaction for chain ${chainId} with sender ${options.from || clientNetworkConfig.senderAccount}`,
      );

      // Get network configuration
      const networkConfig = this.config.networks?.[this.network];
      if (!networkConfig) {
        throw new Error(`Network ${this.network} not found in configuration`);
      }

      // Get the sender account - use current signer if available
      const signer = this.walletManager.getCurrentSigner();
      const senderAccount = options.from || signer?.account || networkConfig.senderAccount || "sender00";

      logger.debug(`Using sender account: ${senderAccount}`);

      // Prepare deployment transaction
      const deployTx = this.client
        .execution(contractInfo.source)
        .withChainId(chainId as any)
        .withMeta({
          gasLimit: options.gasLimit || 100000,
          gasPrice: options.gasPrice || 0.00001,
          sender: senderAccount,
        })
        .withDataMap(options.data || {});

      // Add signer and sign the transaction
      const wallet = this.walletManager.getWallet();
      let result: any;

      if (wallet && signer) {
        // Add signer with GAS capability
        const signedTx = deployTx.withSigner(signer.publicKey, (signFor) => [signFor("coin.GAS")]).sign(wallet);

        // Execute deployment
        result = await signedTx.submitAndListen(chainId as any);
      } else {
        // Fallback to unsigned transaction (will fail on mainnet/testnet)
        logger.warn("No wallet available for signing, attempting unsigned deployment");
        result = await deployTx.build().submitAndListen(chainId as any);
      }

      // For Pact deployment, the result is typically the module name or success indicator
      const deployResult: DeployResult = {
        contractName,
        transactionHash: result?.requestKey || `${contractName}-${chainId}-${Date.now()}`,
        deployedAt: new Date(),
        chainId,
      };

      logger.success(`Deployed ${contractName} to chain ${chainId}`);
      return deployResult;
    } catch (error) {
      logger.error(`Failed to deploy ${contractName} to chain ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Deploy a contract to multiple chains
   */
  private async deployMultiChain(
    contractName: string,
    options: DeploymentOptions,
    chainIds: string[],
  ): Promise<MultiChainDeployResult> {
    logger.info(`Deploying ${contractName} to ${chainIds.length} chains: ${chainIds.join(", ")}`);

    const results: DeployResult[] = [];
    const failed: Array<{ chainId: string; error: string }> = [];
    const startTime = new Date();

    try {
      // Load contract source once
      const contractInfo = await this.loadContract(contractName);
      const networkConfig = this.config.networks?.[this.network];
      if (!networkConfig) {
        throw new Error(`Network ${this.network} not found in configuration`);
      }

      // Get the sender account - use current signer if available
      const signer = this.walletManager.getCurrentSigner();
      const senderAccount = options.from || signer?.account || networkConfig.senderAccount || "sender00";

      // Prepare the transaction builder
      const deployTx = this.client
        .execution(contractInfo.source)
        .withMeta({
          gasLimit: options.gasLimit || 100000,
          gasPrice: options.gasPrice || 0.00001,
          sender: senderAccount,
        })
        .withDataMap(options.data || {});

      // Add signer and sign the transaction
      const wallet = this.walletManager.getWallet();
      let multiResults: any;

      if (wallet && signer) {
        // Add signer with GAS capability
        const signedTx = deployTx.withSigner(signer.publicKey, (signFor) => [signFor("coin.GAS")]).sign(wallet);

        multiResults = await signedTx.submitAndListen(chainIds as any);
      } else {
        // Fallback to unsigned transaction (will fail on mainnet/testnet)
        logger.warn("No wallet available for signing, attempting unsigned deployment");
        multiResults = await deployTx.build().submitAndListen(chainIds as any);
      }

      // Deploy to all chains simultaneously using the client's multi-chain support
      try {
        // Process results - this will be an array of results matching chainIds order
        if (Array.isArray(multiResults)) {
          for (let i = 0; i < chainIds.length; i++) {
            const chainId = chainIds[i];
            const result = multiResults[i];

            try {
              results.push({
                contractName,
                transactionHash: result?.requestKey || `${contractName}-${chainId}-${Date.now()}`,
                deployedAt: new Date(),
                chainId,
              });
              logger.success(`✅ Deployed ${contractName} to chain ${chainId}`);
            } catch (error) {
              failed.push({
                chainId,
                error: error instanceof Error ? error.message : String(error),
              });
              logger.error(`❌ Failed to deploy ${contractName} to chain ${chainId}: ${error}`);
            }
          }
        }
      } catch (error) {
        // If multi-chain deployment fails entirely, fall back to sequential deployment
        logger.warn(`Multi-chain deployment failed, falling back to sequential: ${error}`);
        return this.deploySequential(contractName, options, chainIds);
      }
    } catch (error) {
      logger.error(`Failed to prepare multi-chain deployment for ${contractName}:`, error);
      throw error;
    }

    const result: MultiChainDeployResult = {
      contractName,
      deployedAt: startTime,
      results,
      failed,
      totalChains: chainIds.length,
      successfulChains: results.length,
    };

    if (failed.length > 0) {
      logger.warn(`⚠️ ${contractName} deployment completed with ${failed.length} failures`);
    } else {
      logger.success(`✅ ${contractName} deployed successfully to all ${chainIds.length} chains`);
    }

    return result;
  }

  /**
   * Fallback: Deploy to chains sequentially
   */
  private async deploySequential(
    contractName: string,
    options: DeploymentOptions,
    chainIds: string[],
  ): Promise<MultiChainDeployResult> {
    const results: DeployResult[] = [];
    const failed: Array<{ chainId: string; error: string }> = [];
    const startTime = new Date();

    for (const chainId of chainIds) {
      try {
        const result = await this.deploySingleChain(contractName, options, chainId);
        results.push(result);
      } catch (error) {
        failed.push({
          chainId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      contractName,
      deployedAt: startTime,
      results,
      failed,
      totalChains: chainIds.length,
      successfulChains: results.length,
    };
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
    const networkConfig = this.config.networks?.[this.network];
    if (!networkConfig) {
      throw new Error(`Network ${this.network} not found in configuration`);
    }

    return [networkConfig.meta.chainId.toString()];
  }

  /**
   * Check if a contract is deployed on the blockchain
   */
  async isDeployed(contractName: string, chainId?: string): Promise<boolean> {
    try {
      const networkConfig = this.config.networks?.[this.network];
      if (!networkConfig) {
        return false;
      }

      const targetChainId = chainId || networkConfig.meta.chainId;

      // First try to list modules to see if our module exists
      // This is more reliable than describe-module which might have permissions issues
      const listQuery = this.client.execution("(list-modules)").withChainId(targetChainId as any);

      const modules = (await listQuery.build().dirtyRead()) as string[];

      // Check if our contract name is in the module list
      if (Array.isArray(modules) && modules.includes(contractName)) {
        return true;
      }

      // Fallback: try to describe the module
      const describeQuery = this.client
        .execution(`(describe-module "${contractName}")`)
        .withChainId(targetChainId as any);

      await describeQuery.build().dirtyRead();
      return true;
    } catch (error) {
      // If both methods fail, module doesn't exist
      logger.debug(`Contract ${contractName} not found on chain: ${error}`);
      return false;
    }
  }

  /**
   * Resolve dependency order using simple topological sort
   */
  private resolveDependencyOrder(
    contracts: Array<{ name: string; options?: AdvancedDeploymentOptions }>,
  ): Array<{ name: string; options?: AdvancedDeploymentOptions }> {
    const result: Array<{ name: string; options?: AdvancedDeploymentOptions }> = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const contractMap = new Map(contracts.map((c) => [c.name, c]));

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
    ];
    return builtinModules.includes(moduleName) || moduleName.startsWith("free.");
  }

  /**
   * Auto-detect and add dependencies to deployment options
   */
  async autoDetectDependencies(
    contracts: Array<{ name: string; options?: AdvancedDeploymentOptions }>,
  ): Promise<Array<{ name: string; options: AdvancedDeploymentOptions }>> {
    const enhanced = [];

    for (const contract of contracts) {
      const detectedDeps = await this.analyzeDependencies(contract.name);
      const explicitDeps = contract.options?.dependencies || [];

      // Merge explicit and detected dependencies, removing duplicates
      const allDeps = [...new Set([...explicitDeps, ...detectedDeps])];

      enhanced.push({
        name: contract.name,
        options: {
          ...contract.options,
          dependencies: allDeps,
        },
      });
    }

    return enhanced;
  }

  /**
   * Check if contract is deployed on multiple chains
   */
  async isDeployedOnChains(contractName: string, chainIds: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Check all chains in parallel
    const checks = chainIds.map(async (chainId) => {
      const deployed = await this.isDeployed(contractName, chainId);
      return { chainId, deployed };
    });

    const deploymentStatus = await Promise.all(checks);

    for (const { chainId, deployed } of deploymentStatus) {
      results[chainId] = deployed;
    }

    return results;
  }

  /**
   * Deploy to all Kadena chains (0-19)
   */
  async deployToAllChains(
    contractName: string,
    options: Omit<DeploymentOptions, "deployToAllChains" | "chains"> = {},
  ): Promise<MultiChainDeployResult> {
    return this.deployContract(contractName, {
      ...options,
      deployToAllChains: true,
    }) as Promise<MultiChainDeployResult>;
  }

  /**
   * Deploy to specific chains
   */
  async deployToChains(
    contractName: string,
    chainIds: string[],
    options: Omit<DeploymentOptions, "deployToAllChains" | "chains"> = {},
  ): Promise<MultiChainDeployResult> {
    return this.deployContract(contractName, {
      ...options,
      chains: chainIds,
    }) as Promise<MultiChainDeployResult>;
  }

  /**
   * Call a contract function (read-only)
   */
  async call(
    contractName: string,
    functionName: string,
    args: any[] = [],
    options: {
      chainId?: string;
      blockHeight?: number;
    } = {},
  ): Promise<any> {
    if (!(await this.isDeployed(contractName))) {
      throw new Error(`Contract ${contractName} not deployed`);
    }

    const networkConfig = this.config.networks?.[this.network];
    if (!networkConfig) {
      throw new Error(`Network ${this.network} not found in configuration`);
    }

    const fullFunctionName = `(${contractName}.${functionName}${args.length > 0 ? " " + args.map((arg) => JSON.stringify(arg)).join(" ") : ""})`;

    let query = this.client
      .execution(fullFunctionName)
      .withChainId((options.chainId || networkConfig.meta.chainId) as any);

    const result = await query.build().dirtyRead();
    return result;
  }

  // Private helper methods

  private async loadContract(contractName: string): Promise<ContractInfo> {
    const contractPath = resolve(this.contractsDir, `${contractName}.pact`);

    if (!existsSync(contractPath)) {
      throw new Error(`Contract file not found: ${contractPath}`);
    }

    const source = await readFile(contractPath, "utf-8");

    return {
      name: contractName,
      source,
    };
  }

  private async waitForConfirmations(requestKey: string, confirmations: number, timeout = 300000): Promise<void> {
    logger.info(`Waiting for ${confirmations} confirmations...`);

    const startTime = Date.now();
    let currentConfirmations = 1;

    while (currentConfirmations < confirmations) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for confirmations`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      try {
        currentConfirmations++;
        logger.debug(`Confirmations: ${currentConfirmations}/${confirmations}`);
      } catch (error) {
        logger.warn(`Error checking confirmations: ${error}`);
      }
    }

    logger.success(`Received ${confirmations} confirmations`);
  }
}

/**
 * Create a deployment helper instance
 */
export function createDeploymentHelper(
  client: PactToolboxClient,
  config: PactToolboxConfigObj,
  network: string,
  walletManager: WalletManager,
  namespaceHandler: NamespaceHandler,
  options?: {
    contractsDir?: string;
  },
): DeploymentHelper {
  return new DeploymentHelper(client, config, network, walletManager, namespaceHandler, options);
}

/**
 * Create default enhanced deployment options
 */
export function createDefaultAdvancedDeploymentOptions(
  overrides: Partial<AdvancedDeploymentOptions> = {},
): AdvancedDeploymentOptions {
  return {
    gasLimit: 100000,
    gasPrice: 0.00001,
    skipIfAlreadyDeployed: false,
    validate: true,
    verify: false,
    migrationStrategy: "replace",
    namespaceHandling: {
      autoCreate: true,
      interactive: false,
      chainId: "0",
    },
    ...overrides,
  };
}

/**
 * Utility to deploy contracts with automatic dependency resolution
 */
export async function deployWithDependencies(
  deploymentHelper: DeploymentHelper,
  contracts: Array<{ name: string; options?: AdvancedDeploymentOptions }>,
  options: {
    autoDetect?: boolean;
    globalOptions?: AdvancedDeploymentOptions;
  } = {},
): Promise<AdvancedDeployResult[]> {
  let contractsToDeploy = contracts;

  // Auto-detect dependencies if requested
  if (options.autoDetect) {
    logger.info("🔍 Auto-detecting contract dependencies...");
    contractsToDeploy = await deploymentHelper.autoDetectDependencies(contracts);
  }

  // Deploy with dependency resolution
  return deploymentHelper.deployMany(contractsToDeploy, options.globalOptions);
}
