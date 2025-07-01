import type { PactValue } from "@pact-toolbox/types";

// Standard library types
export type GuardType = "keyset" | "capability" | "user" | "module";

export interface KeysetGuard {
  keys: string[];
  pred: "keys-all" | "keys-any" | "keys-2" | string;
}

export interface CapabilityGuard {
  capability: {
    name: string;
    args: PactValue[];
  };
}

export interface UserGuard {
  fun: string;
  args: PactValue[];
}

export interface ModuleGuard {
  name: string;
  args: PactValue[];
}

export type Guard = KeysetGuard | CapabilityGuard | UserGuard | ModuleGuard;

// Time utilities
export interface PactTime {
  time: string;
  timep: string;
}

// Decimal utilities
export interface PactDecimal {
  decimal: string;
}

// Namespace types
export interface NamespaceInfo {
  name: string;
  adminKeyset: string;
  userKeyset: string;
  isPrincipal: boolean;
}

export interface PrincipalNamespaceResult {
  namespace: string;
  status: string;
}
