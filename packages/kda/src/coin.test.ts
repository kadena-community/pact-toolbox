import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkConfigProvider } from "@pact-toolbox/network-config";
import { CoinContract, createCoinContract } from "./coin";
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

describe("CoinContract", () => {
  let coinContract: CoinContract;
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
    coinContract = new CoinContract(mockNetworkProvider);
  });

  describe("getBalance", () => {
    it("should get account balance", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "100.50" }),
      });

      const balance = await coinContract.getBalance("test-account", { chainId: "0" });
      expect(balance).toBe("100.50");
      expect(mockExecution).toHaveBeenCalledWith('(coin.get-balance "test-account")', mockNetworkProvider);
    });

    it("should handle balance as string", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue("50.25"),
      });

      const balance = await coinContract.getBalance("test-account");
      expect(balance).toBe("50.25");
    });
  });

  describe("getAccountDetails", () => {
    it("should get account details with balance and guard", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({
          balance: { decimal: "75.00" },
          guard: { keys: ["key1"], pred: "keys-all" },
        }),
      });

      const details = await coinContract.getAccountDetails("test-account");
      expect(details.balance).toBe("75.00");
      expect(details.guard).toEqual({ keys: ["key1"], pred: "keys-all" });
    });
  });

  describe("accountExists", () => {
    it("should return true if account exists", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({
          balance: { decimal: "10.00" },
          guard: { keys: ["key1"], pred: "keys-all" },
        }),
      });

      const exists = await coinContract.accountExists("test-account");
      expect(exists).toBe(true);
    });

    it("should return false if account does not exist", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      mockExecution.mockReturnValue({
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockRejectedValue(new Error("Account not found")),
      });

      const exists = await coinContract.accountExists("non-existent-account");
      expect(exists).toBe(false);
    });
  });

  describe("createAccount", () => {
    it("should create a new coin account", async () => {
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
        submitAndListen: vi.fn().mockResolvedValue("tx-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await coinContract.createAccount({
        account: "new-account",
        guard: { keys: ["key1"], pred: "keys-all" },
        wallet: mockWallet,
      });

      expect(result).toBe("tx-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.create-account "new-account" (read-keyset \'account-guard))',
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("account-guard", {
        keys: ["key1"],
        pred: "keys-all",
      });
    });
  });

  describe("transfer", () => {
    it("should transfer coins between accounts", async () => {
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

      const result = await coinContract.transfer({
        from: "sender-account",
        to: "receiver-account",
        amount: "10.5",
        wallet: mockWallet,
      });

      expect(result).toBe("transfer-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.transfer "sender-account" "receiver-account" 10.5)',
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

      const result = await coinContract.transferCreate({
        from: "sender-account",
        to: "new-receiver",
        amount: "25.0",
        toGuard: { keys: ["receiver-key"], pred: "keys-all" },
        wallet: mockWallet,
      });

      expect(result).toBe("transfer-create-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.transfer-create "sender-account" "new-receiver" (read-keyset \'to-guard) 25.0)',
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("to-guard", {
        keys: ["receiver-key"],
        pred: "keys-all",
      });
    });
  });

  describe("transferCrosschain", () => {
    it("should perform cross-chain transfer with guard", async () => {
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
        submitAndListen: vi.fn().mockResolvedValue("crosschain-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await coinContract.transferCrosschain({
        from: "sender-account",
        to: "receiver-account",
        amount: "50.0",
        targetChainId: "1",
        toGuard: { keys: ["receiver-key"], pred: "keys-all" },
        wallet: mockWallet,
      });

      expect(result).toBe("crosschain-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.transfer-crosschain "sender-account" "receiver-account" (read-keyset \'receiver-guard) "1" 50.0)',
        mockNetworkProvider,
      );
    });

    it("should perform cross-chain transfer without guard", async () => {
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
        submitAndListen: vi.fn().mockResolvedValue("crosschain-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await coinContract.transferCrosschain({
        from: "sender-account",
        to: "receiver-account",
        amount: "30.0",
        targetChainId: "2",
        toGuard: undefined as any,
        wallet: mockWallet,
      });

      expect(result).toBe("crosschain-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.transfer-crosschain "sender-account" "receiver-account" (at \'guard (coin.details "receiver-account")) "2" 30.0)',
        mockNetworkProvider,
      );
    });
  });

  describe("safeTransfer", () => {
    it("should perform safe transfer with verification", async () => {
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
        submitAndListen: vi.fn().mockResolvedValue("safe-transfer-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await coinContract.safeTransfer({
        from: "account-a",
        fromPublicKeys: ["key-a"],
        to: "account-b",
        toPublicKeys: ["key-b"],
        amount: "10.0",
        wallet: mockWallet,
      });

      expect(result).toBe("safe-transfer-result");
      // Should have two signers for safe transfer
      expect(executeChain.withSigner).toHaveBeenCalledTimes(2);
    });
  });

  describe("transferAll", () => {
    it("should transfer entire balance minus gas", async () => {
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

      // Mock getBalance to return 100.0
      const balanceChain = {
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "100.0" }),
      };

      const transferChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("transfer-all-result"),
      };

      mockExecution
        .mockReturnValueOnce(balanceChain)
        .mockReturnValueOnce(transferChain);

      const result = await coinContract.transferAll({
        from: "account-a",
        to: "account-b",
        wallet: mockWallet,
      });

      expect(result).toBe("transfer-all-result");
      // Should transfer 100.0 - 0.0001 (gas buffer) = 99.9999
      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.transfer "account-a" "account-b" 99.999900000000)',
        mockNetworkProvider,
      );
    });

    it("should handle insufficient balance", async () => {
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

      // Mock getBalance to return very low balance
      const balanceChain = {
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "0.00005" }),
      };

      mockExecution.mockReturnValue(balanceChain);

      await expect(
        coinContract.transferAll({
          from: "account-a",
          to: "account-b",
          wallet: mockWallet,
        }),
      ).rejects.toThrow("Insufficient balance to cover transfer and gas");
    });
  });

  describe("rotate", () => {
    it("should rotate account guard", async () => {
      const { execution, getWallet } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;
      const mockGetWallet = getWallet as any;

      const mockWallet: WalletLike = {
        getAccount: vi.fn().mockResolvedValue({
          address: "k:test-account",
          publicKey: "test-public-key",
        }),
      } as any;

      mockGetWallet.mockResolvedValue(mockWallet);

      const executeChain = {
        withChainId: vi.fn().mockReturnThis(),
        withMeta: vi.fn().mockReturnThis(),
        withKeyset: vi.fn().mockReturnThis(),
        withSigner: vi.fn().mockReturnThis(),
        sign: vi.fn().mockReturnThis(),
        submitAndListen: vi.fn().mockResolvedValue("rotate-result"),
      };

      mockExecution.mockReturnValue(executeChain);

      const result = await coinContract.rotate({
        account: "test-account",
        newGuard: {
          keys: ["new-key-1", "new-key-2"],
          pred: "keys-any",
        },
        wallet: mockWallet,
      });

      expect(result).toBe("rotate-result");
      expect(mockExecution).toHaveBeenCalledWith(
        '(coin.rotate "test-account" (read-keyset \'new-guard))',
        mockNetworkProvider,
      );
      expect(executeChain.withKeyset).toHaveBeenCalledWith("new-guard", {
        keys: ["new-key-1", "new-key-2"],
        pred: "keys-any",
      });
    });
  });

  describe("discoverAccounts", () => {
    it("should discover accounts across chains", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;

      // Mock getBalance calls for different chains
      const chain0 = {
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "10.0" }),
      };

      const chain1 = {
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockRejectedValue(new Error("Account not found")),
      };

      const chain2 = {
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "20.0" }),
      };

      mockExecution
        .mockReturnValueOnce(chain0)
        .mockReturnValueOnce(chain1)
        .mockReturnValueOnce(chain2);

      const results = await coinContract.discoverAccounts({
        publicKey: "test-public-key",
        chains: ["0", "1", "2"],
      });

      expect(results).toEqual([
        {
          chainId: "0",
          account: "k:test-public-key",
          balance: "10.0",
        },
        {
          chainId: "2",
          account: "k:test-public-key",
          balance: "20.0",
        },
      ]);
    });

    it("should search all chains by default", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;

      // Mock all chains to return no balance
      for (let i = 0; i < 20; i++) {
        const chain = {
          withChainId: vi.fn().mockReturnThis(),
          build: vi.fn().mockReturnThis(),
          dirtyRead: vi.fn().mockRejectedValue(new Error("Account not found")),
        };
        mockExecution.mockReturnValueOnce(chain);
      }

      const results = await coinContract.discoverAccounts({
        publicKey: "test-public-key",
      });

      expect(results).toEqual([]);
      expect(mockExecution).toHaveBeenCalledTimes(20);
    });

    it("should only return chains with positive balance", async () => {
      const { execution } = await import("@pact-toolbox/transaction");
      const mockExecution = execution as any;

      const chain0 = {
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "0.0" }),
      };

      const chain1 = {
        withChainId: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnThis(),
        dirtyRead: vi.fn().mockResolvedValue({ decimal: "10.0" }),
      };

      mockExecution.mockReturnValueOnce(chain0).mockReturnValueOnce(chain1);

      const results = await coinContract.discoverAccounts({
        publicKey: "test-public-key",
        chains: ["0", "1"],
      });

      expect(results).toEqual([
        {
          chainId: "1",
          account: "k:test-public-key",
          balance: "10.0",
        },
      ]);
    });
  });

  describe("createCoinContract", () => {
    it("should create a coin contract instance", () => {
      const contract = createCoinContract(mockNetworkProvider);
      expect(contract).toBeInstanceOf(CoinContract);
    });

    it("should create a coin contract with default provider", () => {
      const contract = createCoinContract();
      expect(contract).toBeInstanceOf(CoinContract);
    });
  });
});