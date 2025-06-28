import type { PactToolboxClient } from "@pact-toolbox/runtime";
import type { PactKeyset } from "@pact-toolbox/types";
import { NamespaceService, pact } from "@pact-toolbox/kda";
import { logger, readFile } from "@pact-toolbox/node-utils";
import type { WalletManager } from "./wallet-manager";

export interface NamespaceDetectionResult {
  /** Whether the contract uses a namespace */
  hasNamespace: boolean;
  /** The namespace name if detected */
  namespaceName?: string;
  /** Whether it's a principal namespace */
  isPrincipal: boolean;
  /** Suggested keyset for principal namespace creation */
  suggestedKeyset?: PactKeyset;
  /** Detected module name */
  moduleName?: string;
  /** Full module path (namespace.module) */
  fullModuleName?: string;
}

export interface NamespaceHandlingOptions {
  /** Auto-create namespace if it doesn't exist */
  autoCreate?: boolean;
  /** Keyset to use for namespace creation */
  adminKeyset?: PactKeyset;
  /** User keyset for namespace governance */
  userKeyset?: PactKeyset;
  /** Whether to prompt user for namespace handling decisions */
  interactive?: boolean;
  /** Chain ID for namespace operations */
  chainId?: string;
  /** Skip namespace handling entirely */
  skipNamespaceHandling?: boolean;
  /** Force namespace creation even if it exists */
  forceCreate?: boolean;
}

export interface NamespaceOperationResult {
  /** Whether namespace was created */
  created: boolean;
  /** Whether namespace already existed */
  existed: boolean;
  /** The namespace name */
  namespaceName: string;
  /** Transaction hash if namespace was created */
  transactionHash?: string;
  /** Error message if operation failed */
  error?: string;
}

export class NamespaceHandler {
  private client: PactToolboxClient;
  private walletManager: WalletManager;
  private namespaceService: NamespaceService;

  constructor(client: PactToolboxClient, walletManager: WalletManager, chainId: string = "0") {
    this.client = client;
    this.walletManager = walletManager;
    
    const wallet = walletManager.getWallet();
    if (!wallet) {
      throw new Error("Wallet manager must be initialized before creating namespace handler");
    }

    this.namespaceService = new NamespaceService({
      context: client.getContext(),
      defaultChainId: chainId as any
    });
  }

  /**
   * Analyze contract source code to detect namespace usage
   */
  async analyzeContract(contractSource: string): Promise<NamespaceDetectionResult> {
    logger.debug("Analyzing contract for namespace usage");

    const result: NamespaceDetectionResult = {
      hasNamespace: false,
      isPrincipal: false
    };

    // Extract module definition
    const moduleMatch = contractSource.match(/\(module\s+([^\s)]+)/);
    if (!moduleMatch) {
      logger.warn("No module definition found in contract");
      return result;
    }

    const fullModuleName = moduleMatch[1];
    result.fullModuleName = fullModuleName;

    // Check if module uses namespace
    const namespaceParts = fullModuleName.split('.');
    if (namespaceParts.length > 1) {
      result.hasNamespace = true;
      result.namespaceName = namespaceParts[0];
      result.moduleName = namespaceParts[1];
      result.isPrincipal = pact.isPrincipalNamespace(result.namespaceName);

      logger.info(`Detected namespace: ${result.namespaceName} (principal: ${result.isPrincipal})`);

      // If it's a principal namespace, try to extract the keyset
      if (result.isPrincipal) {
        result.suggestedKeyset = this.extractKeysetFromContract(contractSource);
      }
    } else {
      result.moduleName = fullModuleName;
      logger.debug("Contract does not use namespace");
    }

    return result;
  }

