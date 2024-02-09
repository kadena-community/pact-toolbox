import { IClient, ICommandResult, isSignedTransaction } from '@kadena/client';
import { genKeyPair } from '@kadena/cryptography-utils';
import { ICommand, IUnsignedCommand, PactValue } from '@kadena/types';

export function getCmdDataOrFail<T = PactValue>(response: ICommandResult): T {
  if (response.result.status === 'failure') {
    throw new Error(JSON.stringify(response.result.error));
  } else {
    return response.result.data as T;
  }
}

export function createDirtyReadOrFail(client: IClient) {
  return async <T = PactValue>(tx: IUnsignedCommand | ICommand): Promise<T> => {
    const res = await client.dirtyRead(tx);
    return getCmdDataOrFail<T>(res);
  };
}

export function createLocalOrFail(client: IClient) {
  return async <T = PactValue>(tx: IUnsignedCommand | ICommand): Promise<T> => {
    const res = await client.local(tx);
    return getCmdDataOrFail<T>(res);
  };
}

export function createSubmitAndListen(client: IClient) {
  return async <T>(signedTx: IUnsignedCommand | ICommand): Promise<T> => {
    if (isSignedTransaction(signedTx)) {
      const request = await client.submit(signedTx);
      const response = await client.listen(request);
      return getCmdDataOrFail<T>(response);
    } else {
      throw new Error('Not signed');
    }
  };
}

export function createClientUtils(client: IClient) {
  return {
    dirtyReadOrFail: createDirtyReadOrFail(client),
    localOrFail: createLocalOrFail(client),
    submitAndListen: createSubmitAndListen(client),
  };
}

export function getAccountKey(account: string) {
  return account.split(':')[1];
}

export function generateKAccount() {
  const { publicKey, secretKey } = genKeyPair();
  return {
    publicKey,
    secretKey,
    account: `k:${publicKey}`,
  };
}

export function generateKAccounts(count = 10) {
  return Array.from({ length: count }, () => generateKAccount());
}

export function pactDecimal(amount: string | number) {
  return {
    decimal: typeof amount === 'string' ? amount : amount.toFixed(12),
  };
}

export function generateUUID() {
  return crypto.randomUUID();
}
