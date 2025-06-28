import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarmaladeService } from "./marmalade-service";
import { execution, type ToolboxNetworkContext } from "@pact-toolbox/transaction";

// Mock the transaction module
vi.mock("@pact-toolbox/transaction", () => ({
  execution: vi.fn(),
}));

const mockExecution = vi.mocked(execution);

describe("MarmaladeService", () => {
  let marmaladeService: MarmaladeService;
  let mockContext: ToolboxNetworkContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockContext = {
      getDefaultSigner: vi.fn().mockReturnValue({ address: "sender00", pubKey: "test-key" }),
      getSignerKeys: vi.fn().mockReturnValue({ publicKey: "test-key", privateKey: "test-private" })
    } as any;
    
    marmaladeService = new MarmaladeService({
      context: mockContext,
      defaultChainId: "0",
    });
  });

  describe("getTokenInfo", () => {
    it("should get token information", async () => {
      const mockTokenInfo = {
        id: "test-token",
        supply: "1000.0",
        precision: 12,
        uri: "https://example.com/token.json",
        policies: ["policy1", "policy2"],
      };

      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.getTokenInfo("test-token");

      expect(mockExecution).toHaveBeenCalledWith('(marmalade-v2.ledger.get-token-info "test-token")');
      expect(result).toEqual(mockTokenInfo);
    });
  });

  describe("getBalance", () => {
    it("should get token balance for account", async () => {
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue("100.0"),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.getBalance("test-token", "k:test-account");

      expect(mockExecution).toHaveBeenCalledWith('(marmalade-v2.ledger.get-balance "test-token" "k:test-account")');
      expect(result).toBe("100.0");
    });
  });

  describe("tokenExists", () => {
    it("should return true if token exists", async () => {
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ id: "test-token" }),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.tokenExists("test-token");

      expect(result).toBe(true);
    });

    it("should return false if token does not exist", async () => {
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockRejectedValue(new Error("Token not found")),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.tokenExists("test-token");

      expect(result).toBe(false);
    });
  });

  describe("createToken", () => {
    it("should create a new token with policies", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.createToken({
        id: "test-token",
        precision: 0,
        uri: "https://example.com/token.json",
        policies: ["policy1", "policy2"],
        creator: "test-creator",
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.create-token "test-token" 0 "https://example.com/token.json" ["policy1" "policy2"] (read-keyset \'creation-guard))',
      );
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("creation-guard", {
        keys: ["test-key"],
        pred: "keys-all",
      });
      expect(result).toEqual(mockResult);
    });

    it("should create a new token without policies", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.createToken({
        id: "test-token",
        precision: 0,
        uri: "https://example.com/token.json",
        policies: [],
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.create-token "test-token" 0 "https://example.com/token.json" [] (read-keyset \'creation-guard))',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("mintToken", () => {
    it("should mint tokens to an account", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const guard = { keys: ["test-key"], pred: "keys-all" };
      const result = await marmaladeService.mintToken({
        tokenId: "test-token",
        account: "k:test-account",
        guard,
        amount: "1.0",
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.mint "test-token" "k:test-account" (read-keyset \'guard) 1.0)',
      );
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("guard", guard);
      expect(result).toEqual(mockResult);
    });
  });

  describe("transferToken", () => {
    it("should transfer tokens between accounts", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.transferToken({
        tokenId: "test-token",
        from: "k:sender",
        to: "k:receiver",
        amount: "1.0",
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.transfer "test-token" "k:sender" "k:receiver" 1.0)',
      );
      expect(mockBuilder.withSigner).toHaveBeenCalledWith("test-key", expect.any(Function));
      expect(result).toEqual(mockResult);
    });
  });

  describe("transferCreateToken", () => {
    it("should transfer tokens and create account", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const toGuard = { keys: ["receiver-key"], pred: "keys-all" };
      const result = await marmaladeService.transferCreateToken({
        tokenId: "test-token",
        from: "k:sender",
        to: "k:receiver",
        amount: "1.0",
        toGuard,
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.ledger.transfer-create "test-token" "k:sender" "k:receiver" (read-keyset \'receiver-guard) 1.0)',
      );
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("receiver-guard", toGuard);
      expect(result).toEqual(mockResult);
    });
  });

  describe("burnToken", () => {
    it("should burn tokens from an account", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.burnToken({
        tokenId: "test-token",
        account: "k:test-account",
        amount: "1.0",
      });

      expect(mockExecution).toHaveBeenCalledWith('(marmalade-v2.ledger.burn "test-token" "k:test-account" 1.0)');
      expect(mockBuilder.withSigner).toHaveBeenCalledWith("test-key", expect.any(Function));
      expect(result).toEqual(mockResult);
    });
  });

  describe("createSale", () => {
    it("should create a token sale", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        withData: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.createSale({
        tokenId: "test-token",
        seller: "k:seller",
        price: "100.0",
        timeout: 86400,
      });

      expect(mockExecution).toHaveBeenCalledWith('(marmalade-v2.sale.sale "test-token" "k:seller" 1.0 86400)');
      expect(mockBuilder.withData).toHaveBeenCalledWith("price", { decimal: "100.0" });
      expect(result).toEqual(mockResult);
    });
  });

  describe("buyToken", () => {
    it("should buy a token from sale", async () => {
      const mockResult = { requestKey: "test-key", status: "success" };
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockResult),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.buyToken({
        tokenId: "test-token",
        buyer: "k:buyer",
        amount: "1.0",
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(marmalade-v2.sale.buy "test-token" "k:buyer" (read-keyset \'buyer-guard) 1.0 (read-msg "price"))',
      );
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("buyer-guard", {
        keys: ["test-key"],
        pred: "keys-all",
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe("getPolicyInfo", () => {
    it("should get policy information", async () => {
      const mockPolicyInfo = {
        name: "test-policy",
        implements: ["marmalade.policy-interface-v1"],
      };

      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue(mockPolicyInfo),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.getPolicyInfo("test-policy");

      expect(mockExecution).toHaveBeenCalledWith("(test-policy.get-policy-info)");
      expect(result).toEqual(mockPolicyInfo);
    });
  });

  describe("listTokens", () => {
    it("should list all tokens", async () => {
      const mockTokens = ["token1", "token2", "token3"];

      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue(mockTokens),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.listTokens();

      expect(mockExecution).toHaveBeenCalledWith("(keys marmalade-v2.ledger.tokens)");
      expect(result).toEqual(mockTokens);
    });
  });

  describe("getAccountDetails", () => {
    it("should get account details for a token", async () => {
      const mockAccount = {
        balance: "10.0",
        guard: { keys: ["test-key"], pred: "keys-all" },
      };

      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue(mockAccount),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await marmaladeService.getAccountDetails("test-token", "k:test-account");

      expect(mockExecution).toHaveBeenCalledWith('(marmalade-v2.ledger.details "test-token" "k:test-account")');
      expect(result).toEqual(mockAccount);
    });
  });
});