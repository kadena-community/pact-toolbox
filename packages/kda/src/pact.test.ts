import { describe, it, expect } from "vitest";
import * as standard from "./pact.js";

describe("Standard Library Utilities", () => {
  describe("Guard creation", () => {
    it("should create a keyset guard", () => {
      const guard = standard.createKeysetGuard("test-keyset", ["key1", "key2"], "keys-all");
      
      expect(guard).toEqual({
        keys: ["key1", "key2"],
        pred: "keys-all",
      });
    });

    it("should create a keyset guard with default predicate", () => {
      const guard = standard.createKeysetGuard("test-keyset", ["key1"]);
      
      expect(guard).toEqual({
        keys: ["key1"],
        pred: "keys-all",
      });
    });

    it("should create a capability guard", () => {
      const guard = standard.createCapabilityGuard("coin.TRANSFER", "from", "to", 10.0);
      
      expect(guard).toEqual({
        capability: {
          name: "coin.TRANSFER",
          args: ["from", "to", 10.0],
        },
      });
    });

    it("should create a user guard", () => {
      const guard = standard.createUserGuard("my-guard-function", "arg1", "arg2");
      
      expect(guard).toEqual({
        fun: "my-guard-function",
        args: ["arg1", "arg2"],
      });
    });

    it("should create a module guard", () => {
      const guard = standard.createModuleGuard("my-module.guard", "arg1");
      
      expect(guard).toEqual({
        name: "my-module.guard",
        args: ["arg1"],
      });
    });
  });

  describe("Keyset creation", () => {
    it("should create a Pact keyset from guard", () => {
      const guard = standard.createKeysetGuard("test", ["key1", "key2"], "keys-any");
      const keyset = standard.createKeyset(guard);
      
      expect(keyset).toEqual({
        keys: ["key1", "key2"],
        pred: "keys-any",
      });
    });

    it("should create a single key keyset", () => {
      const keyset = standard.createSingleKeyKeyset("test-key");
      
      expect(keyset).toEqual({
        keys: ["test-key"],
        pred: "keys-all",
      });
    });

    it("should create a multi-sig keyset with keys-all", () => {
      const keyset = standard.createMultiSigKeyset(["key1", "key2", "key3"]);
      
      expect(keyset).toEqual({
        keys: ["key1", "key2", "key3"],
        pred: "keys-all",
      });
    });

    it("should create a multi-sig keyset with keys-any", () => {
      const keyset = standard.createMultiSigKeyset(["key1", "key2", "key3"], 1);
      
      expect(keyset).toEqual({
        keys: ["key1", "key2", "key3"],
        pred: "keys-any",
      });
    });

    it("should create a multi-sig keyset with keys-2", () => {
      const keyset = standard.createMultiSigKeyset(["key1", "key2", "key3"], 2);
      
      expect(keyset).toEqual({
        keys: ["key1", "key2", "key3"],
        pred: "keys-2",
      });
    });

    it("should throw error for invalid threshold", () => {
      expect(() => {
        standard.createMultiSigKeyset(["key1", "key2"], 3);
      }).toThrow("Threshold cannot be greater than number of keys");
    });

    it("should throw error for unsupported custom threshold", () => {
      expect(() => {
        standard.createMultiSigKeyset(["key1", "key2", "key3", "key4"], 3);
      }).toThrow("Custom threshold predicates not yet supported");
    });
  });

  describe("Time utilities", () => {
    it("should format a Date to Pact time", () => {
      const date = new Date("2023-01-01T12:00:00.000Z");
      const pactTime = standard.formatTime(date);
      
      expect(pactTime).toEqual({
        time: "2023-01-01T12:00:00.000Z",
        timep: "2023-01-01T12:00:00.000Z",
      });
    });

    it("should parse Pact time string to Date", () => {
      const timeString = "2023-01-01T12:00:00.000Z";
      const date = standard.parseTime(timeString);
      
      expect(date).toEqual(new Date("2023-01-01T12:00:00.000Z"));
    });

    it("should parse Pact time object to Date", () => {
      const pactTime = {
        time: "2023-01-01T12:00:00.000Z",
        timep: "2023-01-01T12:00:00.000Z",
      };
      const date = standard.parseTime(pactTime);
      
      expect(date).toEqual(new Date("2023-01-01T12:00:00.000Z"));
    });

    it("should get current time", () => {
      const now = standard.getCurrentTime();
      const currentDate = new Date();
      
      expect(new Date(now.time).getTime()).toBeCloseTo(currentDate.getTime(), -2);
    });

    it("should add time to a date", () => {
      const date = new Date("2023-01-01T12:00:00.000Z");
      const futureTime = standard.addTime(date, 3600); // Add 1 hour
      
      expect(futureTime.time).toBe("2023-01-01T13:00:00.000Z");
    });
  });

  describe("Decimal utilities", () => {
    it("should create a decimal from string", () => {
      const decimal = standard.createDecimal("123.456");
      
      expect(decimal).toEqual({
        decimal: "123.456",
      });
    });

    it("should create a decimal from number", () => {
      const decimal = standard.createDecimal(123.456);
      
      expect(decimal).toEqual({
        decimal: "123.456",
      });
    });

    it("should parse a decimal object to number", () => {
      const decimal = { decimal: "123.456" };
      const number = standard.parseDecimal(decimal);
      
      expect(number).toBe(123.456);
    });

    it("should parse a decimal string to number", () => {
      const number = standard.parseDecimal("123.456");
      
      expect(number).toBe(123.456);
    });

    it("should format a number to decimal string", () => {
      const formatted = standard.formatDecimal(123.456789, 2);
      
      expect(formatted).toBe("123.46");
    });

    it("should format a number with default precision", () => {
      const formatted = standard.formatDecimal(123.456789);
      
      // Check that it has 18 decimal places and starts correctly
      expect(formatted).toMatch(/^123\.456789\d{12}$/);
      expect(formatted.length).toBe(22); // "123.456789" + 12 more digits + decimal point
    });
  });

  describe("Validation utilities", () => {
    describe("validateAccountName", () => {
      it("should validate k: accounts", () => {
        const validKAccount = "k:" + "a".repeat(64);
        expect(standard.validateAccountName(validKAccount)).toBe(true);
      });

      it("should reject invalid k: accounts", () => {
        expect(standard.validateAccountName("k:invalid")).toBe(false);
        expect(standard.validateAccountName("k:" + "z".repeat(63))).toBe(false);
        expect(standard.validateAccountName("k:" + "z".repeat(65))).toBe(false);
      });

      it("should validate w: accounts", () => {
        expect(standard.validateAccountName("w:valid-account")).toBe(true);
        expect(standard.validateAccountName("w:ab")).toBe(true); // "w:ab" is 4 chars, which is >= 3 minimum
      });

      it("should validate c: accounts", () => {
        expect(standard.validateAccountName("c:valid-account")).toBe(true);
        expect(standard.validateAccountName("c:ab")).toBe(true); // "c:ab" is 4 chars, which is >= 3 minimum
      });

      it("should validate regular accounts", () => {
        expect(standard.validateAccountName("valid-account_123")).toBe(true);
        expect(standard.validateAccountName("invalid@account")).toBe(false);
      });

      it("should reject accounts that are too short or too long", () => {
        expect(standard.validateAccountName("ab")).toBe(false);
        expect(standard.validateAccountName("a".repeat(257))).toBe(false);
      });
    });

    describe("validatePublicKey", () => {
      it("should validate correct public key", () => {
        const validKey = "a".repeat(64);
        expect(standard.validatePublicKey(validKey)).toBe(true);
      });

      it("should reject invalid public key length", () => {
        expect(standard.validatePublicKey("a".repeat(63))).toBe(false);
        expect(standard.validatePublicKey("a".repeat(65))).toBe(false);
      });

      it("should reject non-hex characters", () => {
        expect(standard.validatePublicKey("g" + "a".repeat(63))).toBe(false);
      });
    });
  });

  describe("Account utilities", () => {
    it("should create k: account from public key", () => {
      const publicKey = "a".repeat(64);
      const account = standard.createKAccount(publicKey);
      
      expect(account).toBe(`k:${publicKey}`);
    });

    it("should throw error for invalid public key", () => {
      expect(() => {
        standard.createKAccount("invalid");
      }).toThrow("Invalid public key format");
    });

    it("should extract public key from k: account", () => {
      const publicKey = "a".repeat(64);
      const account = `k:${publicKey}`;
      const extracted = standard.extractPublicKey(account);
      
      expect(extracted).toBe(publicKey);
    });

    it("should throw error for non-k: account", () => {
      expect(() => {
        standard.extractPublicKey("regular-account");
      }).toThrow("Account is not a k: account");
    });

    it("should throw error for invalid public key in account", () => {
      expect(() => {
        standard.extractPublicKey("k:invalid");
      }).toThrow("Invalid public key in account");
    });
  });

  describe("Capability utilities", () => {
    it("should create a capability", () => {
      const cap = standard.createCapability("coin.TRANSFER", "from", "to", 10.0);
      
      expect(cap).toEqual({
        name: "coin.TRANSFER",
        args: ["from", "to", 10.0],
      });
    });

    describe("coinCapabilities", () => {
      it("should create GAS capability", () => {
        const cap = standard.coinCapabilities.gas();
        
        expect(cap).toEqual({
          name: "coin.GAS",
          args: [],
        });
      });

      it("should create TRANSFER capability", () => {
        const cap = standard.coinCapabilities.transfer("from", "to", "10.0");
        
        expect(cap).toEqual({
          name: "coin.TRANSFER",
          args: ["from", "to", { decimal: "10.0" }],
        });
      });

      it("should create TRANSFER_XCHAIN capability", () => {
        const cap = standard.coinCapabilities.transferXchain("from", "to", "10.0", "2");
        
        expect(cap).toEqual({
          name: "coin.TRANSFER_XCHAIN",
          args: ["from", "to", { decimal: "10.0" }, "2"],
        });
      });

      it("should create ROTATE capability", () => {
        const cap = standard.coinCapabilities.rotate("account");
        
        expect(cap).toEqual({
          name: "coin.ROTATE",
          args: ["account"],
        });
      });

      it("should create COINBASE capability", () => {
        const guard = { keys: ["key"], pred: "keys-all" };
        const cap = standard.coinCapabilities.coinbase("account", guard, "10.0");
        
        expect(cap).toEqual({
          name: "coin.COINBASE",
          args: ["account", guard, { decimal: "10.0" }],
        });
      });

      it("should create REMEDIATE capability", () => {
        const guard = { keys: ["key"], pred: "keys-all" };
        const cap = standard.coinCapabilities.remediate("account", guard, "10.0");
        
        expect(cap).toEqual({
          name: "coin.REMEDIATE",
          args: ["account", guard, { decimal: "10.0" }],
        });
      });
    });
  });
});