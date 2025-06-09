import { readFile, stat } from "node:fs/promises";
import type { ChainId, ITransactionDescriptor } from "@kadena/client";
import type { PactTransactionBuilder, ToolboxNetworkContext } from "@pact-toolbox/client";
import type { NetworkConfig, PactToolboxConfigObj } from "@pact-toolbox/config";
import type {
  KeyPair,
  PactCmdPayload,
  PactExecPayload,
  PactKeyset,
  PactSignerLike,
  Serializable,
  WalletLike,
} from "@pact-toolbox/types";
import { isAbsolute, join, resolve } from "pathe";

import { createToolboxNetworkContext, execution, getKAccountKey } from "@pact-toolbox/client";
import {
  defaultConfig,
  defaultMeta,
  getNetworkConfig,
  getSerializableNetworkConfig,
  isPactServerNetworkConfig,
} from "@pact-toolbox/config";

import { getSignerFromEnvVars, isKeyPair } from "./utils";

export interface TransactionBuilderData {
  senderAccount?: string;
  chainId?: ChainId;
  init?: boolean;
  namespace?: string;
  keysets?: Record<string, PactKeyset>;
  data?: Record<string, Serializable>;
  upgrade?: boolean;
}

export interface DeployContractOptions {
  preflight?: boolean;
  listen?: boolean;
  skipSign?: boolean;
  signer?: PactSignerLike | KeyPair;
  sign?: WalletLike;
  build?:
    | TransactionBuilderData
    | (<T extends PactCmdPayload>(
        tx: PactTransactionBuilder<T>,
      ) => PactTransactionBuilder<T> | Promise<PactTransactionBuilder<T>>);
}

export interface LocalOptions {
  preflight?: boolean;
  signatureVerification?: boolean;
}

export class PactToolboxClient {
  private networkConfig: NetworkConfig;
  public context: ToolboxNetworkContext;

  constructor(
    private config: PactToolboxConfigObj = defaultConfig,
    network?: string,
  ) {
    this.networkConfig = getNetworkConfig(config, network);
    this.context = createToolboxNetworkContext(getSerializableNetworkConfig(config), true);
  }

  setConfig(config: PactToolboxConfigObj): void {
    this.config = config;
    this.networkConfig = getNetworkConfig(config);
    this.context = createToolboxNetworkContext(getSerializableNetworkConfig(config), true);
  }

  getContext(): ToolboxNetworkContext {
    return this.context;
  }

  getNetworkConfig(): NetworkConfig {
    return this.networkConfig;
  }

  isPactServerNetwork(): boolean {
    return isPactServerNetworkConfig(this.networkConfig);
  }

  isChainwebNetwork(): boolean {
    return this.networkConfig.type.includes("chainweb");
  }

  getContractsDir(): string {
    return this.config.contractsDir ?? "pact";
  }

  getScriptsDir(): string {
    return this.config.scriptsDir ?? "scripts";
  }

  getPreludeDir(): string {
    return join(this.getContractsDir(), "prelude");
  }

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

