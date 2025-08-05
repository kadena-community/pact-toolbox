import { execution } from "@pact-toolbox/transaction";
import type { PactKeyset, ChainId, PactTransactionResult } from "@pact-toolbox/types";
import { blake2b } from "@pact-toolbox/crypto";
import { validatePrincipalKeyset } from "./pact";

/**
 * Options for creating a principal namespace
 */
export interface CreatePrincipalNamespaceOptions {
  /** The admin keyset that will control the namespace */
  adminKeyset: PactKeyset;
  /** The user keyset that can define modules (defaults to adminKeyset if not provided) */
  userKeyset?: PactKeyset;
  /** Optional namespace description */
  description?: string;
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
 * Result of namespace operations
 */
export interface NamespaceResult {
  /** The namespace name */
  namespace: string;
  /** Operation status */
  status: "success" | "error";
  /** Transaction result */
  result?: PactTransactionResult;
  /** Error message if status is error */
  error?: string;
}

/**
 * Create a principal namespace from a keyset
 * Note: This is a specialized function for principal namespaces
 */
export async function createPrincipalNamespace(options: CreatePrincipalNamespaceOptions): Promise<NamespaceResult> {
  const { adminKeyset, userKeyset, description, chainId, gasLimit, gasPrice, ttl } = options;
  const resolvedChainId = chainId || "0";

  // Validate the keyset
  if (!validatePrincipalKeyset(adminKeyset)) {
    return {
      namespace: "",
      status: "error",
      error: "Invalid principal keyset",
    };
  }

  // Generate namespace from keyset
  const namespace = generatePrincipalNamespace(adminKeyset);

  try {
    const result = await execution(`(define-namespace "${namespace}" (read-keyset 'ns-admin) (read-keyset 'ns-user))`)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: "sender00",
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("ns-admin", adminKeyset)
      .withKeyset("ns-user", userKeyset || adminKeyset)
      .build()
      .submit();

    return {
      namespace,
      status: "success",
      result,
    };
  } catch (error) {
    return {
      namespace,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate a principal namespace from a keyset
 */
function generatePrincipalNamespace(keyset: PactKeyset): string {
  // Normalize keyset for hashing
  const normalized = JSON.stringify({
    keys: keyset.keys.sort(),
    pred: keyset.pred,
  });

  // Hash the keyset
  const hash = blake2b(normalized, 32);

  // Create principal namespace (first 16 chars of hex hash)
  return `n_${hash.slice(0, 16)}`;
}