  /**
   * Analyze contract file and handle namespace requirements
   */
  async analyzeAndHandleContract(
    contractPath: string,
    options: NamespaceHandlingOptions = {}
  ): Promise<{
    detection: NamespaceDetectionResult;
    operation?: NamespaceOperationResult;
    updatedSource?: string;
  }> {
    const contractSource = await readFile(contractPath, 'utf-8');
    const detection = await this.analyzeContract(contractSource);

    if (options.skipNamespaceHandling || !detection.hasNamespace) {
      return { detection };
    }

    // Handle namespace creation if needed
    const operation = await this.handleNamespaceCreation(detection, options);
    
    // Update contract source if namespace was modified
    let updatedSource: string | undefined;
    if (operation?.created && options.autoCreate) {
      updatedSource = await this.updateContractNamespace(contractSource, detection, operation);
    }

    return { detection, operation, updatedSource };
  }

  /**
   * Handle namespace creation based on detection results
   */
  async handleNamespaceCreation(
    detection: NamespaceDetectionResult,
    options: NamespaceHandlingOptions
  ): Promise<NamespaceOperationResult | undefined> {
    if (!detection.hasNamespace || !detection.namespaceName) {
      return undefined;
    }

    const namespaceName = detection.namespaceName;

    // Check if namespace already exists
    const exists = await this.checkNamespaceExists(namespaceName, options.chainId);
    
    if (exists && !options.forceCreate) {
      logger.info(`Namespace ${namespaceName} already exists`);
      return {
        created: false,
        existed: true,
        namespaceName
      };
    }

    if (!options.autoCreate) {
      logger.warn(`Namespace ${namespaceName} does not exist and autoCreate is disabled`);
      return {
        created: false,
        existed: false,
        namespaceName,
        error: "Namespace does not exist and autoCreate is disabled"
      };
    }

    // Handle principal namespace creation
    if (detection.isPrincipal) {
      return this.createPrincipalNamespace(detection, options);
    } else {
      logger.error("Non-principal namespace creation not yet supported");
      return {
        created: false,
        existed: false,
        namespaceName,
        error: "Non-principal namespace creation not yet supported"
      };
    }
  }

  /**
   * Create a principal namespace
   */
  private async createPrincipalNamespace(
    detection: NamespaceDetectionResult,
    options: NamespaceHandlingOptions
  ): Promise<NamespaceOperationResult> {
    const namespaceName = detection.namespaceName!;
    
    logger.info(`Creating principal namespace: ${namespaceName}`);

    try {
      // Determine keyset to use
      const adminKeyset = options.adminKeyset || 
                         detection.suggestedKeyset || 
                         this.getCurrentSignerKeyset();

      if (!adminKeyset) {
        throw new Error("No admin keyset available for namespace creation");
      }

      // Validate that the keyset matches the namespace
      const expectedNamespace = this.namespaceService.generatePrincipalNamespace(adminKeyset);
      if (expectedNamespace !== namespaceName) {
        throw new Error(
          `Keyset does not match expected namespace. ` +
          `Expected: ${expectedNamespace}, Got: ${namespaceName}`
        );
      }

      // Create the namespace
      const result = await this.namespaceService.createPrincipalNamespace({
        adminKeyset,
        userKeyset: options.userKeyset,
        chainId: options.chainId as any
      });

      if (result.status === "success") {
        logger.success(`Principal namespace ${namespaceName} created successfully`);
        return {
          created: true,
          existed: false,
          namespaceName,
          transactionHash: (result.transaction as any)?.requestKey
        };
      } else {
        throw new Error(result.error || "Unknown error creating namespace");
      }

    } catch (error) {
      logger.error(`Failed to create principal namespace ${namespaceName}:`, error);
      return {
        created: false,
        existed: false,
        namespaceName,
        error: (error as Error).message
      };
    }
  }

  /**
   * Check if a namespace exists on the blockchain
   */
  private async checkNamespaceExists(namespaceName: string, chainId?: string): Promise<boolean> {
    try {
      // Try to query the namespace
      const query = this.client.execution(`(describe-namespace "${namespaceName}")`)
        .withChainId((chainId || "0") as any);

      await query.build().dirtyRead();
      return true;
    } catch {
      // If query fails, namespace likely doesn't exist
      return false;
    }
  }

