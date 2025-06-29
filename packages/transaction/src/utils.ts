import type {
  KeyPair,
  MultiNetworkConfig,
  PactCapability,
  PactCapabilityLike,
  PactCmdPayload,
  PactCommand,
  PactContPayload,
  PactExecPayload,
  PactSignerLike,
  PactValue,
  PartiallySignedTransaction,
  SerializableNetworkConfig,
  Transaction,
} from "@pact-toolbox/types";

import { ChainwebClient } from "@pact-toolbox/chainweb-client";
import { blake2bBase64Url, fastStableStringify, genKeyPair } from "@pact-toolbox/crypto";
import type { Wallet } from "@pact-toolbox/wallet-core";

/**
 * Clock skew offset in seconds to prevent "Transaction creation time too far in the future" errors.
 * This accounts for potential time differences between the client and Kadena nodes.
 *
 * Kadena nodes validate that transaction creation time is not too far in the future
 * to prevent replay attacks. However, if the client's clock is ahead of the node's clock,
 * even legitimate transactions can be rejected. This offset ensures the transaction's
 * creation time is slightly in the past, accommodating reasonable clock differences.
 *
 * Default: 10 seconds - This should handle most common clock skew scenarios.
 */
export const CLOCK_SKEW_OFFSET_SECONDS = 10;

/**
 * Retrieves the account key from an account string.
 * @param account - The account string, possibly prefixed with "k:".
 * @returns The account key without the "k:" prefix.
 */
export function getKAccountKey(account: string): string {
  return account.startsWith("k:") ? account.slice(2) : account;
}

/**
 * Generates a new K-account with a key pair.
 * @returns An object containing the public key, secret key, and account string.
 */
export async function generateKAccount(): Promise<{
  publicKey: string;
  secretKey: string;
  account: string;
}> {
  const { publicKey, privateKey: secretKey } = await genKeyPair();
  return {
    publicKey,
    secretKey,
    account: `k:${publicKey}`,
  };
}

/**
 * Generates multiple K-accounts.
 * @param count - The number of K-accounts to generate (default is 10).
 * @returns An array of objects each containing the public key, secret key, and account string.
 */
export async function generateKAccounts(count: number = 10): Promise<
  {
    publicKey: string;
    secretKey: string;
    account: string;
  }[]
> {
  return Promise.all(Array.from({ length: count }, () => generateKAccount()));
}

/**
 * Creates a Pact decimal value.
 * @param amount - The amount as a string or number.
 * @returns An object containing the decimal string.
 */
export function pactDecimal(amount: string | number): {
  decimal: string;
} {
  return {
    decimal: "string" === typeof amount ? amount : amount.toFixed(12),
  };
}

export function isToolboxInstalled(): boolean {
  return !!(globalThis as any).__PACT_TOOLBOX_NETWORKS__ || !!(globalThis as any).__PACT_TOOLBOX_CONTEXT__;
}

export function getToolboxGlobalNetworkConfig(networkName?: string): SerializableNetworkConfig {
  const multiConfig = getToolboxGlobalMultiNetworkConfig();
  const targetNetwork = networkName || multiConfig.default;
  const networkConfig = multiConfig.configs[targetNetwork];

  if (!networkConfig) {
    throw new Error(`Network "${targetNetwork}" not found in configuration`);
  }

  return networkConfig;
}

export function getToolboxGlobalMultiNetworkConfig(strict?: boolean): MultiNetworkConfig {
  if (!isToolboxInstalled() && strict) {
    throw new Error("Make sure you are using the pact-toolbox bundler plugin, eg `@pact-toolbox/unplugin`");
  }

  // First check for build-time injected config (prioritize for tests and build-time config)
  const config = (globalThis as any).__PACT_TOOLBOX_NETWORKS__;
  if (config) {
    if ("string" === typeof config) {
      try {
        return JSON.parse(config);
      } catch {
        throw new Error("Found invalid multi-network config in globalThis");
      }
    }
    return config;
  }

  // Fallback: check if we have a context with network config
  const context = (globalThis as any).__PACT_TOOLBOX_CONTEXT__;
  if (context?.getNetworkConfig) {
    // Build a multi-network config from the current network context
    const networkConfig = context.getNetworkConfig();
    return {
      default: networkConfig.networkId,
      environment: networkConfig.environment || "development",
      configs: {
        [networkConfig.networkId]: networkConfig,
      },
    };
  }

  // Final fallback - return empty config
  return {
    default: "development",
    environment: "development",
    configs: {},
  };
}

