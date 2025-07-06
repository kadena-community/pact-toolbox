// Export the legacy version for backward compatibility
export { NamespaceService, type NamespaceServiceConfig } from "./namespace-service-legacy";

// Export the new DI-based version
export { 
  NamespaceServiceDI, 
  createNamespaceService,
  type NamespaceServiceConfigDI,
  type NamespaceOperationOptions,
  type CreateNamespaceOptions,
  type RotateNamespaceOptions,
  type DefineModuleOptions,
  type DefineInterfaceOptions,
  type NamespaceInfo
} from "./namespace-service-di";

// Re-export the original types for backward compatibility
export type { CreatePrincipalNamespaceOptions, NamespaceResult } from "./namespace-service-principal";
  transaction?: PactTransactionResult;
  /** Error message if any */
  error?: string;
}

/**
 * Service for principal namespace operations on Kadena blockchain
 *
 * This service focuses specifically on creating principal namespaces,
 * which are autonomously defined namespaces derived from keysets.
 */
export class NamespaceService {
  private readonly config: NamespaceServiceConfig;

  constructor(config: NamespaceServiceConfig) {
    this.config = config;
  }

  /**
   * Generate a principal namespace name from a keyset (no blockchain interaction)
   */
  generatePrincipalNamespace(adminKeyset: PactKeyset): string {
    // Validate keyset
    if (!adminKeyset.keys || adminKeyset.keys.length === 0) {
      throw new Error("Admin keyset must have at least one key");
    }

    if (!adminKeyset.pred) {
      throw new Error("Admin keyset must have a predicate");
    }

    // Create canonical keyset representation for hashing
    const canonicalKeyset = {
      keys: [...adminKeyset.keys].sort(), // Sort keys for deterministic hashing
      pred: adminKeyset.pred,
    };

    // Serialize keyset for hashing
    const keysetStr = JSON.stringify(canonicalKeyset);
    const keysetBytes = new TextEncoder().encode(keysetStr);

    // Hash the keyset using Blake2b
    const hashBytes = blake2b(keysetBytes, undefined, 32);
    const hashHex = Array.from(hashBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

    // Return principal namespace with "n_" prefix
    return `n_${hashHex}`;
  }

  /**
   * Create and define a principal namespace in a single transaction
   */
  async createPrincipalNamespace(options: CreatePrincipalNamespaceOptions): Promise<NamespaceResult> {
    const { adminKeyset, userKeyset = adminKeyset, chainId, gasLimit, gasPrice, ttl } = options;
    const resolvedChainId = chainId || this.config.defaultChainId || "0";

    // Validate keysets
    if (!validatePrincipalKeyset(adminKeyset)) {
      return {
        namespace: "",
        status: "error",
        error: "Invalid admin keyset for principal namespace creation",
      };
    }

    if (!validatePrincipalKeyset(userKeyset)) {
      return {
        namespace: "",
        status: "error",
        error: "Invalid user keyset for principal namespace creation",
      };
    }

    // Generate the namespace name
    const namespaceName = this.generatePrincipalNamespace(adminKeyset);

    try {
      // Create the Pact code
      const pactCode = `(let* (
        (admin-keyset (read-keyset "admin-keyset"))
        (user-keyset (read-keyset "user-keyset"))
        (namespace-name (ns.create-principal-namespace admin-keyset))
      )
        (define-namespace namespace-name admin-keyset user-keyset)
        { "namespace": namespace-name, "status": "ready" })`;

      const transaction = (await execution(pactCode)
        .withChainId(resolvedChainId)
        .withContext(this.config.context)
        .withMeta({
          sender: "",
          gasLimit: gasLimit || 150000,
          gasPrice: gasPrice || 1e-8,
          ttl: ttl || 28800,
        })
        .withKeyset("admin-keyset", adminKeyset)
        .withKeyset("user-keyset", userKeyset)
        .sign()
        .submitAndListen()) as Promise<PactTransactionResult>;

      return {
        namespace: namespaceName,
        status: "success",
        transaction: await transaction,
      };
    } catch (error) {
      return {
        namespace: namespaceName,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