  /**
   * Extract keyset information from contract source
   */
  private extractKeysetFromContract(contractSource: string): PactKeyset | undefined {
    // Look for keyset definitions in the contract
    const keysetPatterns = [
      /\(define-keyset\s+"[^"]*"\s*\(read-keyset\s+"([^"]+)"\)\)/,
      /\(read-keyset\s+"([^"]+)"\)/,
      /"[^"]*keyset":\s*\{\s*"keys":\s*\[([^\]]+)\],\s*"pred":\s*"([^"]+)"/
    ];

    for (const pattern of keysetPatterns) {
      const match = contractSource.match(pattern);
      if (match) {
        // This is a simplified extraction - in reality, we'd need more sophisticated parsing
        logger.debug("Found potential keyset reference in contract");
        break;
      }
    }

    // For now, return undefined - keyset should be provided explicitly
    return undefined;
  }

  /**
   * Get current signer's keyset
   */
  private getCurrentSignerKeyset(): PactKeyset | undefined {
    const signer = this.walletManager.getCurrentSigner();
    if (!signer) {
      return undefined;
    }

    return pact.createSingleKeyKeyset(signer.publicKey);
  }

  /**
   * Update contract source with correct namespace (not implemented)
   */
  private async updateContractNamespace(
    contractSource: string,
    _detection: NamespaceDetectionResult,
    _operation: NamespaceOperationResult
  ): Promise<string> {
    // Source transformation is complex and not needed for basic deployment
    // Users should ensure their contracts have correct namespace references
    logger.debug("Contract source transformation is not supported - ensure contracts have correct namespace references");
    return contractSource;
  }

  /**
   * Generate a principal namespace for the current signer
   */
  generateNamespaceForCurrentSigner(): string | null {
    const signer = this.walletManager.getCurrentSigner();
    if (!signer) {
      return null;
    }

    const keyset = pact.createSingleKeyKeyset(signer.publicKey);
    return this.namespaceService.generatePrincipalNamespace(keyset);
  }

  /**
   * Interactive namespace setup
   */
  async interactiveNamespaceSetup(_contractPath: string): Promise<NamespaceHandlingOptions> {
    const { select, isCancel, confirm } = await import("@pact-toolbox/node-utils");
    
    logger.info("🔧 Interactive namespace setup");

    const action = await select({
      message: 'How would you like to handle namespaces?',
      options: [
        { value: 'auto', label: 'Auto-create namespaces if needed' },
        { value: 'skip', label: 'Skip namespace handling' },
        { value: 'manual', label: 'Manual namespace configuration' }
      ]
    });

    if (isCancel(action)) {
      throw new Error("Namespace setup cancelled");
    }

    const options: NamespaceHandlingOptions = {
      interactive: true
    };

    switch (action) {
      case 'skip':
        options.skipNamespaceHandling = true;
        break;
        
      case 'auto':
        options.autoCreate = true;
        
        const useCurrentSigner = await confirm({
          message: 'Use current signer keyset for namespace creation?'
        });
        
        if (!isCancel(useCurrentSigner) && useCurrentSigner) {
          options.adminKeyset = this.getCurrentSignerKeyset();
        }
        break;
        
      case 'manual':
        logger.info("Manual namespace configuration: Please configure namespaces manually in your contract or deployment options");
        break;
    }

    return options;
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    // Namespace handler doesn't maintain its own connections
    // Cleanup is handled by the wallet manager
  }
}

/**
 * Create a namespace handler instance
 */
export function createNamespaceHandler(
  client: PactToolboxClient,
  walletManager: WalletManager,
  chainId?: string
): NamespaceHandler {
  return new NamespaceHandler(client, walletManager, chainId);
}

/**
 * Utility to create default namespace handling options
 */
export function createDefaultNamespaceOptions(overrides: Partial<NamespaceHandlingOptions> = {}): NamespaceHandlingOptions {
  return {
    autoCreate: true,
    interactive: false,
    chainId: "0",
    skipNamespaceHandling: false,
    forceCreate: false,
    ...overrides
  };
}