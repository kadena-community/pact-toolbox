import type { PactKeyPair } from "@pact-toolbox/types";

import type { ToolboxNetworkContext } from "./network";
import { execution } from "./builder";
import { generateKAccount } from "./utils";

export interface CoinAccountDetails {
  balance: string;
  account: string;
}

export async function details(account: string, context?: ToolboxNetworkContext): Promise<CoinAccountDetails> {
  return execution<CoinAccountDetails>(`(coin.details "${account}")`).build(context).dirtyRead();
}

export async function accountExists(account: string, context?: ToolboxNetworkContext): Promise<boolean | undefined> {
  try {
    const acc = await details(account, context);
    if (acc) {
      return true;
    }
  } catch {
    return false;
  }
}

export async function createAccount(
  keyPair?: PactKeyPair,
  context?: ToolboxNetworkContext,
): Promise<CoinAccountDetails> {
  if (!keyPair) {
    keyPair = await generateKAccount();
  }
  const kAddress = `k:${keyPair.publicKey}`;
  await execution(`(coin.create-account "${kAddress}" (read-keyset 'ks))`)
    .withContext(context)
    .withMeta({ sender: kAddress })
    .withKeyset("ks", {
      pred: "keys-all",
      keys: [keyPair.publicKey],
    })
    .withSigner(keyPair.publicKey)
    .sign()
    .submitAndListen();

  return {
    balance: "0",
    account: kAddress,
  };
}

// export class CoinContract {
//   constructor(private client: KdaClient = createKadenaClient()) {}

//   async getBalance(account: string) {
//     const tx = execution(`(coin.get-balance "${account}")`).createTransaction();
//     return dirtyReadOrFail(this.client, tx);
//   }

//   async transfer(from: CoinAccount, to: string | CoinAccount, amount: number) {
//     const recipient = typeof to === 'string' ? to : to.account;
//     const tx = execution(`(coin.transfer "${from.account}" "${recipient}" ${pactDecimal(amount)})`)
//       .setMeta({ senderAccount: from.account })
//       .addSigner(from.publicKey, (signFor) => [
//         signFor('coin.GAS'),
//         signFor('coin.TRANSFER', from, to, pactDecimal(amount)),
//       ])
//       .createTransaction();

//     const signedTx = await this.client.sign(tx, from);
//     return this.client.submitAndListen(signedTx);
//   }

//   async transferCreate(from: CoinAccount, to: CoinAccount, amount: number) {
//     const tx = this.client
//       .execution(`(coin.transfer-create "${from}" "${to}" ${readKeyset('toKs')} ${pactDecimal(amount)})`)
//       .setMeta({ senderAccount: from.account })
//       .addKeyset('toKs', 'key-all', from.publicKey)
//       .addSigner(from.publicKey, (signFor) => [
//         signFor('coin.GAS'),
//         signFor('coin.TRANSFER', from, to, pactDecimal(amount)),
//       ])
//       .createTransaction();
//     const signedTx = await this.client.sign(tx, from);
//     return this.client.submitAndListen(signedTx);
//   }

//   async createAccount() {
//     const kAccount = generateKAccount();
//     return createAccount(this.client, this.client.sign, kAccount);
//   }

//   async details(account: string) {
//     return dirtyReadOrFail<CoinAccountDetails>(
//       this.client,
//       execution(`(coin.details "${account}")`).createTransaction(),
//     );
//   }

//   async accountExists(account: string) {
//     console.log('Checking if account exists...', account);

//     try {
//       const acc = await this.details(account);
//       if (acc) {
//         return true;
//       }
//     } catch (e: unknown) {
//       console.error((e as Error).message);
//       return false;
//     }
//   }

//   async fund(recipient: string | CoinAccount, amount: number) {
//     const fundingAccount = this.client.getSigner();
//     const r =
//       typeof recipient === 'string'
//         ? { account: recipient, publicKey: getAccountKey(recipient), secretKey: '' }
//         : recipient;
//     // check if the account exists
//     const accountFound = await this.accountExists(r.publicKey);
//     if (accountFound) {
//       await this.transfer(fundingAccount, recipient, amount);
//     } else {
//       await this.transferCreate(fundingAccount, r, amount);
//     }
//   }
// }
