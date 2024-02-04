import {
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
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  KeysetConfig,
  NetworkConfig,
  PactConfig,
  PactToolboxConfigObj,
  isDevNetworkConfig,
  isPactServerNetworkConfig,
} from './config';
import { defaultMeta } from './defaults';
import { getCmdDataOrFail } from './utils';

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

export class PactToolboxClient {
  private kdaClient: IClient;
  private networkConfig: NetworkConfig;
  private pactConfig: Required<PactConfig>;

  constructor(private config: Required<PactToolboxConfigObj>) {
    const networkName = config.defaultNetwork || 'local';
    this.networkConfig = config.networks[networkName];
    this.pactConfig = config.pact as Required<PactConfig>;
    this.kdaClient = createClient((args) =>
      typeof this.networkConfig.rpcUrl === 'string'
        ? this.networkConfig.rpcUrl
        : this.networkConfig.rpcUrl({
            ...args,
            port: isDevNetworkConfig(this.networkConfig)
              ? this.networkConfig.containerConfig?.port
              : isPactServerNetworkConfig(this.networkConfig)
                ? this.networkConfig.serverConfig?.port
                : undefined,
          }),
    );
  }

  get network() {
    return this.networkConfig;
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

  execution(command: string) {
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
      .setNetworkId(this.networkConfig.networkId);
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

  async submit<T>(tx: ICommand | IUnsignedCommand) {
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
      if (isDevNetworkConfig(this.networkConfig) && this.networkConfig.onDemandMining) {
        await this.mineBlocks();
      }
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

  async deployContract(contract: string, params?: DeployContractParams) {
    const contractsDir = this.pactConfig.contractsDir;
    const contractPath = join(contractsDir, contract);
    const stats = await stat(contractPath);
    if (!stats.isFile()) {
      throw new Error(`Contract file not found: ${contractPath}`);
    }
    const contractCode = await readFile(contractPath, 'utf-8');
    return this.deployCode(contractCode, params);
  }

  async mineBlocks(count = 10) {
    if (!isDevNetworkConfig(this.network)) {
      throw new Error('mineBlocks is only supported for devnet');
    }
    const port = this.network.containerConfig?.port || 8080;
    const chainId = this.network.chainId || '0';
    const res = await fetch(`http://127.0.0.1:${port || 8080}/make-blocks`, {
      method: 'POST',
      body: JSON.stringify({ [chainId]: count }),
    });
    if (res.ok) {
      const message = await res.json();
      console.log(message);
    }
  }
}
