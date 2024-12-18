import type { ChainId, IKeyPair } from "@kadena/types";

import type { PactKeyset } from "./pact";

export interface GetRpcUrlParams {
  chainId?: string;
  networkId?: string;
}

export interface KeyPair extends IKeyPair {
  account: string | `k:${string}`;
}

export interface NetworkMeta {
  chainId: ChainId;
  gasLimit?: number;
  gasPrice?: number;
  ttl?: number;
}
export interface CommonNetworkConfig {
  networkId: string;
  rpcUrl: string;
  name?: string;
  senderAccount: string;
  keyPairs: KeyPair[];
  keysets: Record<string, PactKeyset>;
  meta: NetworkMeta;
}

export interface SerializableNetworkConfig extends CommonNetworkConfig {
  type: "chainweb-local" | "chainweb" | "pact-server" | "chainweb-devnet";
  devProxyUrl: string;
  isDevProxyEnabled: boolean;
}

export type StandardPrelude = "kadena/chainweb" | "kadena/marmalade";
