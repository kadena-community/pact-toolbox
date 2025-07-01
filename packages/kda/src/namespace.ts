import { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { execution, getWallet } from "@pact-toolbox/transaction";
import type { PactKeyset, ChainId, WalletLike } from "@pact-toolbox/types";
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
  /** Custom wallet for this operation */
  wallet?: WalletLike;
  /** Network provider */
  networkProvider?: NetworkConfigProvider;
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
  result?: string;
  /** Error message if status is error */
  error?: string;
}

/**
 * Create a principal namespace from a keyset
 * Note: This is a specialized function for principal namespaces
 */
export async function createPrincipalNamespace(options: CreatePrincipalNamespaceOptions): Promise<NamespaceResult> {
  const { adminKeyset, userKeyset, chainId, gasLimit, gasPrice, ttl, wallet, networkProvider } = options;
  const resolvedChainId = chainId || "0";
  const provider = networkProvider || NetworkConfigProvider.getInstance();
  const networkConfig = provider.getNetwork();

  // Validate the keyset
  if (!validatePrincipalKeyset(adminKeyset)) {
    return {
      namespace: "",
      status: "error",
      error: "Invalid principal keyset",
    };
  }

  try {
    // Get the wallet for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for namespace creation");
    }

    const pactCode = `
      (let ((ns-name (ns.create-principal-namespace (read-keyset 'ns-admin))))
        (define-namespace
          ns-name
          (read-keyset 'ns-admin)
          (read-keyset 'ns-user)
        )
        (namespace ns-name)
        (define-keyset
          (format "{}.{}"
            [ns-name 'admin-keyset]
          )
          (read-keyset 'ns-admin)
        )
        ns-name
      )
    `;

    const result = await execution<string>(pactCode, provider)
      .withChainId(resolvedChainId)
      .withMeta({
        sender: operationSigner.address,
        gasLimit: gasLimit || 1500,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("ns-admin", adminKeyset)
      .withKeyset("ns-user", userKeyset || adminKeyset)
      .withSigner(operationSigner.publicKey, (withCapability) => [withCapability("coin.GAS")])
      .sign(walletLike)
      .submitAndListen();

    return {
      namespace: result, // The namespace name is returned from the transaction
      status: "success",
      result,
    };
  } catch (error) {
    return {
      namespace: "",
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a principal from a keyset (utility function)
 * This uses the same approach as kadena.js client-utils
 */
export async function createPrincipal(
  keyset: PactKeyset,
  options?: { chainId?: ChainId; networkProvider?: NetworkConfigProvider },
): Promise<string> {
  const chainId = options?.chainId || "0";
  const provider = options?.networkProvider || NetworkConfigProvider.getInstance();

  const result = await execution<string>(`(create-principal (read-keyset "ks"))`, provider)
    .withChainId(chainId)
    .withKeyset("ks", keyset)
    .build()
    .dirtyRead();

  return result;
}

/**
 * Define a regular namespace (non-principal)
 */
export async function defineNamespace(options: {
  namespace: string;
  adminKeyset: PactKeyset;
  userKeyset?: PactKeyset;
  chainId?: ChainId;
  gasLimit?: number;
  gasPrice?: number;
  ttl?: number;
  wallet?: WalletLike;
  networkProvider?: NetworkConfigProvider;
}): Promise<NamespaceResult> {
  const { namespace, adminKeyset, userKeyset, chainId, gasLimit, gasPrice, ttl, wallet, networkProvider } = options;
  const resolvedChainId = chainId || "0";
  const provider = networkProvider || NetworkConfigProvider.getInstance();
  const networkConfig = provider.getNetwork();

  try {
    // Get the wallet for this operation
    const walletLike = await getWallet(wallet);
    const operationSigner = await walletLike.getAccount(networkConfig.networkId);
    if (!operationSigner) {
      throw new Error("No signer available for namespace definition");
    }

    const result = await execution<string>(
      `(define-namespace "${namespace}" (read-keyset 'ns-admin) (read-keyset 'ns-user))`,
      provider,
    )
      .withChainId(resolvedChainId)
      .withMeta({
        sender: operationSigner.address,
        gasLimit: gasLimit || 1000,
        gasPrice: gasPrice || 0.000001,
        ttl: ttl || 28800,
      })
      .withKeyset("ns-admin", adminKeyset)
      .withKeyset("ns-user", userKeyset || adminKeyset)
      .withSigner(operationSigner.publicKey, (withCapability) => [withCapability("coin.GAS")])
      .sign(walletLike)
      .submitAndListen();

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
