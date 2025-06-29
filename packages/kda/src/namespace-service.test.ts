import { describe, it, expect, vi, beforeEach } from "vitest";
import { NamespaceService } from "./namespace-service";
import { execution, type ToolboxNetworkContext } from "@pact-toolbox/transaction";
import type { PactKeyset } from "@pact-toolbox/types";
import * as pact from "./pact";

// Mock the crypto functions
vi.mock("@pact-toolbox/crypto", () => ({
  blake2b: vi.fn((input: Uint8Array, _key?: Uint8Array, _outLength?: number) => {
    // Create different hashes based on input content for testing
    const inputStr = new TextDecoder().decode(input);
    const hash = new Uint8Array(32);

    // Simple deterministic hash based on input content
    for (let i = 0; i < 32; i++) {
      hash[i] = (inputStr.charCodeAt(i % inputStr.length) + i) % 256;
    }

    return hash;
  }),
}));

// Mock the transaction module
vi.mock("@pact-toolbox/transaction", () => ({
  execution: vi.fn(),
}));

const mockExecution = vi.mocked(execution);

describe("NamespaceService", () => {
  let namespaceService: NamespaceService;
  let mockContext: ToolboxNetworkContext;

  const validKeyset: PactKeyset = {
    keys: ["a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".slice(0, 64)],
    pred: "keys-all",
  };

  const validMultiSigKeyset: PactKeyset = {
    keys: [
      "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890".slice(0, 64),
      "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12".slice(0, 64),
    ],
    pred: "keys-2",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {} as ToolboxNetworkContext;

    namespaceService = new NamespaceService({
      context: mockContext,
      defaultChainId: "0",
    });
  });

  describe("generatePrincipalNamespace", () => {
    it("should generate a principal namespace from a valid keyset", () => {
      const result = namespaceService.generatePrincipalNamespace(validKeyset);
      expect(result).toMatch(/^n_[a-fA-F0-9]{64}$/);
      expect(result.length).toBe(66); // "n_" + 64 hex chars
    });

    it("should generate the same namespace for the same keyset", () => {
      const result1 = namespaceService.generatePrincipalNamespace(validKeyset);
      const result2 = namespaceService.generatePrincipalNamespace(validKeyset);
      expect(result1).toBe(result2);
    });

    it("should generate different namespaces for different keysets", () => {
      const keyset2: PactKeyset = {
        keys: ["different1234567890123456789012345678901234567890123456789012345678".slice(0, 64)],
        pred: "keys-all",
      };

      const result1 = namespaceService.generatePrincipalNamespace(validKeyset);
      const result2 = namespaceService.generatePrincipalNamespace(keyset2);
      expect(result1).not.toBe(result2);
    });

    it("should sort keys for deterministic hashing", () => {
      const keyset1: PactKeyset = {
        keys: ["a123", "b123"].map((k) => k.padEnd(64, "0")),
        pred: "keys-all",
      };

      const keyset2: PactKeyset = {
        keys: ["b123", "a123"].map((k) => k.padEnd(64, "0")), // Different order
        pred: "keys-all",
      };

      const result1 = namespaceService.generatePrincipalNamespace(keyset1);
      const result2 = namespaceService.generatePrincipalNamespace(keyset2);
      expect(result1).toBe(result2);
    });

    it("should throw error for keyset with no keys", () => {
      const emptyKeyset: PactKeyset = {
        keys: [],
        pred: "keys-all",
      };

      expect(() => namespaceService.generatePrincipalNamespace(emptyKeyset)).toThrow(
        "Admin keyset must have at least one key",
      );
    });

    it("should throw error for keyset with no predicate", () => {
      const invalidKeyset = {
        keys: [validKeyset.keys[0]],
        pred: "",
      } as PactKeyset;

      expect(() => namespaceService.generatePrincipalNamespace(invalidKeyset)).toThrow(
        "Admin keyset must have a predicate",
      );
    });
  });

  describe("createPrincipalNamespace", () => {
    it("should create a principal namespace successfully", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await namespaceService.createPrincipalNamespace({
        adminKeyset: validKeyset,
        userKeyset: validMultiSigKeyset,
      });

      expect(result.status).toBe("success");
      expect(result.namespace).toMatch(/^n_[a-fA-F0-9]{64}$/);
      expect(result.transaction).toEqual(mockResult);
      expect(mockExecution).toHaveBeenCalledWith(expect.stringContaining("ns.create-principal-namespace"));
      expect(mockExecution).toHaveBeenCalledWith(expect.stringContaining("define-namespace"));
    });

    it("should use admin keyset as user keyset by default", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await namespaceService.createPrincipalNamespace({
        adminKeyset: validKeyset,
      });

      expect(result.status).toBe("success");
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("admin-keyset", validKeyset);
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("user-keyset", validKeyset);
    });

    it("should return error for invalid admin keyset", async () => {
      const invalidKeyset: PactKeyset = {
        keys: ["invalid-key"], // Too short
        pred: "keys-all",
      };

      const result = await namespaceService.createPrincipalNamespace({
        adminKeyset: invalidKeyset,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Invalid admin keyset for principal namespace creation");
    });

    it("should return error for invalid user keyset", async () => {
      const invalidKeyset: PactKeyset = {
        keys: ["invalid-key"], // Too short
        pred: "keys-all",
      };

      const result = await namespaceService.createPrincipalNamespace({
        adminKeyset: validKeyset,
        userKeyset: invalidKeyset,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Invalid user keyset for principal namespace creation");
    });

    it("should handle transaction errors", async () => {
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockRejectedValue(new Error("Transaction failed")),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await namespaceService.createPrincipalNamespace({
        adminKeyset: validKeyset,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Transaction failed");
    });
  });

  describe("validation integration", () => {
    it("should use validation functions from pact module", () => {
      // Test that isPrincipalNamespace is available from pact module
      expect(pact.isPrincipalNamespace("n_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")).toBe(
        true,
      );
      expect(pact.isPrincipalNamespace("regular-namespace")).toBe(false);

      // Test that validatePrincipalKeyset is available from pact module
      expect(pact.validatePrincipalKeyset(validKeyset)).toBe(true);
      expect(pact.validatePrincipalKeyset({ keys: ["short"], pred: "keys-all" })).toBe(false);

      // Test that validateNamespaceName is available from pact module
      expect(pact.validateNamespaceName("n_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")).toBe(
        true,
      );
      expect(pact.validateNamespaceName("invalid!")).toBe(false);
    });
  });
});