    const fromEnv = getSignerFromEnvVars(this.networkConfig.name?.toUpperCase());
    if (fromEnv?.secretKey && fromEnv?.publicKey) {
      return {
        publicKey: fromEnv.publicKey,
        secretKey: fromEnv.secretKey,
        account: fromEnv.account ?? getKAccountKey(fromEnv.publicKey),
      };
    }
    const account =
      fromEnv?.account || (fromEnv?.publicKey ? getKAccountKey(fromEnv?.publicKey) : this.networkConfig.senderAccount);
    return this.context.getSignerKeys(account);
  }

  /**
   * Creates an execution builder with default metadata.
   * @param command - The Pact command to execute.
   * @returns A PactTransactionBuilder instance.
   */
  execution<Result = unknown>(command: string): PactTransactionBuilder<PactExecPayload, Result> {
    return execution<Result>(command, this.context)
      .withContext(this.context)
      .withMeta({
        ...defaultMeta,
        ...this.networkConfig.meta,
        sender: this.networkConfig.senderAccount,
      })
      .withNetworkId(this.networkConfig.networkId);
  }

  /**
   * Deploys Pact code to the specified chains.
   * @param code - The Pact code to deploy.
   * @param options - Deployment options.
   * @returns An array of transaction descriptors or identifiers.
   */

  async deployCode(
    code: string,
    options?: DeployContractOptions,
    chainId?: ChainId,
  ): Promise<ITransactionDescriptor | string>;
  async deployCode(
    code: string,
    options?: DeployContractOptions,
    chainId?: ChainId[],
  ): Promise<ITransactionDescriptor[] | string[]>;
  async deployCode(
    code: string,
    options: DeployContractOptions = {},
    chainId?: ChainId | ChainId[],
  ): Promise<ITransactionDescriptor | ITransactionDescriptor[] | string | string[]> {
    const { preflight, listen = true, skipSign, sign, build, signer } = options;
    let txBuilder = this.execution<string>(code).withContext(this.context);
    if (typeof build === "function") {
      await build(txBuilder);
    } else {
      this.prepareTransaction(txBuilder, build);
    }

    if (skipSign) {
      return listen
        ? txBuilder.build().submitAndListen(chainId as any, preflight)
        : txBuilder.build().submit(chainId as any, preflight);
    }

    if (signer) {
      txBuilder = txBuilder.withSigner(isKeyPair(signer) ? signer.publicKey : signer);
    }
    return listen
      ? txBuilder.sign(sign).submitAndListen(chainId as any, preflight)
      : txBuilder.sign(sign).submit(chainId as any, preflight);
  }

  /**
   * Deploys a single contract.
   * @param contract - The path to the contract file.
   * @param options - Deployment options.
   * @returns An array of transaction descriptors or identifiers.
   */
  async deployContract(
    contract: string,
    options?: DeployContractOptions,
    chainId?: ChainId,
  ): Promise<ITransactionDescriptor | string>;
  async deployContract(
    contract: string,
    options?: DeployContractOptions,
    chainId?: ChainId[],
  ): Promise<ITransactionDescriptor[] | string[]>;
  async deployContract(
    contract: string,
    options?: DeployContractOptions,
    chainId?: ChainId | ChainId[],
  ): Promise<ITransactionDescriptor | ITransactionDescriptor[] | string | string[]> {
    const contractCode = await this.getContractCode(contract);
    return this.deployCode(contractCode, options, chainId as any);
  }

  /**
   * Deploys multiple contracts.
   * @param contracts - An array of contract file paths.
   * @param options - Deployment options.
   * @returns An array of transaction descriptors or identifiers.
   */
  async deployContracts(
    contracts: string[],
    options?: DeployContractOptions,
    chainId?: ChainId,
  ): Promise<(ITransactionDescriptor | string)[]>;
  async deployContracts(
    contracts: string[],
    options?: DeployContractOptions,
    chainId?: ChainId[],
  ): Promise<(ITransactionDescriptor[] | string[])[]>;
  async deployContracts(
    contracts: string[],
    options?: DeployContractOptions,
    chainId?: ChainId | ChainId[],
  ): Promise<(ITransactionDescriptor | string)[] | (ITransactionDescriptor[] | string[])[]> {
    const results = await Promise.all(
      contracts.map((contract) => this.deployContract(contract, options, chainId as any)),
    );
    return results.flat();
  }

  /**
   * Prepares the transaction builder with the provided data.
   * @param txBuilder - The transaction builder.
   * @param data - The data to prepare the transaction.
   * @returns The prepared transaction builder.
   */
  private prepareTransaction(
    txBuilder: PactTransactionBuilder<any>,
    data?: TransactionBuilderData,
  ): PactTransactionBuilder<any> {
    const {
      senderAccount,
      chainId = this.networkConfig.meta?.chainId ?? "0",
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

  async listModules(): Promise<string[]> {
    return this.execution<string[]>(`(list-modules)`).build().dirtyRead();
  }

  async describeModule(module: string): Promise<string> {
    return this.execution<string>(`(describe-module "${module}")`).build().dirtyRead();
  }

  async describeNamespace(namespace: string): Promise<string> {
    return this.execution<string>(`(describe-namespace "${namespace}")`).build().dirtyRead();
  }

  async isNamespaceDefined(namespace: string): Promise<boolean> {
    try {
      await this.describeNamespace(namespace);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a contract is deployed.
   * @param module - The module name.
   * @returns True if deployed, false otherwise.
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
   * Retrieves the contract code from the filesystem.
   * @param contractPath - The path to the contract file.
   * @returns The contract code as a string.
   * @throws Error if the contract file is not found.
   */
  async getContractCode(contractPath: string): Promise<string> {
    const contractsDir = this.getContractsDir();
    let resolvedPath =
      isAbsolute(contractPath) || contractPath.startsWith(contractsDir)
        ? resolve(contractPath)
        : resolve(contractsDir, contractPath);

    if (!resolvedPath.endsWith(".pact")) {
      console.warn("Contract file does not have a .pact extension, appending .pact");
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
