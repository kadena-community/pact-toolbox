import type { IClient } from "@kadena/client";
import type { LocalPactTransactionResult, Transaction } from "@pact-toolbox/types";
import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";

import {
  MockClient,
  createLocalPactTransactionResult,
  createSignedTx,
  createTransactionDescriptor,
  createUnsignedTx,
} from "./test";
import {
  createKdaClientHelpers,
  dirtyReadOrFail,
  generateKAccount,
  generateKAccounts,
  getKAccountKey,
  getKdaClient,
  getTxDataOrFail,
  isWalletLike,
  listen,
  localOrFail,
  pactDecimal,
  preflight,
  submit,
  submitAndListen,
} from "./utils";

describe("KDA Client Helpers", () => {
  let client: IClient;

  beforeEach(() => {
    client = new MockClient() as unknown as IClient;
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

  describe("getKdaClient", () => {
    it("should return the client when it's an instance", () => {
      const result = getKdaClient(client);
      assert.strictEqual(result, client);
    });

    it("should return the client when it's a factory function", () => {
      const factory = () => client;
      const result = getKdaClient(factory);
      assert.strictEqual(result, client);
    });
  });

  describe("dirtyReadOrFail", () => {
    it("should return data for a single transaction", async () => {
      mock.method(client, "dirtyRead", () => {
        return createLocalPactTransactionResult("success", { value: "dirtyReadSuccess" });
      });
      const tx: Transaction = createSignedTx();
      const data = await dirtyReadOrFail(client, tx);
      assert.deepStrictEqual(data, { value: "dirtyReadSuccess" });
    });

    it("should return data for multiple transactions", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx()];
      mock.method(client, "dirtyRead", () => {
        return createLocalPactTransactionResult("success", { value: "dirtyReadSuccess" });
      });
      const data = await dirtyReadOrFail(client, txs);
      assert.deepStrictEqual(data, [{ value: "dirtyReadSuccess" }, { value: "dirtyReadSuccess" }]);
    });

    it("should throw an error if any transaction fails", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx("failure")];
      mock.method(client, "dirtyRead", (tx: Transaction) => {
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
      mock.method(client, "preflight", () => {
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
      mock.method(client, "preflight", () => {
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
      mock.method(client, "preflight", (tx: Transaction) => {
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
      mock.method(client, "preflight", () => {
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
      const result = [
        createTransactionDescriptor({
          requestKey: "requestKey0",
          networkId: "testnet04",
        }),
      ];
      mock.method(client, "submit", () => result);
      const descriptor = await submit(client, tx);
      assert.deepStrictEqual(descriptor, result[0]);
    });

    it("should submit multiple signed transactions", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx()];
      const result = [
        createTransactionDescriptor({
          requestKey: "requestKey0",
          networkId: "testnet04",
        }),
        createTransactionDescriptor({
          requestKey: "requestKey1",
          networkId: "testnet04",
        }),
      ];
      mock.method(client, "submit", () => result);
      const descriptors = await submit(client, txs);
      assert.deepStrictEqual(descriptors, result);
    });

    it("should throw an error if any transaction is not signed", async () => {
      const txs: Transaction[] = [createSignedTx(), createUnsignedTx()];
      await assert.rejects(submit(client, txs), /Not all transactions are signed/);
    });

    it("should perform preflight if requested", async () => {
      const tx: Transaction = createSignedTx();
      const preflightSpy = mock.method(client, "preflight", () => {
        return createLocalPactTransactionResult("success");
      });
      mock.method(client, "submit", () => [
        createTransactionDescriptor({
          requestKey: "requestKey0",
          networkId: "testnet04",
        }),
      ]);
      await submit(client, tx, true);
      assert.strictEqual(preflightSpy.mock.callCount(), 1);
    });
  });

  describe("listen", () => {
    it("should listen to a single transaction descriptor", async () => {
      const descriptor = createTransactionDescriptor();
      mock.method(client, "listen", () => {
        return createLocalPactTransactionResult("success", { value: "listenSuccess" });
      });
      const data = await listen(client, descriptor);
      assert.deepStrictEqual(data, { value: "listenSuccess" });
    });

    it("should listen to multiple transaction descriptors", async () => {
      const descriptors = [createTransactionDescriptor(), createTransactionDescriptor()];
      mock.method(client, "listen", () => {
        return createLocalPactTransactionResult("success", { value: "listenSuccess" });
      });
      const data = await listen(client, descriptors);
      assert.deepStrictEqual(data, [{ value: "listenSuccess" }, { value: "listenSuccess" }]);
    });

    it("should throw an error if listen fails", async () => {
      const descriptor = createTransactionDescriptor();
      mock.method(client, "listen", () => {
        return createLocalPactTransactionResult("failure");
      });
      await assert.rejects(listen(client, descriptor), /Transaction failed with error/);
    });
  });

  describe("submitAndListen", () => {
    it("should submit and listen to a single transaction", async () => {
      const tx: Transaction = createSignedTx();
      mock.method(client, "listen", () => {
        return createLocalPactTransactionResult("success", { value: "listenSuccess" });
      });
      mock.method(client, "submit", () => [
        createTransactionDescriptor({
          requestKey: "requestKey0",
          networkId: "testnet04",
        }),
      ]);
      const data = await submitAndListen(client, tx);
      assert.deepStrictEqual(data, { value: "listenSuccess" });
    });

    it("should submit and listen to multiple transactions", async () => {
      const txs: Transaction[] = [createSignedTx(), createSignedTx()];
      mock.method(client, "listen", () => {
        return createLocalPactTransactionResult("success", { value: "listenSuccess" });
      });
      mock.method(client, "submit", () => [
        createTransactionDescriptor({
          requestKey: "requestKey0",
          networkId: "testnet04",
        }),
        createTransactionDescriptor({
          requestKey: "requestKey1",
          networkId: "testnet04",
        }),
      ]);
      const data = await submitAndListen(client, txs);
      assert.deepStrictEqual(data, [{ value: "listenSuccess" }, { value: "listenSuccess" }]);
    });

    it("should throw an error if any transaction is not signed", async () => {
      const txs: Transaction[] = [createSignedTx(), createUnsignedTx()];
      await assert.rejects(submitAndListen(client, txs), /Not all transactions are signed/);
    });

    it("should perform preflight if requested", async () => {
      const tx: Transaction = createSignedTx();
      const preflightSpy = mock.method(client, "preflight", () => {
        return createLocalPactTransactionResult("success");
      });
      mock.method(client, "submit", () => [
        createTransactionDescriptor({
          requestKey: "requestKey0",
          networkId: "testnet04",
        }),
      ]);
      await submitAndListen(client, tx, true);
      assert.strictEqual(preflightSpy.mock.callCount(), 1);
    });
  });

  describe("createKdaClientHelpers", () => {
    it("should create helper functions bound to the client", async () => {
      mock.method(client, "dirtyRead", () => {
        return createLocalPactTransactionResult("success", { value: "dirtyReadSuccess" });
      });
      mock.method(client, "local", () => {
        return createLocalPactTransactionResult("success", { value: "localSuccess" });
      });
      mock.method(client, "submit", () => [
        createTransactionDescriptor({
          requestKey: "requestKey0",
          networkId: "testnet04",
        }),
      ]);
      mock.method(client, "listen", () => {
        return createLocalPactTransactionResult("success", { value: "listenSuccess" });
      });

      const helpers = createKdaClientHelpers(client);

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

  describe("isWalletLike", () => {
    it("should return true for objects with 'sign' method", () => {
      const wallet: unknown = {
        sign: () => {},
      };
      assert.strictEqual(isWalletLike(wallet), true);
    });

    it("should return true for objects with 'quickSign' method", () => {
      const wallet: unknown = {
        quickSign: async () => {},
      };
      assert.strictEqual(isWalletLike(wallet), true);
    });

    it("should return true for functions", () => {
      assert.strictEqual(
        isWalletLike(function () {}),
        true,
      );
    });

    it("should return false for non-wallet objects", () => {
      const wallet = { invalid: "property" };
      assert.strictEqual(isWalletLike(wallet), false);
    });

    it("should return false for non-objects", () => {
      assert.strictEqual(isWalletLike(undefined), false);
      assert.strictEqual(isWalletLike(null), false);
      assert.strictEqual(isWalletLike(123), false);
      assert.strictEqual(isWalletLike("wallet"), false);
    });
  });
});
