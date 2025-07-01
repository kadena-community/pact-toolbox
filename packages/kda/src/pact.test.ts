import { describe, it, expect } from "vitest";
import {
  createKeysetGuard,
  createCapabilityGuard,
  createUserGuard,
  createModuleGuard,
  createKeyset,
  formatTime,
  parseTime,
  getCurrentTime,
  addTime,
  createDecimal,
  parseDecimal,
  formatDecimal,
  validateAccountName,
  validatePublicKey,
  createKAccount,
  extractPublicKey,
  createCapability,
  COIN_CAPABILITIES,
  createSingleKeyKeyset,
  createMultiSigKeyset,
  validateNamespaceName,
  validatePrincipalKeyset,
  isPrincipalNamespace,
} from "./pact";

describe("Pact Utilities", () => {
  describe("Guard Creation", () => {
    it("should create a keyset guard", () => {
      const guard = createKeysetGuard("test-guard", ["key1", "key2"], "keys-all");
      expect(guard).toEqual({
        keys: ["key1", "key2"],
        pred: "keys-all",
      });
    });

    it("should create a keyset guard with default predicate", () => {
      const guard = createKeysetGuard("test-guard", ["key1"]);
      expect(guard.pred).toBe("keys-all");
    });

    it("should create a capability guard", () => {
      const guard = createCapabilityGuard("coin.TRANSFER", "sender", "receiver", { decimal: "10.0" });
      expect(guard).toEqual({
        capability: {
          name: "coin.TRANSFER",
          args: ["sender", "receiver", { decimal: "10.0" }],
        },
      });
    });

    it("should create a user guard", () => {
      const guard = createUserGuard("my-guard-function", "arg1", 123);
      expect(guard).toEqual({
        fun: "my-guard-function",
        args: ["arg1", 123],
      });
    });

    it("should create a module guard", () => {
      const guard = createModuleGuard("my-module.guard", "param1");
      expect(guard).toEqual({
        name: "my-module.guard",
        args: ["param1"],
      });
    });
  });

  describe("Keyset Operations", () => {
    it("should create a keyset from guard", () => {
      const guard = createKeysetGuard("test", ["key1", "key2"], "keys-any");
      const keyset = createKeyset(guard);
      expect(keyset).toEqual({
        keys: ["key1", "key2"],
        pred: "keys-any",
      });
    });

    it("should create a single key keyset", () => {
      const keyset = createSingleKeyKeyset("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
      expect(keyset).toEqual({
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      });
    });

    it("should create a multi-sig keyset with all keys required", () => {
      const keyset = createMultiSigKeyset(["key1", "key2", "key3"]);
      expect(keyset).toEqual({
        keys: ["key1", "key2", "key3"],
        pred: "keys-all",
      });
    });

    it("should create a multi-sig keyset with any key", () => {
      const keyset = createMultiSigKeyset(["key1", "key2"], 1);
      expect(keyset).toEqual({
        keys: ["key1", "key2"],
        pred: "keys-any",
      });
    });

    it("should create a multi-sig keyset with keys-2", () => {
      const keyset = createMultiSigKeyset(["key1", "key2", "key3"], 2);
      expect(keyset).toEqual({
        keys: ["key1", "key2", "key3"],
        pred: "keys-2",
      });
    });

    it("should throw error for invalid threshold", () => {
      expect(() => createMultiSigKeyset(["key1", "key2"], 3)).toThrow("Threshold cannot be greater than number of keys");
    });

    it("should throw error for custom threshold", () => {
      expect(() => createMultiSigKeyset(["key1", "key2", "key3", "key4"], 3)).toThrow(
        "Custom threshold predicates not yet supported",
      );
    });
  });

  describe("Time Operations", () => {
    it("should format a date to Pact time", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const pactTime = formatTime(date);
      expect(pactTime).toEqual({
        time: "2024-01-15T10:30:00.000Z",
        timep: "2024-01-15T10:30:00.000Z",
      });
    });

    it("should parse a Pact time string to Date", () => {
      const date = parseTime("2024-01-15T10:30:00.000Z");
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should parse a Pact time object to Date", () => {
      const date = parseTime({
        time: "2024-01-15T10:30:00.000Z",
        timep: "2024-01-15T10:30:00.000Z",
      });
      expect(date.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should get current time in Pact format", () => {
      const pactTime = getCurrentTime();
      expect(pactTime).toHaveProperty("time");
      expect(pactTime).toHaveProperty("timep");
      expect(pactTime.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should add time to a date", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const pactTime = addTime(date, 3600); // Add 1 hour
      expect(pactTime.time).toBe("2024-01-15T11:30:00.000Z");
    });
  });

  describe("Decimal Operations", () => {
    it("should create a Pact decimal from string", () => {
      const decimal = createDecimal("123.456");
      expect(decimal).toEqual({ decimal: "123.456" });
    });

    it("should create a Pact decimal from number", () => {
      const decimal = createDecimal(789.012);
      expect(decimal).toEqual({ decimal: "789.012" });
    });

    it("should parse a Pact decimal to number", () => {
      const value = parseDecimal({ decimal: "123.456" });
      expect(value).toBe(123.456);
    });

    it("should parse a decimal string to number", () => {
      const value = parseDecimal("789.012");
      expect(value).toBe(789.012);
    });

    it("should format a number to Pact decimal string", () => {
      const formatted = formatDecimal(123.456789, 3);
      expect(formatted).toBe("123.457");
    });

    it("should format with default precision", () => {
      const formatted = formatDecimal(1.23);
      expect(formatted).toHaveLength(20); // 1 + . + 18 digits
      expect(formatted.startsWith("1.2")).toBe(true);
    });
  });

  describe("Account Validation", () => {
    it("should validate k: accounts", () => {
      const validKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      expect(validateAccountName(`k:${validKey}`)).toBe(true);
      expect(validateAccountName("k:invalid")).toBe(false);
    });

    it("should validate w: accounts", () => {
      expect(validateAccountName("w:webauthn-account")).toBe(true);
      expect(validateAccountName("w:ab")).toBe(false); // Too short
    });

    it("should validate c: accounts", () => {
      expect(validateAccountName("c:contract-account")).toBe(true);
      expect(validateAccountName("c:ab")).toBe(false); // Too short
    });

    it("should validate regular account names", () => {
      expect(validateAccountName("my-account")).toBe(true);
      expect(validateAccountName("account_123")).toBe(true);
      expect(validateAccountName("ACCOUNT")).toBe(true);
      expect(validateAccountName("account!")).toBe(false); // Invalid character
      expect(validateAccountName("ab")).toBe(false); // Too short
      expect(validateAccountName("a".repeat(257))).toBe(false); // Too long
    });
  });

  describe("Public Key Operations", () => {
    it("should validate public keys", () => {
      const validKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      expect(validatePublicKey(validKey)).toBe(true);
      expect(validatePublicKey("short")).toBe(false);
      expect(validatePublicKey("g234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")).toBe(false); // Invalid char
    });

    it("should create k: account from public key", () => {
      const publicKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const account = createKAccount(publicKey);
      expect(account).toBe(`k:${publicKey}`);
    });

    it("should throw error for invalid public key when creating k: account", () => {
      expect(() => createKAccount("invalid")).toThrow("Invalid public key format");
    });

    it("should extract public key from k: account", () => {
      const publicKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const extracted = extractPublicKey(`k:${publicKey}`);
      expect(extracted).toBe(publicKey);
    });

    it("should throw error when extracting from non-k: account", () => {
      expect(() => extractPublicKey("regular-account")).toThrow("Account is not a k: account");
    });

    it("should throw error for invalid public key in k: account", () => {
      expect(() => extractPublicKey("k:invalid")).toThrow("Invalid public key in account");
    });
  });

  describe("Capability Creation", () => {
    it("should create a capability", () => {
      const cap = createCapability("coin.TRANSFER", "from", "to", { decimal: "10.0" });
      expect(cap).toEqual({
        name: "coin.TRANSFER",
        args: ["from", "to", { decimal: "10.0" }],
      });
    });

    it("should create coin.GAS capability", () => {
      const cap = COIN_CAPABILITIES.gas();
      expect(cap).toEqual({
        name: "coin.GAS",
        args: [],
      });
    });

    it("should create coin.TRANSFER capability", () => {
      const cap = COIN_CAPABILITIES.transfer("sender", "receiver", "50.0");
      expect(cap.name).toBe("coin.TRANSFER");
      expect(cap.args[0]).toBe("sender");
      expect(cap.args[1]).toBe("receiver");
      expect(cap.args[2]).toEqual({ decimal: "50.0" });
    });

    it("should create coin.TRANSFER_XCHAIN capability", () => {
      const cap = COIN_CAPABILITIES.transferXchain("sender", "receiver", "25.0", "1");
      expect(cap.name).toBe("coin.TRANSFER_XCHAIN");
      expect(cap.args).toHaveLength(4);
      expect(cap.args[3]).toBe("1");
    });

    it("should create coin.ROTATE capability", () => {
      const cap = COIN_CAPABILITIES.rotate("account");
      expect(cap).toEqual({
        name: "coin.ROTATE",
        args: ["account"],
      });
    });

    it("should create coin.COINBASE capability", () => {
      const guard = { keys: ["key1"], pred: "keys-all" };
      const cap = COIN_CAPABILITIES.coinbase("miner", guard, "2.5");
      expect(cap.name).toBe("coin.COINBASE");
      expect(cap.args[0]).toBe("miner");
      expect(cap.args[1]).toEqual(guard);
      expect(cap.args[2]).toEqual({ decimal: "2.5" });
    });

    it("should create coin.REMEDIATE capability", () => {
      const guard = { keys: ["key1"], pred: "keys-all" };
      const cap = COIN_CAPABILITIES.remediate("account", guard, "100.0");
      expect(cap.name).toBe("coin.REMEDIATE");
      expect(cap.args).toHaveLength(3);
    });
  });

  describe("Namespace Validation", () => {
    it("should validate regular namespace names", () => {
      expect(validateNamespaceName("my-namespace")).toBe(true);
      expect(validateNamespaceName("namespace_123")).toBe(true);
      expect(validateNamespaceName("NAMESPACE")).toBe(true);
      expect(validateNamespaceName("namespace!")).toBe(false);
      expect(validateNamespaceName("")).toBe(false);
      expect(validateNamespaceName("a".repeat(257))).toBe(false);
    });

    it("should validate principal namespace names", () => {
      const validPrincipal = "n_" + "a".repeat(64);
      expect(validateNamespaceName(validPrincipal)).toBe(true);
      expect(validateNamespaceName("n_invalid")).toBe(false);
    });

    it("should validate principal keysets", () => {
      const validKeyset = {
        keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
        pred: "keys-all",
      };
      expect(validatePrincipalKeyset(validKeyset)).toBe(true);

      expect(validatePrincipalKeyset({ keys: [], pred: "keys-all" })).toBe(false);
      expect(validatePrincipalKeyset({ keys: ["short"], pred: "keys-all" })).toBe(false);
      expect(validatePrincipalKeyset({ keys: ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"], pred: "" })).toBe(
        false,
      );
    });

    it("should check if namespace is principal", () => {
      const principalNamespace = "n_" + "a".repeat(64);
      expect(isPrincipalNamespace(principalNamespace)).toBe(true);
      expect(isPrincipalNamespace("regular-namespace")).toBe(false);
      expect(isPrincipalNamespace("n_short")).toBe(false);
    });
  });
});