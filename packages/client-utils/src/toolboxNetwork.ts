import { IBuilder, createClient, createSignWithKeypair } from '@kadena/client';
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
  const network = (globalThis as any).__PACT_TOOLBOX_NETWORK__;
  if (!network) {
    throw new Error('Make sure you are using the pact-toolbox bundler plugin, eg `@pact-toolbox/vite-plugin');
  }
  return network;
}

export function createKadenaClient() {
  const config = getPactToolboxNetworkConfig();
  return createClient(({ networkId = config.networkId, chainId = config.chainId }) =>
    config.rpcUrl.replace(/{networkId}|{chainId}/g, (match: string) => (match === '{networkId}' ? networkId : chainId)),
  );
}

export function createSignWithPactToolbox(signer?: string) {
  const signerAccount = getSignerAccount(signer);
  return createSignWithKeypair(signerAccount);
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
