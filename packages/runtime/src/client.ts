import type {
  ChainId,
  IBuilder,
  IClient,
  ICommand,
  IKeyPair,
  ITransactionDescriptor,
  IUnsignedCommand,
} from '@kadena/client';
import { Pact, createClient, createSignWithKeypair, isSignedTransaction } from '@kadena/client';
import { Signer, getCmdDataOrFail } from '@pact-toolbox/client-utils';
import type { KeysetConfig, NetworkConfig, NetworkMeta, PactToolboxConfigObj } from '@pact-toolbox/config';
import { createRpcUrlGetter, defaultMeta, getNetworkConfig, isPactServerNetworkConfig } from '@pact-toolbox/config';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'pathe';
import { getSignerFromEnv, isValidateSigner } from './utils';

export interface TransactionBuilderData extends Partial<NetworkMeta> {
  senderAccount?: string;
  networkId?: string;
  upgrade?: boolean;
  init?: boolean;
  namespace?: string;
  keysets?: Record<string, KeysetConfig>;
  data?: Record<string, any>;
}
export interface DeployContractOptions {
  preflight?: boolean;
  listen?: boolean;
  signer?: string | Signer;
  caps?: string[][];
  skipSign?: boolean;
  prepareTx?: ((builder: IBuilder<any>) => Promise<IBuilder<any>>) | TransactionBuilderData;
  signTx?: (tx: IUnsignedCommand, keyPair: IKeyPair) => Promise<ICommand>;
}

export interface DeployContractMultiChainOptions extends DeployContractOptions {
  targetChains?: ChainId[];
}
export interface LocalOptions {
  preflight?: boolean;
  signatureVerification?: boolean;
}

export class PactToolboxClient {
  private kdaClient: IClient;
  private networkConfig: NetworkConfig;

  constructor(
    private config: PactToolboxConfigObj,
    network?: string,
  ) {
    this.networkConfig = getNetworkConfig(config, network);
    this.kdaClient = createClient(createRpcUrlGetter(this.networkConfig));
  }

  setConfig(config: PactToolboxConfigObj) {
    this.config = config;
    this.networkConfig = getNetworkConfig(config);
    this.kdaClient = createClient(createRpcUrlGetter(this.networkConfig));
  }

  get network() {
    return this.networkConfig;
  }

  isPactServerNetwork() {
    return isPactServerNetworkConfig(this.networkConfig);
  }

  isChainwebNetwork() {
    return this.networkConfig.type.includes('chainweb');
  }

  getContactsDir() {
    return this.config.contractsDir ?? 'pact';
  }

  getScriptsDir() {
    return this.config.scriptsDir ?? 'scripts';
  }

  getPreludeDir() {
    return join(this.getContactsDir(), 'prelude');
  }

  getConfig() {
    return this.config;
  }

  getSigner<T extends Partial<Signer>>(
    address: T | string = this.networkConfig.senderAccount,
    args: Record<string, unknown> = {},
  ): T {
    if (typeof address === 'object') {
      return address;
    }
    const signer =
      this.networkConfig.signers.find((s) => s.account === address) ??
      getSignerFromEnv(args, this.network.name?.toUpperCase());
    return signer as T;
  }

  getValidateSigner(signer?: string | Signer, args: Record<string, unknown> = {}) {
    signer = this.getSigner(signer, args);
    if (!isValidateSigner(signer)) {
      throw new Error(`Invalid signer: ${JSON.stringify(signer)}`);
    }
    return signer;
  }

  execution<T extends IBuilder<any>>(command: string): T {
    return Pact.builder
      .execution(command)
      .setMeta({
        ...defaultMeta,
        ...this.networkConfig.meta,
        senderAccount: this.networkConfig.senderAccount,
      })
      .setNetworkId(this.networkConfig.networkId) as T;
  }

  async sign(tx: IUnsignedCommand, signer?: Signer) {
    signer = signer ?? this.getValidateSigner(this.networkConfig.senderAccount);
    return createSignWithKeypair(signer)(tx);
  }

  async dirtyRead<T>(tx: IUnsignedCommand | ICommand) {
    const res = await this.kdaClient.dirtyRead(tx);
    return getCmdDataOrFail<T>(res);
  }

  async local<T>(tx: IUnsignedCommand | ICommand, options?: LocalOptions) {
    const res = await this.kdaClient.local(tx, options);
    return getCmdDataOrFail<T>(res);
  }

  async preflight(tx: IUnsignedCommand | ICommand): ReturnType<IClient['preflight']> {
    return this.kdaClient.preflight(tx);
  }

