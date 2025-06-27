import type {
  ChainId,
  PactCapabilityLike,
  PactCmdPayload,
  PactCommand,
  PactCont,
  PactContPayload,
  PactExecPayload,
  PactKeyset,
  PactMetadata,
  PactSignerLike,
  PactVerifier,
  PartiallySignedTransaction,
  Serializable,
  Transaction,
} from "@pact-toolbox/types";

import type { ToolboxNetworkContext } from "./network";
import { getGlobalNetworkContext } from "./network";
import { PactTransactionDispatcher } from "./dispatcher";
import {
  createPactCommandWithDefaults,
  createTransaction,
  isPactExecPayload,
  signPactCommandWithWallet,
  updatePactCommandSigners,
} from "./utils";
import type { Wallet } from "@pact-toolbox/wallet-core";
import { getWalletWithUI, type WalletUIOptions, getWalletUIConfig } from "./wallet-ui-integration";

/**
 * Builder class for creating and configuring Pact transactions
 * 
 * @template Payload - The type of Pact command payload (execution or continuation)
 * @template Result - The expected result type from transaction execution
 * 
 * @example
 * ```typescript
 * // Create an execution transaction
 * const tx = execution('(coin.get-balance "alice")')
 *   .withChainId("1")
 *   .withSigner("alice-public-key")
 *   .sign() // Shows wallet selector in browser
 *   .submitAndListen();
 * 
 * // Create with explicit wallet
 * const tx = execution('(coin.transfer "alice" "bob" 10.0)')
 *   .withSigner("alice-public-key", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 10.0)])
 *   .sign(myWallet)
 *   .submitAndListen();
 * ```
 */
export class PactTransactionBuilder<Payload extends PactCmdPayload, Result = unknown> {
  #cmd: PactCommand<Payload>;
  #context: ToolboxNetworkContext;
  #builder: (cmd: PactCommand<Payload>) => Promise<Transaction> = async (cmd) => createTransaction(cmd);

  /**
   * Create a new transaction builder
   * 
   * @param payload - The Pact command payload (execution or continuation)
   * @param context - Optional network context. Uses global context if not provided
   */
  constructor(payload: Payload, context?: ToolboxNetworkContext) {
    this.#context = context ?? getGlobalNetworkContext();
    this.#cmd = createPactCommandWithDefaults(payload, this.#context.getNetworkConfig());
  }

