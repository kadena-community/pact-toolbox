import {
  IBuilder,
  IClient,
  ICommand,
  IKeyPair,
  ITransactionDescriptor,
  IUnsignedCommand,
  Pact,
  createClient,
  createSignWithKeypair,
  isSignedTransaction,
} from '@kadena/client';
import { getCmdDataOrFail } from '@pact-toolbox/client-utils';
import {
  KeysetConfig,
  NetworkConfig,
  PactToolboxConfigObj,
  createRpcUrlGetter,
  defaultMeta,
  getNetworkConfig,
  isPactServerNetworkConfig,
} from '@pact-toolbox/config';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface DeployContractParams {
  upgrade?: boolean;
  preflight?: boolean;
  listen?: boolean;
  init?: boolean;
  namespace?: string;
  keysets?: Record<string, KeysetConfig>;
  signer?: string;
  data?: Record<string, unknown>;
  caps?: string[][];
  skipSign?: boolean;
}

export interface LocalOptions {
  preflight?: boolean;
  signatureVerification?: boolean;
}

export class PactToolboxRuntime {
  private kdaClient: IClient;
  private networkConfig: NetworkConfig;

  constructor(private config: PactToolboxConfigObj) {
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

  getConfig() {
    return this.config;
  }

  getSigner(address: string = this.networkConfig.senderAccount) {
    const s = this.networkConfig.signers.find((s) => s.account === address);
    if (!s) {
      throw new Error(`Signer ${address} not found in network accounts`);
    }
    return s;
  }

  execution<T extends IBuilder<any>>(command: string): T {
    return Pact.builder
      .execution(command)
      .setMeta({
        ...defaultMeta,
        chainId: this.networkConfig.chainId,
        senderAccount: this.networkConfig.senderAccount,
        ttl: this.networkConfig.ttl,
        gasLimit: this.networkConfig.gasLimit,
        gasPrice: this.networkConfig.gasPrice,
      })
      .setNetworkId(this.networkConfig.networkId) as T;
  }

  async sign(tx: IUnsignedCommand, keyPair?: IKeyPair) {
    const senderKeys = keyPair ?? this.getSigner(this.networkConfig.senderAccount);
    if (!senderKeys) {
      throw new Error(`Signer ${this.networkConfig.senderAccount} not found in network accounts`);
    }
    return createSignWithKeypair(senderKeys)(tx);
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

  async deployCode(
    code: string,
    {
      upgrade = false,
      preflight = false,
      init = false,
      namespace,
      keysets,
      data,
      signer = this.networkConfig.senderAccount,
      caps = [],
      skipSign = false,
      listen = true,
    }: DeployContractParams = {},
  ) {
    const txBuilder = this.execution(code).addData('upgrade', upgrade).addData('init', init);
    if (signer && !skipSign) {
      const signerKeys = this.getSigner(signer);
      if (!signerKeys) {
        throw new Error(`Signer ${signer} not found in network accounts`);
      }
      txBuilder.addSigner(signerKeys.publicKey, (signFor) =>
        caps.map((capArgs) => signFor.apply(null, capArgs as any)),
      );
    }

    if (namespace) {
      txBuilder.addData('namespace', namespace);
      txBuilder.addData('ns', namespace);
    }

    if (typeof keysets === 'object') {
      for (const [keysetName, keyset] of Object.entries(keysets)) {
        txBuilder.addKeyset(keysetName, keyset.pred, ...keyset.keys);
      }
    }

    if (data) {
      for (const [key, value] of Object.entries(data)) {
        txBuilder.addData(key, value as any);
      }
    }

    let tx = txBuilder.createTransaction();
    if (!skipSign) {
      tx = await this.sign(tx);
    }

    if (preflight) {
      const res = await this.preflight(tx);
      if (res.preflightWarnings) {
        console.warn('Preflight warnings:', res.preflightWarnings?.join('\n'));
      }
    }

    return listen ? this.submitAndListen(tx) : this.submit(tx);
  }

  async describeModule(module: string) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.runPact(`(describe-module "${module}")`);
  }

  async isContractDeployed(module: string) {
    const res = await this.describeModule(module);
    if (res.result.status === 'success') {
      return true;
    }
    return false;
  }

  async getContractCode(contract: string) {
    const contractsDir = this.config.contractsDir ?? 'pact';
    const contractPath = join(contractsDir, contract);
    const stats = await stat(contractPath);
    if (!stats.isFile()) {
      throw new Error(`Contract file not found: ${contractPath}`);
    }
    return readFile(contractPath, 'utf-8');
  }

  async deployContract(contract: string, params?: DeployContractParams) {
    const contractCode = await this.getContractCode(contract);
    return this.deployCode(contractCode, params);
  }

  async deployContracts(contracts: string[], params?: DeployContractParams) {
    return Promise.all(contracts.map((c) => this.deployContract(c, params)));
  }

  async runScript(script: string, args: Record<string, any> = {}) {
    const scriptsDir = this.config.scriptsDir ?? 'scripts';
    const scriptsPath = join(scriptsDir, script);
    const scriptModule = await import(scriptsPath);
    return scriptModule.default(this, args);
  }

  async reset() {
    const res = await fetch('http://localhost:8080/restart', { method: 'POST' });
    const data = await res.json();
    return data;
  }
}
