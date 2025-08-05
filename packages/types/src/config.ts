import type { ChainId, PactKeyset } from "./pact";

export interface GetRpcUrlParams {
  chainId?: string;
  networkId?: string;
}

export interface KeyPair {
  publicKey: string;
  secretKey: string;
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
  // Only minimal server config needed for client-side (e.g., port for URL construction)
  serverConfig?: {
    port?: number;
  };
  containerConfig?: {
    port?: number;
  };
  // autoStart is useful for client-side to know if network should be running
  autoStart?: boolean;
}

export interface MultiNetworkConfig {
  default: string;
  configs: Record<string, SerializableNetworkConfig>;
  environment: "development" | "production" | "test";
}

export type StandardPrelude = "kadena/chainweb" | "kadena/marmalade";
