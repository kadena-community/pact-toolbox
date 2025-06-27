import type {
  LocalPactTransactionResult,
  PactTransactionDescriptor,
  PactTransactionResult,
  PartiallySignedTransaction,
  Transaction,
  TransactionPartialSig,
} from "@pact-toolbox/types";

export function createUnsignedTx(status: "success" | "failure" = "success"): PartiallySignedTransaction {
  return {
    cmd: "success" === status ? "TEST" : "FAIL",
    hash: "hash",
    sigs: [undefined] as unknown as TransactionPartialSig[],
  };
}

export function createSignedTx(status: "success" | "failure" = "success"): Transaction {
  return {
    cmd: "success" === status ? "TEST" : "FAIL",
    sigs: [
      {
        sig: "signature",
      },
    ],
    hash: "hash",
  };
}

export function createPactTransactionResult(
  status: "success" | "failure",
  dataOrError?: object,
): PactTransactionResult {
  return {
    result:
      "success" === status
        ? { status, data: dataOrError ?? { value: "testData" } }
        : { status, error: dataOrError ?? { message: "Transaction failed with error" } },
    continuation: null,
    gas: 0,
    metaData: {
      blockHash: "blockHash",
      blockHeight: 123,
      blockTime: 1_234_567_890,
      prevBlockHash: "prevBlockHash",
    },
    logs: "logs",
    reqKey: "reqKey",
    txId: 0,
  };
}

export function createLocalPactTransactionResult(
  status: "success" | "failure",
  dataOrError?: object,
): LocalPactTransactionResult {
  const result = createPactTransactionResult(status, dataOrError);
  return {
    ...result,
    preflightWarnings: [],
  };
}

export function createTransactionDescriptor(overrides?: Partial<PactTransactionDescriptor>): PactTransactionDescriptor {
  return {
    requestKey: "requestKey",
    networkId: "testnet04",
    chainId: "0",
    ...overrides,
  };
}

// Mock implementations matching ChainwebClient API
export class MockClient {
  async local(command: any): Promise<LocalPactTransactionResult> {
    if ("FAIL" === command.cmd) {
      return createLocalPactTransactionResult("failure");
    }
    return createLocalPactTransactionResult("success");
  }

  async send(transactions: Transaction[]): Promise<{ requestKeys: string[]; response: any }> {
    const requestKeys = transactions.map((tx, index) => `requestKey${index}`);
    return {
      requestKeys,
      response: { status: "success" },
    };
  }

  async listen(requestKey: string): Promise<{ requestKey: string; result: PactTransactionResult }> {
    return {
      requestKey,
      result: createPactTransactionResult("success"),
    };
  }

  async poll(requestKeys: string[]): Promise<Record<string, PactTransactionResult>> {
    const result: Record<string, PactTransactionResult> = {};
    for (const key of requestKeys) {
      result[key] = createPactTransactionResult("success");
    }
    return result;
  }
}
