import {
  createKadenaClient,
  createSignWithPactToolbox,
  getPactToolboxNetworkConfig,
  getSignerAccount,
  isPactToolboxInstalled,
} from '@pact-toolbox/client-utils';
import { accountExists, createAccount, details } from '@pact-toolbox/coin';
import { WalletProvider } from '../provider';

export class ToolboxWalletProvider implements WalletProvider {
  private client = createKadenaClient();

  constructor() {
    if (!this.isInstalled()) {
      throw new Error('Pact Toolbox not installed');
    }
  }

  sign = createSignWithPactToolbox();
  quickSign = createSignWithPactToolbox();

  isInstalled() {
    return isPactToolboxInstalled();
  }

  async connect(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const signer = getSignerAccount();
    try {
      const account = await details(this.client, signer.account);
      return {
        address: account.account,
        publicKey: signer.publicKey,
      };
    } catch (e) {
      const account = await createAccount(this.client, this.sign, signer);
      return {
        address: account.account,
        publicKey: signer.publicKey,
      };
    }
  }

  async getSigner(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const signer = getSignerAccount();
    return {
      address: signer.account,
      publicKey: signer.publicKey,
    };
  }

  async getAccountDetails(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }

    const signer = await this.getSigner(networkId);
    const d = await details(this.client, signer.address);
    return {
      address: d.account,
      publicKey: signer.publicKey,
      connectedSites: [],
      balance: parseFloat(d.balance),
    };
  }

  async getNetwork() {
    const networkConfig = getPactToolboxNetworkConfig();
    return {
      id: networkConfig.networkId,
      name: networkConfig.name,
      networkId: networkConfig.networkId,
      url: networkConfig.rpcUrl,
      isDefault: true,
    };
  }

  async isConnected(networkId?: string) {
    if (!networkId) {
      const network = await this.getNetwork();
      networkId = network.networkId;
    }
    const exist = await accountExists(this.client, getSignerAccount().account);
    return !!exist;
  }

  async disconnect(_networkId?: string) {
    // no-op
  }
}
