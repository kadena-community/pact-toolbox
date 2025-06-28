import type { ChainId, PactValue } from "@pact-toolbox/types";
import type { ToolboxNetworkContext } from "@pact-toolbox/transaction";

// Common types
export interface StandardOperationOptions {
  context?: ToolboxNetworkContext;
  chainId?: ChainId;
  sender?: string;
  gasLimit?: number;
  gasPrice?: number;
  ttl?: number;
}

// Coin contract types
export interface CoinAccount {
  account: string;
  balance: string;
  guard: PactValue;
}

export interface CoinTransferOptions extends StandardOperationOptions {
  from: string;
  to: string;
  amount: string;
}

export interface CoinTransferCreateOptions extends CoinTransferOptions {
  toGuard: PactValue;
}

export interface CoinCrosschainTransferOptions extends CoinTransferOptions {
  targetChainId: ChainId;
  toGuard?: PactValue;
}

export interface CoinAccountCreateOptions extends StandardOperationOptions {
  account: string;
  guard: PactValue;
}

export interface CoinBalanceOptions extends StandardOperationOptions {
  account: string;
}

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

// Marmalade types
export interface TokenInfo {
  id: string;
  supply: string;
  precision: number;
  uri: string;
  policies: string[];
}

export interface TokenCreateOptions extends StandardOperationOptions {
  id: string;
  precision: number;
  uri: string;
  policies: string[];
  creator?: string;
}

export interface TokenMintOptions extends StandardOperationOptions {
  tokenId: string;
  account: string;
  guard: PactValue;
  amount: string;
}

export interface TokenTransferOptions extends StandardOperationOptions {
  tokenId: string;
  from: string;
  to: string;
  amount: string;
}

export interface TokenBurnOptions extends StandardOperationOptions {
  tokenId: string;
  account: string;
  amount: string;
}

export interface TokenSaleOptions extends StandardOperationOptions {
  tokenId: string;
  seller: string;
  price: string;
  timeout: number;
}

export interface TokenBuyOptions extends StandardOperationOptions {
  tokenId: string;
  buyer: string;
  amount: string;
}

export interface PolicyInfo {
  name: string;
  implements: string[];
}

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