  /**
   * Add data to the transaction's data map
   * 
   * @param key - The key to store the data under
   * @param value - The value to store (must be JSON serializable)
   * @returns This builder instance for chaining
   */
  withData(key: string, value: Serializable): this {
    if (isPactExecPayload(this.#cmd.payload)) {
      this.#cmd.payload.exec.data[key] = value;
    } else {
      this.#cmd.payload.cont.data[key] = value;
    }
    return this;
  }

  /**
   * Add multiple data entries at once
   * 
   * @param data - Object containing key-value pairs to add to transaction data
   * @returns This builder instance for chaining
   */
  withDataMap(data: { [key: string]: Serializable }): this {
    for (const [key, value] of Object.entries(data)) {
      this.withData(key, value);
    }
    return this;
  }

  /**
   * Add a keyset to the transaction data
   * 
   * @param name - The name of the keyset
   * @param keyset - The keyset definition with keys and predicate
   * @returns This builder instance for chaining
   */
  withKeyset(name: string, keyset: PactKeyset): this {
    this.withData(name, keyset);
    return this;
  }

  /**
   * Add multiple keysets at once
   * 
   * @param keysets - Object containing keyset name to keyset mappings
   * @returns This builder instance for chaining
   */
  withKeysetMap(keysets: { [key: string]: PactKeyset }): this {
    for (const [name, keyset] of Object.entries(keysets)) {
      this.withKeyset(name, keyset);
    }
    return this;
  }

  /**
   * Set the chain ID for this transaction
   * 
   * @param chainId - Chain ID (0-19 for Kadena mainnet/testnet)
   * @returns This builder instance for chaining
   */
  withChainId(chainId: ChainId): this {
    this.#cmd.meta.chainId = chainId;
    return this;
  }

  /**
   * Set transaction metadata (gas limit, gas price, sender, TTL, etc.)
   * 
   * @param meta - Partial metadata object to merge with current metadata
   * @returns This builder instance for chaining
   */
  withMeta(meta: Partial<PactMetadata>): this {
    this.#cmd.meta = { ...this.#cmd.meta, ...meta };
    return this;
  }

  /**
   * Add a signer to the transaction
   * 
   * @param signer - Public key string or signer object, or array of signers
   * @param capability - Optional capability function to define required capabilities
   * @returns This builder instance for chaining
   * 
   * @example
   * ```typescript
   * // Simple signer
   * .withSigner("alice-public-key")
   * 
   * // Signer with capabilities
   * .withSigner("alice-public-key", (signFor) => [
   *   signFor("coin.TRANSFER", "alice", "bob", 10.0),
   *   signFor("coin.GAS")
   * ])
   * ```
   */
  withSigner(signer: PactSignerLike | PactSignerLike[], capability?: PactCapabilityLike): this {
    this.#cmd = updatePactCommandSigners(this.#cmd, signer, capability);
    return this;
  }

  /**
   * Add a verifier to the transaction
   * 
   * @param verifier - Verifier configuration
   * @returns This builder instance for chaining
   */
  withVerifier(verifier: PactVerifier): this {
    if (!this.#cmd.verifiers) {
      this.#cmd.verifiers = [];
    }
    this.#cmd.verifiers.push(verifier);
    return this;
  }

  /**
   * Set the network ID for this transaction
   * 
   * @param networkId - Network identifier (e.g., "mainnet01", "testnet04")
   * @returns This builder instance for chaining
   */
  withNetworkId(networkId: string): this {
    this.#cmd.networkId = networkId;
    return this;
  }

  /**
   * Set a custom nonce for this transaction
   * 
   * @param nonce - Unique nonce string
   * @returns This builder instance for chaining
   */
  withNonce(nonce: string): this {
    this.#cmd.nonce = nonce;
    return this;
  }

  /**
   * Set the network context for this transaction
   * 
   * @param context - Network context to use
   * @returns This builder instance for chaining
   */
  withContext(context?: ToolboxNetworkContext): this {
    if (context) {
      this.#context = context;
    }
    return this;
  }

  /**
   * Build the transaction without signing (returns unsigned transaction)
   * 
   * @param context - Optional network context to use for this build
   * @returns A transaction dispatcher for executing the unsigned transaction
   */
  build(context?: ToolboxNetworkContext): PactTransactionDispatcher<Payload, Result> {
    if (context) {
      this.withContext(context);
    } else {
      // Always use current global context for latest network state
      this.#context = getGlobalNetworkContext();
    }
    this.#builder = (cmd) => Promise.resolve(createTransaction(cmd));
    return new PactTransactionDispatcher(this, this.#context);
  }

  /**
   * Sign the transaction using a wallet
   *
   * @param walletOrId - Wallet instance, wallet ID, or undefined to show wallet selector
   * @param options - UI options for wallet selection and approval
   * @returns A transaction dispatcher for executing the signed transaction
   * 
   * @example
   * ```typescript
   * // Show wallet selector in browser (default behavior)
   * const result = await execution('(coin.get-balance "alice")')
   *   .sign()
   *   .submitAndListen();
   * 
   * // Use specific wallet
   * const result = await execution('(coin.transfer "alice" "bob" 10.0)')
   *   .withSigner("alice-key", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 10.0)])
   *   .sign(myWallet)
   *   .submitAndListen();
   * 
   * // Disable UI and require explicit wallet
   * const result = await execution('(coin.get-balance "alice")')
   *   .sign("keypair", { showUI: false })
   *   .submitAndListen();
   * ```
   */
  sign(walletOrId?: Wallet | string, options?: WalletUIOptions): PactTransactionDispatcher<Payload, Result> {
    this.#builder = async (cmd) => {
      // Merge options with global config
      const mergedOptions: WalletUIOptions = {
        ...getWalletUIConfig(),
        ...options,
      };

      // Get wallet with UI integration
      const wallet = await getWalletWithUI(walletOrId, mergedOptions, {
        isLocalNetwork: this.#context.isLocalNetwork(),
        networkId: this.#context.getNetworkId(),
      });

      return signPactCommandWithWallet(cmd, wallet);
    };
    return new PactTransactionDispatcher(this, this.#context);
  }

  /**
   * Convert the transaction to a JSON string representation
   * 
   * @returns JSON string of the transaction
   */
  toString(): string {
    return JSON.stringify(this.build(), undefined, 2);
  }

  /**
   * Get the partially signed transaction (internal method)
   * 
   * @returns Promise resolving to the transaction
   */
  getPartialTransaction(): Promise<PartiallySignedTransaction> {
    return this.#builder(this.#cmd);
  }

  /**
   * Get the raw Pact command (internal method)
   * 
   * @returns The Pact command
   */
  getCommand(): PactCommand<Payload> {
    return this.#cmd;
  }
}

/**
 * Create a new Pact execution transaction
 * 
 * @template Result - The expected result type from the execution
 * @param code - Pact code to execute
 * @param context - Optional network context to use
 * @returns A new transaction builder for the execution
 * 
 * @example
 * ```typescript
 * // Simple query
 * const balance = await execution<string>('(coin.get-balance "alice")')
 *   .withChainId("1")
 *   .build()
 *   .dirtyRead();
 * 
 * // Transaction with signing
 * const result = await execution('(coin.transfer "alice" "bob" 10.0)')
 *   .withSigner("alice-key", (signFor) => [
 *     signFor("coin.TRANSFER", "alice", "bob", 10.0),
 *     signFor("coin.GAS")
 *   ])
 *   .sign()
 *   .submitAndListen();
 * ```
 */
export function execution<Result>(
  code: string,
  context?: ToolboxNetworkContext,
): PactTransactionBuilder<PactExecPayload, Result> {
  return new PactTransactionBuilder(
    {
      exec: {
        code,
        data: {},
      },
    },
    context,
  );
}

/**
 * Create a new Pact continuation transaction
 * 
 * @template Result - The expected result type from the continuation
 * @param cont - Continuation configuration (pactId, step, rollback, etc.)
 * @param context - Optional network context to use
 * @returns A new transaction builder for the continuation
 * 
 * @example
 * ```typescript
 * // Continue a multi-step pact
 * const result = await continuation({
 *     pactId: "my-pact-id",
 *     step: 1,
 *     rollback: false
 *   })
 *   .withData("user", "alice")
 *   .sign()
 *   .submitAndListen();
 * ```
 */
export function continuation<Result>(
  cont: Partial<PactCont> = {},
  context?: ToolboxNetworkContext,
): PactTransactionBuilder<PactContPayload, Result> {
  return new PactTransactionBuilder(
    {
      cont: {
        pactId: "",
        step: 0,
        rollback: false,
        data: {},
        ...cont,
      },
    } as PactContPayload,
    context,
  );
}