  async submit(tx: ICommand | IUnsignedCommand) {
    if (isSignedTransaction(tx)) {
      return this.kdaClient.submit(tx);
    } else {
      throw new Error('Transaction must be signed');
    }
  }

  async listen<T>(request: ITransactionDescriptor) {
    const res = await this.kdaClient.listen(request);
    return getCmdDataOrFail<T>(res);
  }

  async submitAndListen<T>(tx: ICommand | IUnsignedCommand) {
    if (isSignedTransaction(tx)) {
      const request = await this.kdaClient.submit(tx);
      const response = await this.kdaClient.listen(request);
      return getCmdDataOrFail<T>(response);
    } else {
      throw new Error('Transaction must be signed');
    }
  }

  async runPact(code: string, data: Record<string, any> = {}) {
    const builder = this.execution(code);
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        builder.addData(key, value);
      }
    }
    return this.kdaClient.dirtyRead(builder.createTransaction());
  }

  private async _deployCode(
    code: string,
    {
      caps = [],
      preflight = false,
      signer = this.networkConfig.senderAccount,
      skipSign = false,
      listen = true,
      signTx,
      prepareTx,
    }: DeployContractOptions = {},
    targetChainId?: ChainId,
  ) {
    let txBuilder = this.execution(code);
    signer = this.getSigner(signer);
    if (typeof prepareTx === 'function') {
      txBuilder = await prepareTx(txBuilder);
    } else {
      const {
        senderAccount,
        chainId = this.networkConfig.meta?.chainId ?? '0',
        init = false,
        namespace,
        keysets,
        data,
        upgrade = false,
      } = prepareTx ?? {};
      txBuilder.addData('upgrade', upgrade).addData('init', init);
      if (chainId) {
        txBuilder.setMeta({ chainId: targetChainId ?? chainId });
      }
      if (senderAccount) {
        txBuilder.setMeta({ senderAccount });
      }
      if (namespace) {
        txBuilder.addData('namespace', namespace);
        txBuilder.addData('ns', namespace);
      }
      if (keysets) {
        for (const [keysetName, keyset] of Object.entries(keysets)) {
          txBuilder.addKeyset(keysetName, keyset.pred, ...keyset.keys);
        }
      }
      if (data) {
        for (const [key, value] of Object.entries(data)) {
          txBuilder.addData(key, value as any);
        }
      }
    }
    if (signer && !skipSign) {
      txBuilder.addSigner(signer.publicKey, (signFor) => caps.map((capArgs) => signFor.apply(null, capArgs as any)));
    }

    let tx = txBuilder.createTransaction();
    if (!skipSign) {
      tx = typeof signTx === 'function' ? await signTx(tx, signer) : await this.sign(tx, signer);
    }

    if (preflight) {
      const res = await this.preflight(tx);
      if (res.preflightWarnings) {
        console.warn('Preflight warnings:', res.preflightWarnings?.join('\n'));
      }
    }

    return listen ? this.submitAndListen(tx) : this.submit(tx);
  }

  deployCode(
    code: string,
    { targetChains = [this.network.meta?.chainId ?? '0'], ...params }: DeployContractMultiChainOptions = {},
  ) {
    return Promise.all(targetChains.map((chainId) => this._deployCode(code, params, chainId)));
  }

  async describeModule(module: string) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.runPact(`(describe-module "${module}")`);
  }

  async describeNamespace(namespace: string) {
    return this.runPact(`(describe-namespace "${namespace}")`);
  }

  async isNamespaceDefined(namespace: string) {
    const res = await this.describeNamespace(namespace);
    if (res.result.status === 'success') {
      return true;
    }
    return false;
  }

  async isContractDeployed(module: string) {
    const res = await this.describeModule(module);
    if (res.result.status === 'success') {
      return true;
    }
    return false;
  }

  async getContractCode(contractPath: string) {
    const contractsDir = this.config.contractsDir ?? 'pact';
    contractPath =
      isAbsolute(contractPath) || contractPath.startsWith(contractsDir)
        ? contractPath
        : join(contractsDir, contractPath);
    try {
      await stat(contractPath);
    } catch (e) {
      throw new Error(`Contract file not found: ${contractPath}`);
    }
    return readFile(contractPath, 'utf-8');
  }

  async deployContract(contract: string, params?: DeployContractMultiChainOptions) {
    const contractCode = await this.getContractCode(contract);
    return this.deployCode(contractCode, params);
  }

  async deployContracts(contracts: string[], params?: DeployContractOptions) {
    return Promise.all(contracts.map((c) => this.deployContract(c, params)));
  }
}
