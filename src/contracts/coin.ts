import { IKeyPair, readKeyset } from '@kadena/client';
import { genKeyPair } from '@kadena/cryptography-utils';
import { PactToolboxClient } from '../client';
import { pactDecimal } from '../utils';
interface CoinAccount extends IKeyPair {
  account: `k:${string}`;
}

interface CoinAccountDetails {
  balance: string;
  account: `k:${string}`;
}

export class CoinContract {
  constructor(private client: PactToolboxClient) {}

  async getBalance(account: string) {
    return this.client.dirtyRead(this.client.execution(`(coin.get-balance "${account}")`).createTransaction());
  }

  async transfer(from: CoinAccount, to: CoinAccount, amount: number) {
    const tx = this.client
      .execution(`(coin.transfer "${from}" "${to}" ${pactDecimal(amount)})`)
      .setMeta({ senderAccount: from.account })
      .addSigner(from.publicKey, (signFor) => [
        signFor('coin.GAS'),
        signFor('coin.TRANSFER', from, to, pactDecimal(amount)),
      ])
      .createTransaction();

    const signedTx = await this.client.sign(tx, from);
    return this.client.submitAndListen(signedTx);
  }

  async transferCreate(from: CoinAccount, to: CoinAccount, amount: number) {
    const tx = this.client
      .execution(`(coin.transfer-create "${from}" "${to}" ${readKeyset('toKs')} ${pactDecimal(amount)})`)
      .setMeta({ senderAccount: from.account })
      .addKeyset('toKs', 'key-all', from.publicKey)
      .addSigner(from.publicKey, (signFor) => [
        signFor('coin.GAS'),
        signFor('coin.TRANSFER', from, to, pactDecimal(amount)),
      ])
      .createTransaction();
    const signedTx = await this.client.sign(tx, from);
    return this.client.submitAndListen(signedTx);
  }

  async createAccount() {
    const keys = genKeyPair();
    const account = `k:${keys.publicKey}`;
    const tx = this.client
      .execution(`(coin.create-account "${account}" ${readKeyset('ks')})`)
      .setMeta({ senderAccount: account })
      .addKeyset('ks', 'key-all', keys.publicKey)
      .addSigner(keys.publicKey)
      .createTransaction();
    const signedTx = await this.client.sign(tx, keys);
    await this.client.submitAndListen(signedTx);
    return {
      ...keys,
      account,
    };
  }

  async details(account: string) {
    return this.client.dirtyRead<CoinAccountDetails>(
      this.client.execution(`(coin.details "${account}")`).createTransaction(),
    );
  }
}
