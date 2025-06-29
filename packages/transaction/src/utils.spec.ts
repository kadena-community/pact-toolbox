import type { ChainwebClient } from "@pact-toolbox/chainweb-client";
import type { LocalPactTransactionResult, Transaction } from "@pact-toolbox/types";
import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";

import {
  MockClient,
  createLocalPactTransactionResult,
  createPactTransactionResult,
  createSignedTx,
  createTransactionDescriptor,
  createUnsignedTx,
} from "./test";
import {
  createClientHelpers,
  dirtyReadOrFail,
  getClient,
  getTxDataOrFail,
  listen,
  localOrFail,
  preflight,
  submit,
  submitAndListen,
} from "@pact-toolbox/chainweb-client";
import { generateKAccount, generateKAccounts, getKAccountKey, pactDecimal } from "./utils";

describe("Chainweb Client Helpers", () => {
  let client: ChainwebClient;

  beforeEach(() => {
    client = new MockClient() as unknown as ChainwebClient;
  });

  describe("getTxDataOrFail", () => {
    it("should return data when status is success", () => {
      const response = createLocalPactTransactionResult("success");
      const data = getTxDataOrFail<string>(response);
      assert.deepStrictEqual(data, { value: "testData" });
    });

    it("should throw an error when status is failure", () => {
      const response = createLocalPactTransactionResult("failure");
      assert.throws(() => getTxDataOrFail(response), /Transaction failed with error/);
    });
  });

  describe("getClient", () => {
    it("should return the client when it's an instance", () => {
      const result = getClient(client);
      assert.strictEqual(result, client);
    });

    it("should return the client when it's a factory function", () => {
      const factory = () => client;
      const result = getClient(factory);
      assert.strictEqual(result, client);
    });
  });

  describe("dirtyReadOrFail", () => {
    it("should return data for a single transaction", async () => {
      mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success", { value: "dirtyReadSuccess" });
      });
      const tx: Transaction = createSignedTx();
      const data = await dirtyReadOrFail(client, tx);
      assert.deepStrictEqual(data, { value: "dirtyReadSuccess" });
    });

    it("should return data for multiple transactions", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx()];
      mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success", { value: "dirtyReadSuccess" });
      });
      const data = await dirtyReadOrFail(client, txs);
      assert.deepStrictEqual(data, [{ value: "dirtyReadSuccess" }, { value: "dirtyReadSuccess" }]);
    });

    it("should throw an error if any transaction fails", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx("failure")];
      mock.method(client, "local", (tx: Transaction) => {
        return "FAIL" === tx.cmd
          ? createLocalPactTransactionResult("failure")
          : createLocalPactTransactionResult("success");
      });
      await assert.rejects(dirtyReadOrFail(client, txs), /Transaction failed with error/);
    });
  });

  describe("localOrFail", () => {
    it("should return data for a single transaction", async () => {
      const tx: Transaction = createSignedTx();
      mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success", { value: "localSuccess" });
      });
      const data = await localOrFail(client, tx);
      assert.deepStrictEqual(data, { value: "localSuccess" });
    });

    it("should return data for multiple transactions", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx()];
      mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success", { value: "localSuccess" });
      });
      const data = await localOrFail(client, txs);
      assert.deepStrictEqual(data, [{ value: "localSuccess" }, { value: "localSuccess" }]);
    });

    it("should throw an error if any transaction fails", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx("failure")];
      mock.method(client, "local", (tx: Transaction) => {
        return "FAIL" === tx.cmd
          ? createLocalPactTransactionResult("failure")
          : createLocalPactTransactionResult("success");
      });
      await assert.rejects(localOrFail(client, txs), /Transaction failed with error/);
    });
  });

  describe("preflight", () => {
    it("should perform preflight for a single transaction", async () => {
      const tx: Transaction = createSignedTx();
      mock.method(client, "local", () => {
        return {
          ...createLocalPactTransactionResult("success"),
          preflightWarnings: ["Warning: Check your transaction"],
        };
      });
      const result = (await preflight(client, tx)) as LocalPactTransactionResult;
      assert.strictEqual(result.preflightWarnings?.[0], "Warning: Check your transaction");
    });

    it("should perform preflight for multiple transactions", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx()];
      mock.method(client, "local", () => {
        return {
          ...createLocalPactTransactionResult("success"),
          preflightWarnings: ["Warning: Check your transaction"],
        };
      });
      const result = (await preflight(client, txs)) as LocalPactTransactionResult[];
      assert.strictEqual(result.length, 2);
    });

    it("should throw an error if any preflight fails", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx("failure")];
      mock.method(client, "local", (tx: Transaction) => {
        return "FAIL" === tx.cmd
          ? createLocalPactTransactionResult("failure")
          : createLocalPactTransactionResult("success");
      });
      await assert.rejects(preflight(client, txs), /Preflight failed/);
    });

    it("should log warnings if present", async () => {
      const tx: Transaction = createSignedTx();
      const consoleWarn = console.warn;
      let warningLogged = false;
      console.warn = () => {
        warningLogged = true;
      };
      mock.method(client, "local", () => {
        return {
          ...createLocalPactTransactionResult("success"),
          preflightWarnings: ["Warning: Check your transaction"],
        };
      });
      await preflight(client, tx);
      assert.strictEqual(warningLogged, true);
      console.warn = consoleWarn;
    });
  });

  describe("submit", () => {
    it("should submit a single signed transaction", async () => {
      const tx: Transaction = createSignedTx();
      mock.method(client, "send", () => ({ requestKeys: ["requestKey0"], response: {} }));
      const descriptor = await submit(client, tx);
      assert.deepStrictEqual(descriptor, {
        requestKey: "requestKey0",
        chainId: "0",
        networkId: "development",
      });
    });

    it("should submit multiple signed transactions", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx()];
      mock.method(client, "send", () => ({ requestKeys: ["requestKey0", "requestKey1"], response: {} }));
      const descriptors = await submit(client, txs);
      assert.deepStrictEqual(descriptors, [
        {
          requestKey: "requestKey0",
          chainId: "0",
          networkId: "development",
        },
        {
          requestKey: "requestKey1",
          chainId: "0",
          networkId: "development",
        },
      ]);
    });

    it("should throw an error if any transaction is not signed", async () => {
      const txs: Transaction[] = [createSignedTx(), createUnsignedTx()];
      await assert.rejects(submit(client, txs), /Not all transactions are signed/);
    });

    it("should perform preflight if requested", async () => {
      const tx: Transaction = createSignedTx();
      const preflightSpy = mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success");
      });
      mock.method(client, "send", () => ({ requestKeys: ["requestKey0"], response: {} }));
      await submit(client, tx, true);
      assert.strictEqual(preflightSpy.mock.callCount(), 1);
    });
  });

  describe("listen", () => {
    it("should listen to a single transaction descriptor", async () => {
      const descriptor = createTransactionDescriptor();
      mock.method(client, "listen", () => {
        return {
          requestKey: descriptor.requestKey,
          result: createPactTransactionResult("success", { value: "listenSuccess" }),
        };
      });
      const data = await listen(client, descriptor);
      assert.deepStrictEqual(data, { value: "listenSuccess" });
    });

    it("should listen to multiple transaction descriptors", async () => {
      const descriptors = [createTransactionDescriptor(), createTransactionDescriptor()];
      mock.method(client, "listen", () => {
        return {
          requestKey: "requestKey",
          result: createPactTransactionResult("success", { value: "listenSuccess" }),
        };
      });
      const data = await listen(client, descriptors);
      assert.deepStrictEqual(data, [{ value: "listenSuccess" }, { value: "listenSuccess" }]);
    });

    it("should throw an error if listen fails", async () => {
      const descriptor = createTransactionDescriptor();
      mock.method(client, "listen", () => {
        return {
          requestKey: descriptor.requestKey,
          result: createPactTransactionResult("failure"),
        };
      });
      await assert.rejects(listen(client, descriptor), /Transaction failed with error/);
    });
  });

  describe("submitAndListen", () => {
    it("should submit and listen to a single transaction", async () => {
      const tx: Transaction = createSignedTx();
      mock.method(client, "listen", () => {
        return {
          requestKey: "requestKey0",
          result: createPactTransactionResult("success", { value: "listenSuccess" }),
        };
      });
      mock.method(client, "send", () => ({ requestKeys: ["requestKey0"], response: {} }));
      const data = await submitAndListen(client, tx);
      assert.deepStrictEqual(data, { value: "listenSuccess" });
    });

    it("should submit and listen to multiple transactions", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx()];
      mock.method(client, "listen", () => {
        return {
          requestKey: "requestKey0",
          result: createPactTransactionResult("success", { value: "listenSuccess" }),
        };
      });
      mock.method(client, "send", () => ({ requestKeys: ["requestKey0", "requestKey1"], response: {} }));
      const data = await submitAndListen(client, txs);
      assert.deepStrictEqual(data, [{ value: "listenSuccess" }, { value: "listenSuccess" }]);
    });

    it("should throw an error if any transaction is not signed", async () => {
      const txs: Transaction[] = [createSignedTx(), createUnsignedTx()];
      await assert.rejects(submitAndListen(client, txs), /Not all transactions are signed/);
    });

    it("should perform preflight if requested", async () => {
      const tx: Transaction = createSignedTx();
      const preflightSpy = mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success");
      });
      mock.method(client, "send", () => ({ requestKeys: ["requestKey0"], response: {} }));
      await submitAndListen(client, tx, true);
      assert.strictEqual(preflightSpy.mock.callCount(), 1);
    });
  });

  describe("createClientHelpers", () => {
    it("should create helper functions bound to the client", async () => {
      mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success", { value: "dirtyReadSuccess" });
      });
      mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success", { value: "localSuccess" });
      });
      mock.method(client, "send", () => ({ requestKeys: ["requestKey0"], response: {} }));
      mock.method(client, "listen", () => {
        return {
          requestKey: "requestKey0",
          result: createPactTransactionResult("success", { value: "listenSuccess" }),
        };
      });

      const helpers = createClientHelpers(client);

      const dirtyData = await helpers.dirtyReadOrFail(createUnsignedTx("success"));
      assert.deepStrictEqual(dirtyData, { value: "dirtyReadSuccess" });

      const localData = await helpers.localOrFail(createSignedTx());
      assert.deepStrictEqual(localData, { value: "localSuccess" });

      const listenData = await helpers.submitAndListen({
        cmd: "TEST",
        sigs: [{ sig: "signature" }],
        hash: "hash",
      });
      assert.deepStrictEqual(listenData, { value: "listenSuccess" });
    });
  });

  describe("getKAccountKey", () => {
    it("should remove 'k:' prefix from account", () => {
      const account = "k:publicKey123";
      const key = getKAccountKey(account);
      assert.strictEqual(key, "publicKey123");
    });

    it("should return the account as-is if no 'k:' prefix", () => {
      const account = "publicKey123";
      const key = getKAccountKey(account);
      assert.strictEqual(key, "publicKey123");
    });
  });

  describe("generateKAccount", () => {
    it("should generate a valid K-account", async () => {
      const account = await generateKAccount();
      assert.ok(account.publicKey);
      assert.ok(account.secretKey);
      assert.strictEqual(account.account, `k:${account.publicKey}`);
    });
  });

  describe("generateKAccounts", () => {
    it("should generate the specified number of K-accounts", async () => {
      const count = 5;
      const accounts = await generateKAccounts(count);
      assert.strictEqual(accounts.length, count);
      accounts.forEach((account) => {
        assert.ok(account.publicKey);
        assert.ok(account.secretKey);
        assert.strictEqual(account.account, `k:${account.publicKey}`);
      });
    });

    it("should default to 10 accounts if no count is provided", async () => {
      const accounts = await generateKAccounts();
      assert.strictEqual(accounts.length, 10);
    });
  });

  describe("pactDecimal", () => {
    it("should format a number to 12 decimal places", () => {
      const amount = 123.456;
      const decimal = pactDecimal(amount);
      assert.strictEqual(decimal.decimal, "123.456000000000");
    });

    it("should accept a string and return it as-is", () => {
      const amount = "789.012345678901";
      const decimal = pactDecimal(amount);
      assert.strictEqual(decimal.decimal, "789.012345678901");
    });
  });
});