export function validateNetworkForEnvironment(networkName: string): boolean {
  try {
    const multiConfig = getToolboxGlobalMultiNetworkConfig();
    const networkConfig = multiConfig.configs[networkName];

    if (!networkConfig) {
      return false;
    }

    // In production, ensure no local networks are accessible
    if (multiConfig.environment === "production") {
      const isLocal = networkConfig.type === "pact-server" || networkConfig.type === "chainweb-devnet";
      if (isLocal) {
        console.warn(`Network ${networkName} is not available in production environment`);
        return false;
      }

      // Ensure no private keys in production
      if (networkConfig.keyPairs && networkConfig.keyPairs.length > 0) {
        console.warn(`Network ${networkName} contains sensitive data in production`);
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function createChainwebClient(netWorkConfig: SerializableNetworkConfig): ChainwebClient {
  // Create a function that generates the RPC URL based on networkId and chainId
  const rpcUrl = (networkId: string, chainId: string) => {
    return netWorkConfig.rpcUrl.replace("{networkId}", networkId).replace("{chainId}", chainId);
  };

  return new ChainwebClient({
    networkId: netWorkConfig.networkId,
    chainId: netWorkConfig.meta.chainId || "0",
    rpcUrl,
  });
}

export function isPactExecPayload(payload: PactCmdPayload): payload is PactExecPayload {
  return "exec" in payload;
}

export function isPactContPayload(payload: PactCmdPayload): payload is PactContPayload {
  return "cont" in payload;
}

export function createPactCommandWithDefaults<Payload extends PactCmdPayload>(
  payload: Payload,
  networkConfig: SerializableNetworkConfig,
): PactCommand<Payload> {
  return {
    payload,
    meta: networkConfig.meta,
    signers: [],
    networkId: networkConfig.networkId,
    nonce: "",
  };
}

export function createTransaction<Payload extends PactCmdPayload>(
  cmd: PactCommand<Payload>,
): PartiallySignedTransaction {
  const defaultMeta = {
    gasLimit: 150000,
    gasPrice: 1e-8,
    sender: "",
    ttl: 15 * 60, // 15 minutes,
    // Subtract clock skew offset from current time to account for potential time differences between client and nodes
    creationTime: Math.floor(Date.now() / 1000) - CLOCK_SKEW_OFFSET_SECONDS,
  };

  cmd.nonce = `pact-toolbox:nonce:${Date.now()}`;
  cmd.signers = cmd.signers ?? [];
  cmd.meta = { ...defaultMeta, ...cmd.meta };
  if (cmd.payload && "cont" in cmd.payload) {
    cmd.payload.cont.proof ??= null;
  }
  const cmdStr = fastStableStringify(cmd);
  const tx: PartiallySignedTransaction = {
    cmd: cmdStr,
    hash: blake2bBase64Url(cmdStr),
    sigs: Array.from({
      length: cmd.signers.length ?? 0,
    }),
  };
  return tx;
}

export function updatePactCommandSigners<Payload extends PactCmdPayload>(
  cmd: PactCommand<Payload>,
  signer: PactSignerLike | PactSignerLike[],
  capability?: PactCapabilityLike,
): PactCommand<Payload> {
  const signers = Array.isArray(signer) ? signer : [signer];
  let clist: PactCapability[] | undefined;
  if ("function" === typeof capability) {
    clist = capability((name: string, ...args: PactValue[]) => ({
      name,
      args,
    }));
  }

  if (!cmd.signers) {
    cmd.signers = [];
  }

  for (const item of signers) {
    const newSigner = "object" === typeof item ? item : { pubKey: item };
    const existingSigner = cmd.signers.find((s) => s?.pubKey === newSigner?.pubKey);
    if (existingSigner) {
      existingSigner.clist = clist;
    } else {
      cmd.signers.push({
        clist,
        scheme: "ED25519",
        ...newSigner,
      });
    }
  }
  return cmd;
}

export async function signPactCommandWithWallet<Payload extends PactCmdPayload>(
  cmd: PactCommand<Payload>,
  wallet: Wallet,
): Promise<Transaction> {
  if (cmd.signers.length === 0) {
    const signer = await wallet.getAccount();
    cmd = updatePactCommandSigners(cmd, signer.publicKey, (signFor) => [signFor("coin.GAS")]);
    cmd.meta.sender = signer.address;
  }

  const tx = createTransaction(cmd);
  return wallet.sign(tx);
}

export function getSignerKeys(network: SerializableNetworkConfig, signer?: string): KeyPair {
  signer = signer || network.senderAccount || "sender00";
  const signerAccount = network.keyPairs.find((s) => s.account === signer);
  if (!signerAccount) {
    throw new Error(`Signer ${signer} not found in network config`);
  }
  return signerAccount;
}
