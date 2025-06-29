import type { PactValue, PactKeyset } from "@pact-toolbox/types";
import type { KeysetGuard, CapabilityGuard, UserGuard, ModuleGuard, PactTime, PactDecimal } from "./types";

/**
 * Create a keyset guard
 */
export function createKeysetGuard(
  name: string,
  keys: string[],
  pred: "keys-all" | "keys-any" | "keys-2" | string = "keys-all",
): KeysetGuard {
  return {
    keys,
    pred,
  };
}

/**
 * Create a capability guard
 */
export function createCapabilityGuard(capabilityName: string, ...args: PactValue[]): CapabilityGuard {
  return {
    capability: {
      name: capabilityName,
      args,
    },
  };
}

/**
 * Create a user guard
 */
export function createUserGuard(fun: string, ...args: PactValue[]): UserGuard {
  return {
    fun,
    args,
  };
}

/**
 * Create a module guard
 */
export function createModuleGuard(name: string, ...args: PactValue[]): ModuleGuard {
  return {
    name,
    args,
  };
}

/**
 * Create a Pact keyset from guard
 */
export function createKeyset(guard: KeysetGuard): PactKeyset {
  return {
    keys: guard.keys,
    pred: guard.pred,
  };
}

/**
 * Format a Date object to Pact time format
 */
export function formatTime(date: Date): PactTime {
  const isoString = date.toISOString();
  return {
    time: isoString,
    timep: isoString,
  };
}

/**
 * Parse a Pact time string to Date
 */
export function parseTime(pactTime: string | PactTime): Date {
  const timeString = typeof pactTime === "string" ? pactTime : pactTime.time;
  return new Date(timeString);
}

/**
 * Get current time in Pact format
 */
export function getCurrentTime(): PactTime {
  return formatTime(new Date());
}

/**
 * Add time to a date
 */
export function addTime(date: Date, seconds: number): PactTime {
  const newDate = new Date(date.getTime() + seconds * 1000);
  return formatTime(newDate);
}

/**
 * Create a Pact decimal from string or number
 */
export function createDecimal(value: string | number): PactDecimal {
  return {
    decimal: typeof value === "string" ? value : value.toString(),
  };
}

/**
 * Parse a Pact decimal to number
 */
export function parseDecimal(decimal: PactDecimal | string): number {
  const decimalString = typeof decimal === "string" ? decimal : decimal.decimal;
  return parseFloat(decimalString);
}

/**
 * Format a number to Pact decimal string
 */
export function formatDecimal(value: number, precision: number = 18): string {
  return value.toFixed(precision);
}

/**
 * Validate a Pact account name
 */
export function validateAccountName(account: string): boolean {
  // Basic validation for Pact account names
  if (account.length < 3 || account.length > 256) {
    return false;
  }

  // Check for k: accounts (single key accounts)
  if (account.startsWith("k:")) {
    const publicKey = account.slice(2);
    return publicKey.length === 64 && /^[a-fA-F0-9]+$/.test(publicKey);
  }

  // Check for w: accounts (WebAuthn accounts)
  if (account.startsWith("w:")) {
    return account.length >= 3;
  }

  // Check for c: accounts (contract accounts)
  if (account.startsWith("c:")) {
    return account.length >= 3;
  }

  // Regular account names
  return /^[a-zA-Z0-9_-]+$/.test(account);
}

/**
 * Validate a public key
 */
export function validatePublicKey(publicKey: string): boolean {
  return publicKey.length === 64 && /^[a-fA-F0-9]+$/.test(publicKey);
}

/**
 * Create a k: account from public key
 */
export function createKAccount(publicKey: string): string {
  if (!validatePublicKey(publicKey)) {
    throw new Error("Invalid public key format");
  }
  return `k:${publicKey}`;
}

/**
 * Extract public key from k: account
 */
export function extractPublicKey(account: string): string {
  if (!account.startsWith("k:")) {
    throw new Error("Account is not a k: account");
  }
  const publicKey = account.slice(2);
  if (!validatePublicKey(publicKey)) {
    throw new Error("Invalid public key in account");
  }
  return publicKey;
}

/**
 * Create a capability for signing
 */
export function createCapability(name: string, ...args: PactValue[]): { name: string; args: PactValue[] } {
  return {
    name,
    args,
  };
}

/**
 * Helper to create common coin capabilities
 */
