import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { Stats } from "node:fs";

const mockReadFile = mock.fn(readFile);
const mockStat = mock.fn(stat);
const mockRm = mock.fn(rm);

// Mocking fs.promises
mock.module("node:fs/promises", {
  namedExports: {
    readFile: mockReadFile,
    stat: mockStat,
    rm: mockRm,
  },
});

describe("PactToolboxClient", async () => {
  const { PactToolboxClient } = await import("./client");
  let client = new PactToolboxClient();

  beforeEach(() => {
    client = new PactToolboxClient();
  });

  afterEach(() => {
    mockReadFile.mock.resetCalls();
    mockStat.mock.resetCalls();
    mockRm.mock.resetCalls();
  });

  // describe("Configuration", () => {
  //   it("should initialize with default config", () => {
  //     const config = client.getConfig();
  //     assert.deepStrictEqual(config, defaultConfig);
  //   });

  //   it("should set and get configuration", () => {
  //     const newConfig: any = { contractsDir: "new-pact", networks: { local: createLocalNetworkConfig() } };
  //     client.setConfig(newConfig);
  //     assert.strictEqual(client.getContractsDir(), "new-pact");
  //   });
  // });

  // describe("Signer Management", () => {
  //   it("should retrieve a signer by address", () => {
  //     const signer = client.getSigner("sender00");
  //     assert.equal(signer.account, "sender00");
  //     // assert.equal(signer.publicKey, "env-public");
  //   });

  //   it("should retrieve a signer object directly", () => {
  //     const signer = client.getSigner({ account: "direct-signer", publicKey: "direct-public-key" });
  //     assert.deepStrictEqual(signer, { account: "direct-signer", publicKey: "direct-public-key" });
  //   });

  //   it("should throw error for invalid signer", () => {
  //     // Assuming isValidateSigner checks for required fields
  //     const invalidSigner = { account: "invalid-signer" }; // Missing publicKey
  //     assert.rejects(async () => {
  //       // Temporarily override getSigner to return invalid signer
  //       (client as any).getSigner = () => invalidSigner;
  //       await client.deployCode("dummy-code");
  //     }, /Invalid signer/);
  //   });
  // });

  describe("Deployment", () => {
    it("should deploy a contract with single chainId", async () => {
      // Mock getContractCode to return dummy code
      // @ts-expect-error
      mockReadFile.mock.mockImplementation(async () => "dummy code");
      // @ts-expect-error
      mockStat.mock.mockImplementation(async () => ({}) as Stats);

      // fetchMock.mock.mockImplementation

      const deployResult = (await client.deployContract("dummy-path", { listen: false }, "1")) as any;

      assert.equal(deployResult.requestKey, "test-request-key");
    });

    it("should deploy a contract with multiple chainIds", async () => {
      // Mock getContractCode to return dummy code
      // @ts-expect-error
      mockReadFile.mock.mockImplementation(async () => "dummy code");
      // @ts-expect-error
      mockStat.mock.mockImplementation(async () => ({}) as Stats);

      const deployResult = await client.deployContract("dummy-path", { listen: false }, ["1", "2"]);
      console.log(deployResult);
      assert.equal(deployResult.length, 2);
    });

    it("should throw error if contract file not found", async () => {
      // Mock stat to throw an error
      mockStat.mock.mockImplementation(async () => Promise.reject(new Error("File not found")));

      await assert.rejects(async () => {
        await client.getContractCode("non-existent-path");
      }, /Contract file not found: .*non-existent-path/);
    });
  });

  describe("Utility Methods", () => {
    it("should describe a module", async () => {
      const result = await client.describeModule("test-module");
      assert.strictEqual(result, "");
    });

    it("should describe a namespace", async () => {
      const result = await client.describeNamespace("test-namespace");
      assert.strictEqual(result, "");
    });

    it("should check if a namespace is defined", async () => {
      const isDefined = await client.isNamespaceDefined("test-namespace");
      assert.strictEqual(isDefined, true);
    });

    it("should return false if a namespace is not defined", async () => {
      // Mock describeNamespace to throw an error
      mock.method(client, "describeNamespace", () => Promise.reject(new Error("Namespace not found")));

      const isDefined = await client.isNamespaceDefined("non-existent-namespace");
      assert.strictEqual(isDefined, false);
    });

    it("should check if a contract is deployed", async () => {
      const isDeployed = await client.isContractDeployed("test-module");
      assert.strictEqual(isDeployed, true);
    });

    it("should return false if a contract is not deployed", async () => {
      // Mock describeModule to throw an error
      mock.method(client, "describeModule", () => Promise.reject(new Error("Module not found")));

      const isDeployed = await client.isContractDeployed("non-existent-module");
      assert.strictEqual(isDeployed, false);
    });
  });
});
