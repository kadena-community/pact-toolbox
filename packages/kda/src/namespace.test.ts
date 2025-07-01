import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { createPrincipalNamespace, createPrincipal, defineNamespace } from "./namespace";
import type { WalletLike, PactKeyset } from "@pact-toolbox/types";

vi.mock("@pact-toolbox/transaction", () => ({
  execution: vi.fn(() => ({
    withChainId: vi.fn().mockReturnThis(),
    withMeta: vi.fn().mockReturnThis(),
    withKeyset: vi.fn().mockReturnThis(),
    withSigner: vi.fn().mockReturnThis(),
    sign: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnThis(),
    dirtyRead: vi.fn(),
    submitAndListen: vi.fn(),
  })),
  getWallet: vi.fn(() =>
    Promise.resolve({
      getAccount: vi.fn(() =>
        Promise.resolve({
          address: "k:test-address",
          publicKey: "test-public-key",
        }),
      ),
    }),
  ),
}));

describe("Namespace Functions", () => {
  let mockNetworkProvider: NetworkConfigProvider;
  let mockWallet: WalletLike;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNetworkProvider = {
      getNetwork: vi.fn(() => ({
        networkId: "testnet04",
        chainweb: {
          endpoints: ["https://api.testnet.chainweb.com"],
        },
      })),
    } as any;

    mockWallet = {
      getAccount: vi.fn().mockResolvedValue({
        address: "k:admin-address",
        publicKey: "admin-public-key",
      }),
    } as any;
  });

  describe("createPrincipalNamespace", () => {
    it("should create a principal namespace successfully", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("n_1234567890abcdef"),
      };

      mockExecution.mockReturnValue(executeChain);

      const adminKeyset: PactKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };

      const result = await createPrincipalNamespace({
        adminKeyset,
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(result.status).toBe("success");
      expect(result.namespace).toBe("n_1234567890abcdef");
      expect(result.result).toBe("n_1234567890abcdef");
      expect(mockExecution).toHaveBeenCalledWith(
        expect.stringContaining("ns.create-principal-namespace"),
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("ns-admin", adminKeyset);
      expect(executeChain.withKeyset).toHaveBeenCalledWith("ns-user", adminKeyset);
    });

    it("should use custom user keyset when provided", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("namespace-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const adminKeyset: PactKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };

      const userKeyset: PactKeyset = {
        keys: ["fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"],
        pred: "keys-any",
      };

      const result = await createPrincipalNamespace({
        adminKeyset,
        userKeyset,
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(result.status).toBe("success");
      expect(executeChain.withKeyset).toHaveBeenCalledWith("ns-admin", adminKeyset);
      expect(executeChain.withKeyset).toHaveBeenCalledWith("ns-user", userKeyset);
    });

    it("should return error for invalid keyset", async () => {
      const invalidKeyset: PactKeyset = {
        keys: ["invalid-key"], // Too short to be a valid public key
        pred: "keys-all",
      };

      const result = await createPrincipalNamespace({
        adminKeyset: invalidKeyset,
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Invalid principal keyset");
      expect(result.namespace).toBe("");
    });

    it("should handle transaction errors", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockRejectedValue(new Error("Transaction failed")),
      };

      mockExecution.mockReturnValue(executeChain);

      const adminKeyset: PactKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };

      const result = await createPrincipalNamespace({
        adminKeyset,
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Transaction failed");
    });

    it("should handle no signer available error", async () => {
      const { getWallet } = await import("@pact-toolbox/transaction");
      const mockGetWallet = getWallet as any;

      const noSignerWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue(null),
      } as any;

      mockGetWallet.mockResolvedValue(noSignerWallet);

      const adminKeyset: PactKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };

      const result = await createPrincipalNamespace({
        adminKeyset,
        wallet: noSignerWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("No signer available for namespace creation");
    });

    it("should use default chain ID when not specified", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const adminKeyset: PactKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };

      await createPrincipalNamespace({
        adminKeyset,
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(executeChain.withChainId).toHaveBeenCalledWith("0");
    });

    it("should use custom chain ID when specified", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const adminKeyset: PactKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };

      await createPrincipalNamespace({
        adminKeyset,
        chainId: "5",
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(executeChain.withChainId).toHaveBeenCalledWith("5");
    });

    it("should use custom gas parameters when specified", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const adminKeyset: PactKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };

      await createPrincipalNamespace({
        adminKeyset,
        gasLimit: 2000,
        gasPrice: 0.00001,
        ttl: 600,
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(executeChain.withMeta).toHaveBeenCalledWith({
        sender: "k:admin-address",
        gasLimit: 2000,
        gasPrice: 0.00001,
        ttl: 600,
      });
    });
  });

  describe("createPrincipal", () => {
    it("should create a principal from a keyset", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue("k:1234567890abcdef"),
      };

      mockExecution.mockReturnValue(executeChain);

      const keyset: PactKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };

      const result = await createPrincipal(keyset, {
        chainId: "0",
        networkProvider: mockNetworkProvider,
      });

      expect(result).toBe("k:1234567890abcdef");
      expect(mockExecution).toHaveBeenCalledWith(
        '(create-principal (read-keyset "ks"))',
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("ks", keyset);
    });
  });

  describe("defineNamespace", () => {
    it("should define a regular namespace", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("namespace-defined"),
      };

      mockExecution.mockReturnValue(executeChain);

      const adminKeyset: PactKeyset = {
        keys: ["admin-key"],
        pred: "keys-all",
      };

      const result = await defineNamespace({
        namespace: "my-namespace",
        adminKeyset,
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(result.status).toBe("success");
      expect(result.namespace).toBe("my-namespace");
      expect(result.result).toBe("namespace-defined");
      expect(mockExecution).toHaveBeenCalledWith(
        '(define-namespace "my-namespace" (read-keyset \'ns-admin) (read-keyset \'ns-user))',
        mockNetworkProvider,
      );
    });

    it("should handle errors in defineNamespace", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockRejectedValue(new Error("Namespace already exists")),
      };

      mockExecution.mockReturnValue(executeChain);

      const adminKeyset: PactKeyset = {
        keys: ["admin-key"],
        pred: "keys-all",
      };

      const result = await defineNamespace({
        namespace: "existing-namespace",
        adminKeyset,
        wallet: mockWallet,
        networkProvider: mockNetworkProvider,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Namespace already exists");
    });
  });
});