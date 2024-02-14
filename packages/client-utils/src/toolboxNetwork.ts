import { IBuilder, IClient, ISignFunction, createClient, createSignWithKeypair } from '@kadena/client';
import { ChainId, IKeyPair } from '@kadena/types';
interface Signer extends IKeyPair {
  account: string;
}

interface PactToolboxNetworkConfig {
  networkId: string;
  chainId: ChainId;
  rpcUrl: string;
  gasLimit: number;
  gasPrice: number;
  ttl: number;
  senderAccount: string;
  signers: Signer[];
  type: string;
  name: string;
}
export function getPactToolboxNetworkConfig(): PactToolboxNetworkConfig {
  const network = (globalThis as any).__PACT_TOOLBOX_NETWORK_CONFIG__;
  if (!network) {
    throw new Error('Make sure you are using the pact-toolbox bundler plugin, eg `@pact-toolbox/vite-plugin');
  }
  return network;
}

export function createKadenaClient() {
  let kdaClient: IClient;
  return () => {
    const config = getPactToolboxNetworkConfig();
    if (!kdaClient) {
      kdaClient = createClient(({ networkId = config.networkId, chainId = config.chainId }) =>
        config.rpcUrl.replace(/{networkId}|{chainId}/g, (match: string) =>
          match === '{networkId}' ? networkId : chainId,
        ),
      );
    }
    return kdaClient;
  };
}

export function createSignWithPactToolbox(signer?: string): ISignFunction {
  let sign: ISignFunction;
  return ((transactions) => {
    const signerAccount = getSignerAccount(signer);
    if (!sign) {
      sign = createSignWithKeypair(signerAccount);
    }
    return sign(transactions as any);
  }) as ISignFunction;
}

export function addDefaultMeta<T extends IBuilder<any>>(builder: T): T {
  const network = getPactToolboxNetworkConfig();
  return builder.setNetworkId(network.networkId).setMeta({
    chainId: network.chainId,
    gasLimit: network.gasLimit,
    gasPrice: network.gasPrice,
    ttl: network.ttl,
  }) as T;
}

export function getSignerAccount(signer?: string) {
  const network = getPactToolboxNetworkConfig();
  signer = signer || network.senderAccount || 'sender00';
  const signerAccount = network.signers.find((s) => s.account === signer);
  if (!signerAccount) {
    throw new Error(`Signer ${signer} not found in network config`);
  }
  return signerAccount;
}
