import type { IBuilder, IClient, ISignFunction } from '@kadena/client';
import { createClient, createSignWithKeypair } from '@kadena/client';
import { setGlobalConfig } from '@kadena/client-utils/core';
import type { ChainId, IKeyPair } from '@kadena/types';

export interface Signer extends IKeyPair {
  account: string;
}

interface ToolboxNetworkMeta {
  chainId: ChainId;
  sender?: string;
  gasLimit?: number;
  gasPrice?: number;
  ttl?: number;
}
export interface ToolboxClientNetworkConfig {
  networkId: string;
  rpcUrl: string;
  senderAccount: string;
  defaultSigner: Signer;
  signers: Signer[];
  type: string;
  name: string;
  meta: ToolboxNetworkMeta;
}

export type IClientConfig = Parameters<typeof setGlobalConfig>[0];

export function isToolboxInstalled() {
  return typeof (globalThis as any).__PACT_TOOLBOX_NETWORK_CONFIG__ === 'object';
}

export function getToolboxNetworkConfig(): ToolboxClientNetworkConfig {
  if (!isToolboxInstalled()) {
    throw new Error('Make sure you are using the pact-toolbox bundler plugin, eg `@pact-toolbox/unplugin`');
  }
  return (globalThis as any).__PACT_TOOLBOX_NETWORK_CONFIG__;
}

export function createKadenaClient() {
  let kdaClient: IClient;
  return () => {
    const config = getToolboxNetworkConfig();
    if (!kdaClient) {
      kdaClient = createClient(({ networkId = config.networkId, chainId = config.meta.chainId }) =>
        config.rpcUrl.replace(/{networkId}|{chainId}/g, (match: string) =>
          match === '{networkId}' ? networkId : chainId,
        ),
      );
    }
    return kdaClient;
  };
}

export function getToolboxClientUtilsDefaults(): IClientConfig {
  try {
    const network = getToolboxNetworkConfig();
    return {
      host: ({ networkId = network.networkId, chainId = network.meta.chainId }) =>
        network.rpcUrl.replace(/{networkId}|{chainId}/g, (match: string) =>
          match === '{networkId}' ? networkId : chainId,
        ),
      defaults: {
        meta: network.meta,
        networkId: network.networkId,
        signers: [
          {
            pubKey: network.defaultSigner.publicKey,
            address: network.defaultSigner.account,
            scheme: 'ED25519',
          },
        ],
      },
      sign: createSignWithPactToolbox(),
    };
  } catch (e) {
    return {};
  }
}

export function setupToolboxClientUtilsConfig() {
  setGlobalConfig(getToolboxClientUtilsDefaults());
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
  const network = getToolboxNetworkConfig();
  return builder.setNetworkId(network.networkId).setMeta(network.meta) as T;
}

export function getSignerAccount(signer?: string) {
  const network = getToolboxNetworkConfig();
  signer = signer || network.senderAccount || 'sender00';
  const signerAccount = network.signers.find((s) => s.account === signer);
  if (!signerAccount) {
    throw new Error(`Signer ${signer} not found in network config`);
  }
  return signerAccount;
}
