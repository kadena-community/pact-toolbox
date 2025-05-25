import type { KeyPairSigner } from "@pact-toolbox/signers";
import type { PartiallySignedTransaction, Transaction } from "@pact-toolbox/types";

import { finalizeTransaction } from "@pact-toolbox/signers";

import type { ToolboxNetworkContext } from "../../../network";
import type { Wallet, WalletAccount, WalletNetwork, WalletSigner } from "../../wallet";
import { accountExists, createAccount, details } from "../../../coin";
import { createKeyPairSigner, getSignerKeys } from "../../../utils";

//const signers = generateKAccounts(10);
export class ToolboxWallet implements Wallet {
  #context: ToolboxNetworkContext;
  #signer: KeyPairSigner | undefined;

  constructor(context: ToolboxNetworkContext) {
    this.#context = context;
    this.#context.setWallet(this);
    const networkConfig = this.#context.getNetworkConfig();
    if ("chainweb" === (networkConfig as any).type && 0 >= networkConfig.keyPairs.length) {
      throw new Error("ToolboxWallet can't be used for non-local chainweb network");
    }
  }

  async #getSigner(): Promise<KeyPairSigner> {
    if (!this.#signer) {
      this.#signer = await createKeyPairSigner(this.#context.getNetworkConfig());
    }
    return this.#signer;
  }

  sign(tx: PartiallySignedTransaction): Promise<Transaction> {
    return this.quickSign(tx);
  }
  async quickSign(tx: PartiallySignedTransaction): Promise<Transaction>;
  async quickSign(txs: PartiallySignedTransaction[]): Promise<Transaction[]>;
  async quickSign(
    txs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<Transaction | Transaction[]> {
    txs = Array.isArray(txs) ? txs : [txs];
    const signer = await this.#getSigner();
    const cmds = txs.map((tx) => JSON.parse(tx.cmd));
    const signed = await signer.signPactCommands(cmds);
    return 1 === signed.length ? finalizeTransaction(signed[0]!) : signed.map(finalizeTransaction);
  }

  isInstalled(): boolean {
    return this.#context !== undefined;
  }

  async connect(networkId?: string): Promise<WalletSigner> {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const signer = getSignerKeys(this.#context.getNetworkConfig());
    try {
      const account = await details(`k:${signer.publicKey}`, this.#context);
      return {
        address: account.account,
        publicKey: signer.publicKey,
      };
    } catch {
      const account = await createAccount(signer, this.#context);
      return {
        address: account.account,
        publicKey: signer.publicKey,
      };
    }
  }

  async getSigner(networkId?: string): Promise<WalletSigner> {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const signer = getSignerKeys(this.#context.getNetworkConfig());
    return {
      address: signer.account,
      publicKey: signer.publicKey,
    };
  }

  async getAccountDetails(networkId?: string): Promise<WalletAccount> {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }

    const signer = await this.getSigner(networkId);
    const d = await details(signer.address);
    return {
      address: d.account,
      publicKey: signer.publicKey,
      connectedSites: [],
      balance: parseFloat(d.balance),
    };
  }

  async getNetwork(): Promise<WalletNetwork> {
    const networkConfig = this.#context.getNetworkConfig();
    return {
      id: networkConfig.networkId,
      name: networkConfig.name ?? networkConfig.networkId,
      networkId: networkConfig.networkId,
      url: networkConfig.rpcUrl,
      isDefault: true,
    };
  }

  async isConnected(networkId?: string): Promise<boolean> {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const exist = await accountExists(getSignerKeys(this.#context.getNetworkConfig()).account, this.#context);
    return !!exist;
  }

  async disconnect(_networkId?: string): Promise<void> {
    // no-op
  }
}
