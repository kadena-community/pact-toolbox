import { Pact, isSignedTransaction, readKeyset } from '@kadena/client';

import { defineCommand } from 'citty';
import { env } from 'process';
import { getAccountKey, pactDecimal } from '../utils';

// class CoinContract {
//   constructor(public readonly client: ClientWrapper) {}
//   async details(account: string) {
//     const transaction = this.client.execution(`(coin.details "${account}")`).createTransaction();
//     return this.client.dirtyRead(transaction);
//   }

//   async transfer(from: string, to: string, amount: string) {
//     const tx = this.client
//       .execution(Pact.modules.coin['transfer'](from, to, pactDecimal(amount)))
//       .addSigner(getAccountKey(from), (signFor) => [
//         signFor('coin.GAS'),
//         signFor('coin.TRANSFER', from, to, pactDecimal(amount)),
//       ])
//       .createTransaction();
//     const signedTx = await signWithFundingAccount(tx);
//     return this.client.submitAndListen(transaction);
//   }
// }

async function accountExists(account: string) {
  console.log('Checking if account exists...', account);
  const transaction = Pact.builder
    .execution(`(coin.details "${account}")`)
    .setMeta({ chainId: env.APP_CHAIN_ID, senderAccount: env.APP_FUNDING_ACCOUNT })
    .setNetworkId(env.APP_NETWORK_ID)
    .createTransaction();

  try {
    const response = await kdaClient.dirtyRead(transaction);
    const { result } = response;
    if (result.status === 'success') {
      return true;
    } else {
      console.error(result.error);
      return false;
    }
  } catch (e: unknown) {
    console.error((e as Error).message);
    return false;
  }
}

export async function fund(recipient: string, amount: string, preflight = false) {
  const fundingAccount = env.APP_FUNDING_ACCOUNT;
  const fundingAccountPublicKey = env.APP_FUNDING_ACCOUNT_PUBLIC_KEY;

  // check if the account exists
  const accountFound = await accountExists(recipient);
  console.log('Account found:', accountFound);
  const transaction = Pact.builder
    .execution(
      accountFound
        ? Pact.modules.coin['transfer'](fundingAccount, recipient, {
            decimal: amount,
          })
        : Pact.modules.coin['transfer-create'](fundingAccount, recipient, readKeyset('ks'), {
            decimal: amount,
          }),
    )
    .addData('ks', {
      keys: [getAccountKey(recipient)],
      pred: 'keys-all',
    })
    .addSigner(fundingAccountPublicKey, (signFor) => [
      signFor('coin.GAS'),
      signFor('coin.TRANSFER', fundingAccount, recipient, pactDecimal(amount)),
    ])
    .setMeta({ chainId: env.APP_CHAIN_ID, senderAccount: fundingAccount })
    .setNetworkId(env.APP_NETWORK_ID)
    .createTransaction();

  const signedTx = await signWithFundingAccount(transaction);
  if (preflight) {
    const preflightResponse = await kdaClient.preflight(signedTx);
    console.log(preflightResponse);
  }
  if (isSignedTransaction(signedTx)) {
    const transactionDescriptor = await kdaClient.submit(signedTx);
    const response = await kdaClient.listen(transactionDescriptor);
    if (response.result.status === 'failure') {
      throw response.result.error;
    } else {
      console.log(response.result);
    }
  }
}

export const fundCommand = defineCommand({
  meta: {
    name: 'fund',
    description: 'Fund existing account with amount or create account and fund it',
  },
  args: {
    recipient: {
      type: 'positional',
      name: 'recipient',
      description: 'Recipient account',
    },
    amount: {
      type: 'positional',
      name: 'amount',
      description: 'Amount',
    },
    preflight: {
      type: 'boolean',
      name: 'preflight',
      description: 'Preflight',
      defaultValue: false,
    },
  },
  run: async ({ args }) => {
    console.log(args);
    const { recipient, amount, preflight } = args;
    console.log('Funding account...', recipient, amount);
    await fund(recipient, amount, preflight);
  },
});

export const fundAdminCommand = defineCommand({
  meta: {
    name: 'fund-admin',
    description: 'Fund Admin account with amount or create account and fund it',
  },
  args: {
    amount: {
      type: 'positional',
      name: 'amount',
      description: 'Amount',
    },
    preflight: {
      type: 'boolean',
      name: 'preflight',
      description: 'Preflight',
      defaultValue: false,
    },
  },
  run: async ({ args }) => {
    // console.log(args);
    // const { amount, preflight } = args;
    // const recipient = env.APP_ADMIN_ACCOUNT;
    // console.log('Funding admin account...', recipient, amount);
    // await fund(recipient, amount, preflight);
  },
});