export const coinCapabilities = {
  gas: (): { name: string; args: PactValue[] } => createCapability("coin.GAS"),
  transfer: (from: string, to: string, amount: string): { name: string; args: PactValue[] } =>
    createCapability("coin.TRANSFER", from, to, createDecimal(amount)),
  transferXchain: (
    from: string,
    to: string,
    amount: string,
    targetChainId: string,
  ): { name: string; args: PactValue[] } =>
    createCapability("coin.TRANSFER_XCHAIN", from, to, createDecimal(amount), targetChainId),
  rotate: (account: string): { name: string; args: PactValue[] } => createCapability("coin.ROTATE", account),
  coinbase: (account: string, guard: PactValue, amount: string): { name: string; args: PactValue[] } =>
    createCapability("coin.COINBASE", account, guard, createDecimal(amount)),
  remediate: (account: string, guard: PactValue, amount: string): { name: string; args: PactValue[] } =>
    createCapability("coin.REMEDIATE", account, guard, createDecimal(amount)),
};

/**
 * Utility to create a standard keyset for single key
 */
export function createSingleKeyKeyset(publicKey: string): PactKeyset {
  return {
    keys: [publicKey],
    pred: "keys-all",
  };
}

/**
 * Utility to create a multi-sig keyset
 */
export function createMultiSigKeyset(publicKeys: string[], threshold: number = publicKeys.length): PactKeyset {
  if (threshold > publicKeys.length) {
    throw new Error("Threshold cannot be greater than number of keys");
  }

  if (threshold === publicKeys.length) {
    return {
      keys: publicKeys,
      pred: "keys-all",
    };
  } else if (threshold === 1) {
    return {
      keys: publicKeys,
      pred: "keys-any",
    };
  } else if (threshold === 2) {
    return {
      keys: publicKeys,
      pred: "keys-2",
    };
  } else {
    // For custom thresholds, we'd need a custom predicate function
    throw new Error("Custom threshold predicates not yet supported");
  }
}

/**
 * Validate a namespace name format
 *
 * @param namespaceName - The namespace name to validate
 * @returns True if the namespace name is valid
 *
 * @example
 * ```typescript
 * console.log(validateNamespaceName("n_abc123")); // true
 * console.log(validateNamespaceName("my-namespace")); // true
 * console.log(validateNamespaceName("invalid!")); // false
 * ```
 */
export function validateNamespaceName(namespaceName: string): boolean {
  if (!namespaceName || typeof namespaceName !== "string") {
    return false;
  }

  // Check length constraints
  if (namespaceName.length < 1 || namespaceName.length > 256) {
    return false;
  }

  // Principal namespaces must start with "n_" followed by a hex hash
  if (namespaceName.startsWith("n_")) {
    const hashPart = namespaceName.slice(2);
    return hashPart.length === 64 && /^[a-fA-F0-9]+$/.test(hashPart);
  }

  // Regular namespaces can contain letters, numbers, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(namespaceName);
}

/**
 * Validate if a keyset is suitable for principal namespace creation
 *
 * Principal namespaces only work with keysets (not other guard types)
 *
 * @param keyset - The keyset to validate
 * @returns True if the keyset is valid for principal namespace creation
 */
export function validatePrincipalKeyset(keyset: PactKeyset): boolean {
  if (!keyset || typeof keyset !== "object") {
    return false;
  }

  // Must have keys array
  if (!Array.isArray(keyset.keys) || keyset.keys.length === 0) {
    return false;
  }

  // Must have valid predicate
  if (!keyset.pred || typeof keyset.pred !== "string") {
    return false;
  }

  // Validate each key
  for (const key of keyset.keys) {
    if (typeof key !== "string" || key.length !== 64 || !/^[a-fA-F0-9]+$/.test(key)) {
      return false;
    }
  }

  // Validate predicate
  const validPredicates = ["keys-all", "keys-any", "keys-2"];
  if (!validPredicates.includes(keyset.pred) && !keyset.pred.startsWith("keys-")) {
    return false;
  }

  return true;
}

/**
 * Utility to check if a namespace is a principal namespace
 *
 * @param namespaceName - The namespace name to check
 * @returns True if the namespace is a principal namespace
 *
 * @example
 * ```typescript
 * console.log(isPrincipalNamespace("n_abc123...")); // true
 * console.log(isPrincipalNamespace("my-namespace")); // false
 * ```
 */
export function isPrincipalNamespace(namespaceName: string): boolean {
  return namespaceName.startsWith("n_") && namespaceName.length === 66;
}
