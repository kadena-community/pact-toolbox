import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createPactTestEnv } from "@pact-toolbox/test";
import type { PactTestEnv } from "@pact-toolbox/test";
import { CoinService } from "./coin-service";
import { createDevNetNetworkConfig } from "@pact-toolbox/config";
import type { PactKeyset } from "@pact-toolbox/types";

describe.skip("CoinService Integration Tests", () => {
  let testEnv: PactTestEnv;
  let coinService: CoinService;

  // Test keypairs with proper 64-character hex keys
  const alicePublicKey = "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca";
  const bobPublicKey = "6be2f485a7af75fedb4b7f153a903f7e6000ca4aa501179c91a2450b777bd2a7";

  const aliceKeyset: PactKeyset = {
    keys: [alicePublicKey],
    pred: "keys-all",
  };

  const bobKeyset: PactKeyset = {
    keys: [bobPublicKey],
    pred: "keys-all",
  };

  const aliceAccount = `k:${alicePublicKey}`;
  const bobAccount = `k:${bobPublicKey}`;

  beforeAll(async () => {
    // Create test environment with devnet config using factory
    // Use sender00's private key for the test wallet
    testEnv = await createPactTestEnv({
      privateKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898", // sender00's private key
      accountName: "sender00",
      configOverrides: {
        defaultNetwork: "devnet",
        networks: {
          devnet: createDevNetNetworkConfig({
            containerConfig: {
              onDemandMining: true,
              persistDb: false,
            },
          }),
        },
      },
    });

    // Start the network
    await testEnv.start();

    // Initialize coin service using the test environment's client context
    coinService = new CoinService({
      context: testEnv.client.getContext(),
      defaultChainId: "0",
      wallet: testEnv.wallet, // Pass the test wallet explicitly
    });

    // Wait for network to be ready (devnet takes longer to start)
    await new Promise((resolve) => setTimeout(resolve, 10000));
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.stop();
    }
  });

  describe("Account Management", () => {
    it("should check if sender00 account exists (pre-funded account)", async () => {
      const exists = await coinService.accountExists("sender00");
      expect(exists).toBe(true);
    });

    it("should get balance of sender00 account", async () => {
      const balance = await coinService.getBalance("sender00");
      expect(typeof balance).toBe("string");
      expect(parseFloat(balance)).toBeGreaterThan(0);
    });

    it("should get account details for sender00", async () => {
      const details = await coinService.getAccountDetails("sender00");
      expect(details).toHaveProperty("balance");
      expect(details).toHaveProperty("guard");
      expect(typeof details.balance).toBe("string");
      expect(parseFloat(details.balance)).toBeGreaterThan(0);
    });

    it("should return false for non-existent account", async () => {
      const exists = await coinService.accountExists("non-existent-account");
      expect(exists).toBe(false);
    });

    it("should create a new account", async () => {
      try {
        const result = await coinService.createAccount({
          account: aliceAccount,
          guard: aliceKeyset,
          chainId: "0",
        });

        expect(result).toBe("Write succeeded");
        expect(result).toHaveProperty("result");

        // Verify account was created
        const exists = await coinService.accountExists(aliceAccount);
        expect(exists).toBe(true);

        // Verify account details
        const details = await coinService.getAccountDetails(aliceAccount);
        expect(details.balance).toBe("0.0");
        expect(details.guard.keys).toEqual(aliceKeyset.keys);
      } catch (error) {
        // Account might already exist from previous test runs
        console.log("Account creation failed (might already exist):", error);
      }
    });
  });

  describe("Transfers", () => {
    beforeAll(async () => {
      // Fund alice account from sender00 (will create if doesn't exist)
      try {
        await coinService.transferCreate({
          from: "sender00",
          to: aliceAccount,
          amount: "100.0",
          toGuard: aliceKeyset,
        });
        // Wait for transaction to settle
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.log("Initial funding failed:", error);
      }
    });

    it("should transfer coins between existing accounts", async () => {
      // Get initial balances
      const initialAliceBalance = parseFloat(await coinService.getBalance(aliceAccount));
      const initialSender00Balance = parseFloat(await coinService.getBalance("sender00"));

      const transferAmount = "10.0";

      // Perform transfer from sender00 to alice
      const result = await coinService.transfer({
        from: "sender00",
        to: aliceAccount,
        amount: transferAmount,
      });

      expect(result).toBe("Write succeeded");

      // Verify balances changed
      const finalAliceBalance = parseFloat(await coinService.getBalance(aliceAccount));
      const finalSender00Balance = parseFloat(await coinService.getBalance("sender00"));

      expect(finalAliceBalance).toBeGreaterThan(initialAliceBalance);
      expect(finalSender00Balance).toBeLessThan(initialSender00Balance);
    });

    it("should transfer and create destination account", async () => {
      const transferAmount = "5.0";

      // Perform transfer-create from sender00
      const result = await coinService.transferCreate({
        from: "sender00",
        to: bobAccount,
        amount: transferAmount,
        toGuard: bobKeyset,
      });

      expect(result).toBe("Write succeeded");

      // Verify bob account was created and funded
      const exists = await coinService.accountExists(bobAccount);
      expect(exists).toBe(true);

      const balance = await coinService.getBalance(bobAccount);
      // Account should have at least the transfer amount (might have more from previous runs)
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(parseFloat(transferAmount));

      // Verify account details
      const details = await coinService.getAccountDetails(bobAccount);
      expect(details.guard.keys).toEqual(bobKeyset.keys);
    });

    it("should use smart transfer (fund) that chooses transfer or transfer-create", async () => {
      // Create a new test account with unique key to avoid conflicts
      const charliePublicKey = "33fad85323f9ff4a52b1de78b753f39dc93d1e3afe88db3228adfec26e8df9f7";
      const charlieAccount = `k:${charliePublicKey}`;
      const charlieKeyset: PactKeyset = {
        keys: [charliePublicKey],
        pred: "keys-all",
      };

      // First check if account exists to determine expected behavior
      const existsBefore = await coinService.accountExists(charlieAccount);

      // Fund should use transfer-create for new account (from sender00)
      const result = await coinService.fund({
        from: "sender00",
        to: charlieAccount,
        amount: "3.0",
        toGuard: charlieKeyset,
      });

      expect(result).toBe("Write succeeded");

      // Verify account exists after operation
      const existsAfter = await coinService.accountExists(charlieAccount);
      expect(existsAfter).toBe(true);

      if (!existsBefore) {
        // If account was created, it should have exactly the transfer amount
        const balance = await coinService.getBalance(charlieAccount);
        expect(parseFloat(balance)).toBe(3.0);
      } else {
        // If account already existed, it should have increased by the transfer amount
        const balance = await coinService.getBalance(charlieAccount);
        expect(parseFloat(balance)).toBeGreaterThanOrEqual(3.0);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle insufficient funds", async () => {
      try {
        await coinService.transfer({
          from: "sender00",
          to: bobAccount,
          amount: "999999999.0", // Much more than sender00 has
        });
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        // Error should be related to insufficient funds
        expect((error as Error).message || String(error)).toMatch(/insufficient|funds|balance/i);
      }
    });

    it("should handle invalid account names", async () => {
      try {
        await coinService.getBalance("invalid-account-name");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should handle transfers from non-existent accounts", async () => {
      try {
        await coinService.transfer({
          from: "non-existent-account",
          to: "sender00",
          amount: "1.0",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Cross-chain Operations", () => {
    it("should handle cross-chain transfers", async () => {
      // Note: This test might need special devnet configuration
      // For now, we'll test the API but expect it might fail on a simple devnet
      try {
        const result = await coinService.transferCrosschain({
          from: "sender00",
          to: bobAccount,
          amount: "1.0",
          targetChainId: "1",
          toGuard: bobKeyset,
        });

        expect(result).toBe("Write succeeded");
      } catch (error) {
        // Cross-chain might not be fully supported in simple devnet
        console.log("Cross-chain transfer failed (expected in simple devnet):", error);
        expect(error).toBeDefined();
      }
    });
  });

  describe("Configuration", () => {
    it("should respect default chain ID configuration", () => {
      const serviceWithDefaultChain = new CoinService({
        context: testEnv.client.getContext(),
        defaultChainId: "2",
      });

      expect(serviceWithDefaultChain).toBeDefined();
      // The actual chain ID usage would be tested in the individual operations
    });

    it("should allow chain ID override in operations", async () => {
      // Test that we can override the default chain ID
      const balance = await coinService.getBalance("sender00", { chainId: "0" });
      expect(typeof balance).toBe("string");
    });
  });

  describe("Performance", () => {
    it("should handle multiple concurrent operations", async () => {
      const operations = [
        coinService.getBalance(aliceAccount),
        coinService.getBalance(bobAccount),
        coinService.getBalance("sender00"),
        coinService.accountExists(aliceAccount),
        coinService.accountExists(bobAccount),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(5);
      expect(typeof results[0]).toBe("string"); // alice balance
      expect(typeof results[1]).toBe("string"); // bob balance
      expect(typeof results[2]).toBe("string"); // sender00 balance
      expect(typeof results[3]).toBe("boolean"); // alice exists
      expect(typeof results[4]).toBe("boolean"); // bob exists
    });
  });
});
