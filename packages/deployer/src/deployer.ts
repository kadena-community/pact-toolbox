import { getSerializableMultiNetworkConfig, type PactToolboxConfigObj } from "@pact-toolbox/config";
import { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { existsSync, logger, readFile } from "@pact-toolbox/node-utils";
import type { INetworkProvider } from "@pact-toolbox/types";
import { resolve } from "pathe";

// Base deployment interfaces and types
export interface DeploymentOptions {
  gasLimit?: number;
  gasPrice?: number;
  data?: Record<string, any>;
  skipIfAlreadyDeployed?: boolean;
  tags?: string[];
  dependencies?: string[];
  /** Deploy to specific chains. If not provided, uses network default */
  chains?: string[];
  /** Deploy to all chains (0-19) */
  deployToAllChains?: boolean;
  /** Transaction sender account */
  from?: string;

  /** Deployment hooks */
  hooks?: {
    preDeploy?: (contractName: string, source: string) => Promise<void>;
    postDeploy?: (contractName: string, result: DeployResult | MultiChainDeployResult) => Promise<void>;
    onError?: (contractName: string, error: Error) => Promise<void>;
  };
  /** Environment-specific configuration */
  environment?: Record<string, any>;
  /** Contract initialization data */
  initData?: Record<string, any>;
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

/**
 * Modern deployment helper using dependency injection
 */
export class DeploymentHelper {
  private config: PactToolboxConfigObj;
  private network: string;
  private contractsDir: string;
  #networkProvider: INetworkProvider;

  constructor(config: PactToolboxConfigObj, network: string) {
    this.config = config;
    this.network = network;
    this.contractsDir = config.contractsDir || "./pact";
    this.#networkProvider = NetworkConfigProvider.getInstance(getSerializableMultiNetworkConfig(config));
  }

  /**
   * Deploy a contract
   */
  async deploy(contractName: string, options: DeploymentOptions = {}): Promise<DeployResult> {
    logger.info(`🚀 Starting deployment of ${contractName}`);

    try {
      // Run pre-deployment hook
      if (options.hooks?.preDeploy) {
        const contractSource = await this.loadContractSource(contractName);
        await options.hooks.preDeploy(contractName, contractSource);
      }

      // Check if contract already exists
      if (options.skipIfAlreadyDeployed && (await this.isDeployed(contractName))) {
        logger.warn(`Contract ${contractName} already deployed, skipping`);
        return {
          contractName,
          transactionHash: "",
          deployedAt: new Date(),
          chainId: "",
        };
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
    const deploymentOrder = this.resolveDependencyOrder(contracts);
    logger.info(`📋 Deployment order: ${deploymentOrder.map((c) => c.name).join(" → ")}`);

    const results: DeployResult[] = [];
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
      const networkConfig = this.networkProvider.getCurrentNetwork();

      // Prepare deployment options
      const deployOptions: any = {
        builder: {
          chainId,
          senderAccount: options.from || networkConfig.senderAccount,
          data: options.data || {},
        },
        listen: true,
      };

      // Deploy the contract
      const result = await this.client.deploy(this.getContractPath(contractName), deployOptions);

      const deployResult: DeployResult = {
        contractName,
        transactionHash: result.requestKey,
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
    const networkConfig = this.networkProvider.getCurrentNetwork();
    return [networkConfig.meta.chainId.toString()];
  }

  /**
   * Check if a contract is deployed on the blockchain
   */
  async isDeployed(contractName: string, chainId?: string): Promise<boolean> {
    try {
      const networkConfig = this.networkProvider.getCurrentNetwork();
      const targetChainId = chainId || networkConfig.meta.chainId;

      // Try to describe the module
      const describeQuery = this.client
        .execution(`(describe-module "${contractName}")`)
        .withChainId(targetChainId as any);

      await describeQuery.build().dirtyRead();
      return true;
    } catch (error) {
      // If describe fails, module doesn't exist
      logger.debug(`Contract ${contractName} not found on chain: ${error}`);
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
    return resolve(this.contractsDir, `${contractName}.pact`);
  }

  /**
   * Load contract info
   */
  private async loadContract(contractName: string): Promise<ContractInfo> {
    const source = await this.loadContractSource(contractName);
    return {
      name: contractName,
      source,
    };
  }

  /**
   * Resolve dependency order using topological sort
   */
  private resolveDependencyOrder(
    contracts: Array<{ name: string; options?: DeploymentOptions }>,
  ): Array<{ name: string; options?: DeploymentOptions }> {
    const result: Array<{ name: string; options?: DeploymentOptions }> = [];
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
}

/**
 * Create a deployment helper instance
 */
export function createDeploymentHelper(
  client: PactToolboxClient,
  config: PactToolboxConfigObj,
  network: string,
  options?: {
    contractsDir?: string;
  },
): DeploymentHelper {
  return new DeploymentHelper(client, config, network, options);
}
