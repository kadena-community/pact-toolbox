import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { MarmaladeContract, createMarmaladeContract } from "./marmalade";
import type { WalletLike } from "@pact-toolbox/types";

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

describe("MarmaladeContract", () => {
  let marmaladeService: MarmaladeContract;
  let mockNetworkProvider: NetworkConfigProvider;

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
    marmaladeService = new MarmaladeContract({ networkProvider: mockNetworkProvider });
  });

  describe("getTokenInfo", () => {
    it("should get token information", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({
          id: "token-123",
          supply: { decimal: "1000.0" },
          precision: 8,
          uri: "https://example.com/token",
          policies: ["policy1", "policy2"],
        }),
      });

      const tokenInfo = await marmaladeService.getTokenInfo("token-123", { chainId: "0" });
      expect(tokenInfo.id).toBe("token-123");
      expect(tokenInfo.supply).toBe("1000.0");
      expect(tokenInfo.precision).toBe(8);
      expect(tokenInfo.uri).toBe("https://example.com/token");
      expect(tokenInfo.policies).toEqual(["policy1", "policy2"]);
      expect(mockExecution).toHaveBeenCalledWith('(marmalade-v2.ledger.get-token-info "token-123")', mockNetworkProvider);
    });

    it("should handle supply as string", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({
          id: "token-456",
          supply: "500.0",
          precision: 4,
          uri: "https://example.com/token2",
          policies: [],
        }),
      });

      const tokenInfo = await marmaladeService.getTokenInfo("token-456");
      expect(tokenInfo.supply).toBe("500.0");
    });
  });

  describe("createToken", () => {
    it("should create a new token", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:creator-address",
          publicKey: "creator-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("token-creation-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await marmaladeService.createToken({
        id: "new-token",
        precision: 8,
        uri: "https://example.com/new-token",
        policies: ["marmalade.ledger.sale-policy"],
        wallet: mockWallet,
      });

      expect(result).toBe("token-creation-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.create-token "new-token" 8 "https://example.com/new-token" ["marmalade.ledger.sale-policy"] (read-keyset \'creation-guard))',
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("creation-guard", {
        keys: ["creator-public-key"],
        pred: "keys-all",
      });
    });
  });

  describe("mint", () => {
    it("should mint tokens", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:minter-address",
          publicKey: "minter-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("mint-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await marmaladeService.mint({
        tokenId: "token-123",
        account: "receiver-account",
        guard: { keys: ["receiver-key"], pred: "keys-all" },
        amount: "100.0",
        wallet: mockWallet,
      });

      expect(result).toBe("mint-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.mint "token-123" "receiver-account" (read-keyset \'account-guard) 100.0)',
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("account-guard", {
        keys: ["receiver-key"],
        pred: "keys-all",
      });
    });
  });

  describe("transfer", () => {
    it("should transfer tokens", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:sender-address",
          publicKey: "sender-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("transfer-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await marmaladeService.transfer({
        tokenId: "token-123",
        from: "sender-account",
        to: "receiver-account",
        amount: "25.0",
        wallet: mockWallet,
      });

      expect(result).toBe("transfer-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.transfer "token-123" "sender-account" "receiver-account" 25.0)',
        mockNetworkProvider,
      );
    });
  });

  describe("transferCreate", () => {
    it("should transfer and create account if needed", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:sender-address",
          publicKey: "sender-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("transfer-create-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await marmaladeService.transferCreate({
        tokenId: "token-123",
        from: "sender-account",
        to: "new-receiver",
        amount: "10.0",
        toGuard: { keys: ["receiver-key"], pred: "keys-all" },
        wallet: mockWallet,
      });

      expect(result).toBe("transfer-create-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.transfer-create "token-123" "sender-account" "new-receiver" (read-keyset \'to-guard) 10.0)',
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("to-guard", {
        keys: ["receiver-key"],
        pred: "keys-all",
      });
    });
  });

  describe("burn", () => {
    it("should burn tokens", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:burner-address",
          publicKey: "burner-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("burn-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await marmaladeService.burn({
        tokenId: "token-123",
        account: "burner-account",
        amount: "5.0",
        wallet: mockWallet,
      });

      expect(result).toBe("burn-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.burn "token-123" "burner-account" 5.0)',
        mockNetworkProvider,
      );
    });
  });

  describe("getBalance", () => {
    it("should get token balance for an account", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "75.0" }),
      });

      const balance = await marmaladeService.getBalance({
        tokenId: "token-123",
        account: "test-account",
        chainId: "0",
      });

      expect(balance).toBe("75.0");
      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.get-balance "token-123" "test-account")',
        mockNetworkProvider,
      );
    });

    it("should handle balance as string", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue("50.0"),
      });

      const balance = await marmaladeService.getBalance({
        tokenId: "token-456",
        account: "test-account",
      });

      expect(balance).toBe("50.0");
    });
  });

  describe("getTotalSupply", () => {
    it("should get total supply of a token", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "10000.0" }),
      });

      const supply = await marmaladeService.getTotalSupply("token-123", { chainId: "0" });

      expect(supply).toBe("10000.0");
      expect(mockExecution).toHaveBeenCalledWith('(marmalade-v2.ledger.total-supply "token-123")', mockNetworkProvider);
    });
  });

  describe("offerToken", () => {
    it("should offer token for sale", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:seller-address",
          publicKey: "seller-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("offer-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await marmaladeService.offerToken({
        tokenId: "token-123",
        seller: "seller-account",
        amount: "10.0",
        price: "100.0",
        timeout: 3600,
        wallet: mockWallet,
      });

      expect(result).toBe("offer-result");
      expect(mockExecution).toHaveBeenCalled();
      const callArg = mockExecution.mock.calls[0][0];
      expect(callArg).toContain('marmalade-v2.ledger.sale');
      expect(callArg).toContain('"token-123"');
      expect(callArg).toContain('"seller-account"');
    });
  });

  describe("buyToken", () => {
    it("should buy token from sale", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:buyer-address",
          publicKey: "buyer-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("buy-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await marmaladeService.buyToken({
        saleId: "sale-123",
        buyer: "buyer-account",
        buyerGuard: { keys: ["buyer-key"], pred: "keys-all" },
        amount: "5.0",
        wallet: mockWallet,
      });

      expect(result).toBe("buy-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.buy "sale-123" "buyer-account" (read-keyset \'buyer-guard) 5.0)',
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("buyer-guard", {
        keys: ["buyer-key"],
        pred: "keys-all",
      });
    });
  });

  describe("withdrawToken", () => {
    it("should withdraw token from sale", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:seller-address",
          publicKey: "seller-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("withdraw-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await marmaladeService.withdrawToken({
        saleId: "sale-123",
        seller: "seller-account",
        wallet: mockWallet,
      });

      expect(result).toBe("withdraw-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.withdraw "sale-123")',
        mockNetworkProvider,
      );
    });
  });

  describe("createMarmaladeContract", () => {
    it("should create a marmalade service instance", () => {
      const service = createMarmaladeContract(mockNetworkProvider);
      expect(service).toBeInstanceOf(MarmaladeContract);
    });

    it("should create a marmalade service with default provider", () => {
      const service = createMarmaladeContract();
      expect(service).toBeInstanceOf(MarmaladeContract);
    });
  });
});