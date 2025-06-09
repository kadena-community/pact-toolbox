import type { IClient } from "@kadena/client";
import type { KeyPair, PactMetadata, PactSigner, SerializableNetworkConfig } from "@pact-toolbox/types";

import type { PactTransactionBuilderLike } from "./utils";
import {
  addDefaultMeta,
  createKadenaClient,
  getKAccountKey,
  getSignerKeys,
  getToolboxGlobalNetworkConfig,
} from "./utils";
import { ToolboxWallet } from "./wallet";

export class ToolboxNetworkContext {
  #config: SerializableNetworkConfig;
  #client: IClient;
  #wallet: ToolboxWallet;

  constructor(config?: SerializableNetworkConfig) {
    this.#config = config ?? getToolboxGlobalNetworkConfig(true);
    this.#client = createKadenaClient(this.#config);
    this.#wallet = new ToolboxWallet(this);
  }

  getNetworkId(): string {
    return this.#config.networkId;
  }

  getMeta(): PactMetadata {
    return this.#config.meta;
  }

  withMeta<T extends PactTransactionBuilderLike>(builder: T): T {
    return addDefaultMeta(this.#config, builder);
  }

  getSignerKeys(signer?: string): KeyPair {
    return getSignerKeys(this.#config, signer);
  }

  getDefaultSigner(): PactSigner | undefined {
    if ("string" === typeof this.#config.senderAccount) {
      const signer = this.#config.keyPairs.find((s) => s.account === this.#config.senderAccount);
      return {
        pubKey: signer?.publicKey || getKAccountKey(this.#config.senderAccount),
        address: signer?.account || this.#config.senderAccount,
        scheme: "ED25519",
      };
    }
    return this.#config.senderAccount;
  }

  getNetworkConfig(): SerializableNetworkConfig {
    return this.#config;
  }

  getClient(): IClient {
    return this.#client;
  }

  getWallet(): ToolboxWallet {
    return this.#wallet;
  }

  setWallet(wallet: ToolboxWallet): void {
    this.#wallet = wallet;
  }
}

export function createToolboxNetworkContext(
  config?: SerializableNetworkConfig,
  global?: boolean,
): ToolboxNetworkContext {
  const context = new ToolboxNetworkContext(config);
  if (global) {
    (globalThis as any).__PACT_TOOLBOX_NETWORK__CONFIG__ = context.getNetworkConfig();
    (globalThis as any).__PACT_TOOLBOX_NETWORK__CONTEXT__ = context;
  }
  return context;
}
