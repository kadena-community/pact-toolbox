import { ICommandResult } from '@kadena/client';
import { genKeyPair } from '@kadena/cryptography-utils';
import { PactValue } from '@kadena/types';
import Handlebars from 'handlebars';
export function getCmdDataOrFail<T = PactValue>(response: ICommandResult): T {
  if (response.result.status === 'failure') {
    console.error(response.result.error);
    throw new Error(JSON.stringify(response.result.error));
  } else {
    return response.result.data as T;
  }
}

export function getAccountKey(account: string) {
  return account.split(':')[1];
}

export function createTestAccount(count = 10) {
  return Array.from({ length: count }, () => {
    const { publicKey, secretKey } = genKeyPair();
    return {
      publicKey,
      secretKey,
      account: `k:${publicKey}`,
    };
  });
}

export function pactDecimal(amount: string | number) {
  return {
    decimal: typeof amount === 'string' ? amount : amount.toFixed(12),
  };
}

export function renderTemplate(template: string, data: any) {
  const compiled = Handlebars.compile(template);
  return compiled(data);
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
