import type {
  LocalPactTransactionResult,
  PactTransactionDescriptor,
  PactTransactionResult,
  PactUnsignedTransaction,
  Transaction,
} from "@pact-toolbox/types";

export function createUnsignedTx(status: "success" | "failure" = "success"): PactUnsignedTransaction {
  return {
    cmd: status === "success" ? "TEST" : "FAIL",
    hash: "hash",
    sigs: [undefined],
  };
}

export function createSignedTx(status: "success" | "failure" = "success"): Transaction {
  return {
    cmd: status === "success" ? "TEST" : "FAIL",
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
      status === "success"
        ? { status, data: dataOrError ?? { value: "testData" } }
        : { status, error: dataOrError ?? { message: "Transaction failed with error" } },
    continuation: null,
    gas: 0,
    metaData: {
      blockHash: "blockHash",
      blockHeight: 123,
      blockTime: 1234567890,
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

// Mock implementations
export class MockClient {
  async local(tx: Transaction): Promise<LocalPactTransactionResult> {
    if (tx.cmd === "FAIL") {
      return createLocalPactTransactionResult("failure");
    }
    return createLocalPactTransactionResult("success");
  }

  async dirtyRead(tx: Transaction): Promise<LocalPactTransactionResult> {
    return this.local(tx);
  }

  async preflight(tx: Transaction): Promise<LocalPactTransactionResult> {
    if (tx.cmd === "PREFAIL") {
      return createLocalPactTransactionResult("failure");
    }
    return {
      ...createLocalPactTransactionResult("success"),
      preflightWarnings: ["Warning: Check your transaction"],
    };
  }

  async submit(txs: Transaction[]): Promise<PactTransactionDescriptor[]> {
    return txs.map((tx, index) => ({
      requestKey: `requestKey${index}`,
      networkId: "testnet04",
      chainId: "0",
    }));
  }

  async listen(req: PactTransactionDescriptor): Promise<PactTransactionResult> {
    return createPactTransactionResult("success");
  }
}
