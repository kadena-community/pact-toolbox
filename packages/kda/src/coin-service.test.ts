import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoinService } from "./coin-service";
import { execution, type ToolboxNetworkContext } from "@pact-toolbox/transaction";

// Mock the transaction module
vi.mock("@pact-toolbox/transaction", () => ({
  execution: vi.fn(),
}));

const mockExecution = vi.mocked(execution);

describe("CoinService", () => {
  let coinService: CoinService;
  let mockContext: ToolboxNetworkContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      getDefaultSigner: vi.fn().mockReturnValue({ address: "sender00", pubKey: "test-key" }),
      getSignerKeys: vi.fn().mockReturnValue({ publicKey: "test-key", privateKey: "test-private" }),
    } as any;

    coinService = new CoinService({
      context: mockContext,
      defaultChainId: "0",
    });
  });

  describe("getBalance", () => {
    it("should get account balance", async () => {
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue("100.0"),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await coinService.getBalance("k:test-account");

      expect(mockExecution).toHaveBeenCalledWith('(coin.get-balance "k:test-account")');
      expect(mockBuilder.withChainId).toHaveBeenCalledWith("0");
      expect(mockBuilder.withContext).toHaveBeenCalledWith(mockContext);
      expect(result).toBe("100.0");
    });

    it("should use custom chain ID", async () => {
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue("50.0"),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      await coinService.getBalance("k:test-account", { chainId: "2" });

      expect(mockBuilder.withChainId).toHaveBeenCalledWith("2");
    });
  });

  describe("getAccountDetails", () => {
    it("should get account details", async () => {
      const mockAccountInfo = {
        balance: "100.0",
        guard: { keys: ["test-key"], pred: "keys-all" },
      };

      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue(mockAccountInfo),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await coinService.getAccountDetails("k:test-account");

      expect(mockExecution).toHaveBeenCalledWith('(coin.details "k:test-account")');
      expect(result).toEqual(mockAccountInfo);
    });
  });

  describe("accountExists", () => {
    it("should return true if account exists", async () => {
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ balance: "100.0", guard: {} }),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await coinService.accountExists("k:test-account");

      expect(result).toBe(true);
    });

    it("should return false if account does not exist", async () => {
      const mockBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockRejectedValue(new Error("Account not found")),
      };

      mockExecution.mockReturnValue(mockBuilder as any);

      const result = await coinService.accountExists("k:test-account");

      expect(result).toBe(false);
    });
  });

  describe("createAccount", () => {
    it("should create a new account", async () => {
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
      const result = await coinService.createAccount({
        account: "k:test-account",
        guard,
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.create-account "k:test-account" (read-keyset \'account-guard))',
      );
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("account-guard", guard);
      expect(mockBuilder.sign).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockResult);
    });
  });

  describe("transfer", () => {
    it("should transfer coins between accounts", async () => {
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

      const result = await coinService.transfer({
        from: "k:sender",
        to: "k:receiver",
        amount: "10.0",
      });

      expect(mockExecution).toHaveBeenCalledWith('(coin.transfer "k:sender" "k:receiver" 10.0)');
      expect(mockBuilder.withSigner).toHaveBeenCalledWith("test-key", expect.any(Function));
      expect(result).toEqual(mockResult);
    });
  });

  describe("transferCreate", () => {
    it("should transfer coins and create account", async () => {
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
      const result = await coinService.transferCreate({
        from: "k:sender",
        to: "k:receiver",
        amount: "10.0",
        toGuard,
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.transfer-create "k:sender" "k:receiver" (read-keyset \'to-guard) 10.0)',
      );
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("to-guard", toGuard);
      expect(result).toEqual(mockResult);
    });
  });

  describe("transferCrosschain", () => {
    it("should transfer coins cross-chain with guard", async () => {
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
      const result = await coinService.transferCrosschain({
        from: "k:sender",
        to: "k:receiver",
        amount: "10.0",
        targetChainId: "2",
        toGuard,
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.transfer-crosschain "k:sender" "k:receiver" (read-keyset \'receiver-guard) "2" 10.0)',
      );
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("receiver-guard", toGuard);
      expect(result).toEqual(mockResult);
    });

    it("should transfer coins cross-chain without guard", async () => {
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

      // Test without providing toGuard to trigger the else branch
      const result = await coinService.transferCrosschain({
        from: "k:sender",
        to: "k:receiver",
        amount: "10.0",
        targetChainId: "2",
        toGuard: undefined as any, // No guard provided
      });

      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.transfer-crosschain "k:sender" "k:receiver" (at \'guard (coin.details "k:receiver")) "2" 10.0)',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("fund", () => {
    it("should use transfer if account exists", async () => {
      // Mock account exists
      const mockDetailsBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ balance: "100.0", guard: {} }),
      };

      // Mock transfer
      const mockTransferResult = { requestKey: "transfer-key", status: "success" };
      const mockTransferBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockTransferResult),
      };

      mockExecution
        .mockReturnValueOnce(mockDetailsBuilder as any) // For accountExists check
        .mockReturnValueOnce(mockTransferBuilder as any); // For transfer

      const toGuard = { keys: ["receiver-key"], pred: "keys-all" };
      const result = await coinService.fund({
        from: "k:sender",
        to: "k:receiver",
        amount: "10.0",
        toGuard,
      });

      expect(result).toEqual(mockTransferResult);
    });

    it("should use transferCreate if account does not exist", async () => {
      // Mock account does not exist
      const mockDetailsBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockRejectedValue(new Error("Account not found")),
      };

      // Mock transferCreate
      const mockTransferCreateResult = { requestKey: "transfer-create-key", status: "success" };
      const mockTransferCreateBuilder = {
        withChainId: vi.fn().mockReturnThis(),
        withContext: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue(mockTransferCreateResult),
      };

      mockExecution
        .mockReturnValueOnce(mockDetailsBuilder as any) // For accountExists check
        .mockReturnValueOnce(mockTransferCreateBuilder as any); // For transferCreate

      const toGuard = { keys: ["receiver-key"], pred: "keys-all" };
      const result = await coinService.fund({
        from: "k:sender",
        to: "k:receiver",
        amount: "10.0",
        toGuard,
      });

      expect(result).toEqual(mockTransferCreateResult);
    });
  });
});
