import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import type { Stats } from "node:fs";

const mockReadFile = vi.fn();
const mockStat = vi.fn();
const mockRm = vi.fn();

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    readFile: mockReadFile,
    stat: mockStat,
    rm: mockRm,
  };
});

vi.mock("../../client/src/utils", () => ({
  submit: vi.fn(),
  dirtyReadOrFail: vi.fn(),
}));

describe.skip("PactToolboxClient", async () => {
  const { PactToolboxClient } = await import("./client");
  const { submit, dirtyReadOrFail } = await import("../../client/src/utils");
  let client = new PactToolboxClient();

  beforeEach(() => {
    client = new PactToolboxClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Deployment", () => {
    it("should deploy a contract with single chainId", async () => {
      mockReadFile.mockResolvedValue("dummy code");
      mockStat.mockResolvedValue({} as Stats);
      (submit as any).mockResolvedValue({ requestKey: "test-request-key" });

      const deployResult = (await client.deployContract("dummy-path", { listen: false }, "1")) as any;

      assert.equal(deployResult.requestKey, "test-request-key");
    });

    it("should deploy a contract with multiple chainIds", async () => {
      mockReadFile.mockResolvedValue("dummy code");
      mockStat.mockResolvedValue({} as Stats);
      (submit as any).mockResolvedValue({
        requestKey: "test-request-key",
      });

      const deployResult = await client.deployContract("dummy-path", { listen: false }, ["1", "2"]);
      assert.equal(deployResult.length, 2);
    });

    it("should throw error if contract file not found", async () => {
      mockStat.mockRejectedValue(new Error("File not found"));

      await assert.rejects(async () => {
        await client.getContractCode("non-existent-path");
      }, /Contract file not found: .*non-existent-path/);
    });
  });

  describe("Utility Methods", () => {
    it("should describe a module", async () => {
      (dirtyReadOrFail as any).mockResolvedValue({
        result: { data: "test-module-code" },
      });
      const result = await client.describeModule("test-module");
      assert.strictEqual(result, "test-module-code");
    });

    it("should describe a namespace", async () => {
      (dirtyReadOrFail as any).mockResolvedValue({
        result: { data: "test-namespace-code" },
      });
      const result = await client.describeNamespace("test-namespace");
      assert.strictEqual(result, "test-namespace-code");
    });

    it("should check if a namespace is defined", async () => {
      (dirtyReadOrFail as any).mockResolvedValue({
        result: { data: "test-namespace-code" },
      });
      const isDefined = await client.isNamespaceDefined("test-namespace");
      assert.strictEqual(isDefined, true);
    });

    it("should return false if a namespace is not defined", async () => {
      (dirtyReadOrFail as any).mockRejectedValue(new Error("not found"));
      const isDefined = await client.isNamespaceDefined("non-existent-namespace");
      assert.strictEqual(isDefined, false);
    });

    it("should check if a contract is deployed", async () => {
      (dirtyReadOrFail as any).mockResolvedValue({
        result: { data: "test-module-code" },
      });
      const isDeployed = await client.isContractDeployed("test-module");
      assert.strictEqual(isDeployed, true);
    });

    it("should return false if a contract is not deployed", async () => {
      (dirtyReadOrFail as any).mockRejectedValue(new Error("not found"));
      const isDeployed = await client.isContractDeployed("non-existent-module");
      assert.strictEqual(isDeployed, false);
    });
  });
});
