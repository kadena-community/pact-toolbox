# @pact-toolbox/types

> Comprehensive TypeScript type definitions for Pact smart contract development on Kadena

## Overview

The `@pact-toolbox/types` package provides the core TypeScript type definitions used throughout the pact-toolbox ecosystem. It includes types for network configuration, transaction building, signing, execution results, and wallet integration, ensuring type safety and consistency across all Pact development tools.

## Installation

```bash
npm install @pact-toolbox/types
# or
pnpm add @pact-toolbox/types
```

## Features

- = **Type Safety** - Comprehensive TypeScript definitions for all Pact concepts
- < **Network Types** - Configuration types for all Kadena network variants
- =� **Transaction Types** - Complete typing for transaction building and signing
- = **Key Management** - Types for key pairs, keysets, and capabilities
- =� **Result Types** - Detailed types for execution results and events
- = **Wallet Integration** - Standardized interfaces for wallet providers
- { **Ecosystem Compatible** - Extends and integrates with @kadena/types
- <� **IntelliSense Support** - Rich IDE autocomplete and type hints

## Quick Start

```typescript
import type {
  PactCommand,
  PactTransactionResult,
  SerializableNetworkConfig,
  PactKeyset,
  PactCapability,
} from "@pact-toolbox/types";

// Define network configuration
const config: SerializableNetworkConfig = {
  type: "chainweb",
  networkId: "mainnet01",
  rpcUrl: "https://api.chainweb.com",
  keyPairs: [
    {
      publicKey: "your-public-key",
      secretKey: "your-secret-key",
      account: "k:your-public-key",
    },
  ],
  meta: {
    chainId: "0",
    gasLimit: 150000,
    gasPrice: 0.00000001,
    ttl: 600,
  },
};

// Build a typed command
const command: PactCommand<PactExecPayload> = {
  payload: {
    exec: {
      code: '(coin.transfer "alice" "bob" 1.0)',
      data: {},
    },
  },
  meta: {
    chainId: "0",
    gasLimit: 1000,
    gasPrice: 0.00000001,
    ttl: 600,
    creationTime: Date.now() / 1000,
    sender: "alice",
  },
  signers: [
    {
      pubKey: "alice-public-key",
      clist: [{ name: "coin.TRANSFER", args: ["alice", "bob", 1.0] }],
    },
  ],
  networkId: "mainnet01",
  nonce: Date.now().toString(),
};
```

## Type Reference

### Configuration Types

#### `SerializableNetworkConfig`

Complete network configuration including key pairs and metadata.

```typescript
interface SerializableNetworkConfig extends CommonNetworkConfig {
  type: "chainweb-local" | "chainweb" | "pact-server" | "chainweb-devnet";
}

interface CommonNetworkConfig {
  networkId: string;
  rpcUrl: string;
  name?: string;
  senderAccount?: string;
  keyPairs?: KeyPair[];
  keysets?: Record<string, PactKeyset>;
  meta?: NetworkMeta;
}
```

#### `KeyPair`

Extended key pair with account information.

```typescript
interface KeyPair {
  publicKey: string;
  secretKey: string;
  account?: string; // Optional account identifier
}
```

#### `NetworkMeta`

Default transaction metadata for a network.

```typescript
interface NetworkMeta {
  chainId?: ChainId;
  gasLimit?: number;
  gasPrice?: number;
  ttl?: number;
}
```

### Core Pact Types

#### `ChainId`

Type-safe chain ID literal type.

```typescript
type ChainId =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19";
```

#### `PactKeyset`

Authorization keyset definition.

```typescript
interface PactKeyset {
  keys: string[]; // List of public keys
  pred: "keys-all" | "keys-any" | "keys-2" | string; // Predicate function
}
```

#### `PactCapability`

Capability grant specification.

```typescript
interface PactCapability {
  name: string; // Capability name (e.g., 'coin.TRANSFER')
  args: PactValue[]; // Capability arguments
}
```

### Transaction Types

#### `PactCommand`

Core command structure for transactions.

```typescript
interface PactCommand<Payload = PactExecPayload | PactContPayload> {
  payload: Payload;
  meta: PactMetadata;
  signers: PactSigner[];
  verifiers?: PactVerifier[];
  networkId: string;
  nonce: string;
}
```

#### `PactExecPayload`

Direct code execution payload.

```typescript
interface PactExecPayload {
  exec: {
    code: string; // Pact code to execute
    data: Record<string, unknown>; // Environment data
  };
}
```

#### `PactContPayload`

Continuation/defpact payload.

```typescript
interface PactContPayload {
  cont: {
    pactId: string; // Pact execution ID
    step: number; // Step number
    rollback: boolean; // Rollback flag
    data?: Record<string, unknown>;
    proof?: string; // SPV proof
  };
}
```

#### `PactSigner`

Transaction signer specification.

```typescript
interface PactSigner {
  pubKey: string; // Public key
  address?: string; // Optional address
  scheme?: "ED25519" | "ETH" | "WebAuthn"; // Signature scheme
  clist?: PactCapability[]; // Capability list
}
```

#### `Transaction`

Union type for transaction states.

```typescript
type Transaction = PartiallySignedTransaction | SignedTransaction;

interface PartiallySignedTransaction {
  cmd: string; // Command JSON string
  hash: Uint8Array | string; // Transaction hash
  sigs: Array<{ sig: string | null } | null>; // Partial signatures
}

interface SignedTransaction {
  cmd: string; // Command JSON string
  hash: string; // Transaction hash
  sigs: Array<{ sig: string }>; // Complete signatures
}
```

### Result Types

#### `PactTransactionResult`

Complete transaction execution result.

```typescript
interface PactTransactionResult {
  reqKey: string; // Request key
  txId: number | null; // Transaction ID
  result: {
    status: "success" | "failure";
    data?: PactValue; // Success data
    error?: {
      message: string;
      type: string;
      info?: string;
    };
  };
  gas: number; // Gas consumed
  logs: string | null; // Log output
  continuation: PactContinuationResult | null;
  metaData: {
    blockHeight: number;
    blockTime: number;
    blockHash: string;
    prevBlockHash: string;
  } | null;
  events: PactEvent[] | null;
}
```

#### `LocalPactTransactionResult`

Extended result for local execution.

```typescript
interface LocalPactTransactionResult extends PactTransactionResult {
  preflightWarnings?: string[]; // Optional warnings
}
```

#### `PactEvent`

Event emitted during execution.

```typescript
interface PactEvent {
  name: string; // Event name
  module: {
    name: string; // Module name
    namespace: string | null; // Module namespace
  };
  params: PactValue[]; // Event parameters
  moduleHash: string; // Module hash
}
```

#### `PactContinuationResult`

Defpact execution result.

```typescript
interface PactContinuationResult {
  pactId: string; // Pact ID
  step: number; // Current step
  stepCount: number; // Total steps
  executed: boolean; // Execution status
  stepHasRollback: boolean; // Rollback availability
  continuation: {
    def: string; // Defpact name
    args: PactValue[]; // Arguments
  };
  yield: {
    data: Record<string, PactValue>;
    provenance?: {
      targetChainId: string;
      moduleHash: string;
    };
  } | null;
}
```

### Wallet Types

#### `WalletApiLike`

Standard wallet interface.

```typescript
interface WalletApiLike {
  sign(tx: UnsignedTransaction): Promise<SignedTransaction>;
  quickSign?(txs: UnsignedTransaction[]): Promise<SignedTransaction[]>;
  getSigner?(): PactSigner;
}
```

#### `SignFunction`

Single transaction signing function.

```typescript
type SignFunction = (tx: UnsignedTransaction) => Promise<SignedTransaction>;
```

#### `QuickSignFunction`

Batch transaction signing function.

```typescript
type QuickSignFunction = (txs: UnsignedTransaction[]) => Promise<SignedTransaction[]>;
```

#### `WalletLike`

Union of all wallet types.

```typescript
type WalletLike = WalletApiLike | SignFunction | [SignFunction, QuickSignFunction];
```

### Utility Types

#### `Serializable`

JSON-serializable value type.

```typescript
type Serializable = string | number | boolean | null | { [key: string]: Serializable } | Serializable[];
```

#### `PactValue`

Any valid Pact value (re-exported from @kadena/types).

#### `PactSignerLike`

Flexible signer input type.

```typescript
type PactSignerLike = string | PactSigner;
```

#### `PactCapabilityLike`

Capability provider function.

```typescript
type PactCapabilityLike = () => PactCapability[];
```

## Usage Examples

### Network Configuration

```typescript
import type { SerializableNetworkConfig } from "@pact-toolbox/types";

// Mainnet configuration
const mainnet: SerializableNetworkConfig = {
  type: "chainweb",
  networkId: "mainnet01",
  rpcUrl: "https://api.chainweb.com",
  meta: {
    chainId: "0",
    gasLimit: 150000,
    gasPrice: 0.00000001,
    ttl: 600,
  },
};

// Local development configuration
const local: SerializableNetworkConfig = {
  type: "chainweb-local",
  networkId: "development",
  rpcUrl: "http://localhost:8080",
  keyPairs: [
    {
      publicKey: "dev-public-key",
      secretKey: "dev-secret-key",
      account: "dev-account",
    },
  ],
  keysets: {
    "admin-keyset": {
      keys: ["dev-public-key"],
      pred: "keys-all",
    },
  },
};
```

### Transaction Building

```typescript
import type { PactCommand, PactExecPayload, PactSigner } from "@pact-toolbox/types";

// Create a transfer command
const transferCommand: PactCommand<PactExecPayload> = {
  payload: {
    exec: {
      code: '(coin.transfer "alice" "bob" 1.0)',
      data: {
        "alice-ks": { keys: ["alice-key"], pred: "keys-all" },
      },
    },
  },
  meta: {
    chainId: "0",
    gasLimit: 1500,
    gasPrice: 0.00000001,
    ttl: 600,
    creationTime: Math.floor(Date.now() / 1000),
    sender: "alice",
  },
  signers: [
    {
      pubKey: "alice-public-key",
      clist: [
        { name: "coin.TRANSFER", args: ["alice", "bob", 1.0] },
        { name: "coin.GAS", args: [] },
      ],
    },
  ],
  networkId: "mainnet01",
  nonce: Date.now().toString(),
};
```

### Result Handling

```typescript
import type { PactTransactionResult } from "@pact-toolbox/types";

function handleResult(result: PactTransactionResult): void {
  if (result.result.status === "success") {
    console.log("Success:", result.result.data);

    // Check for events
    if (result.events) {
      result.events.forEach((event) => {
        console.log(`Event ${event.name}:`, event.params);
      });
    }
  } else {
    console.error("Failed:", result.result.error);
  }

  console.log(`Gas used: ${result.gas}`);
}
```

### Type Guards

```typescript
import type { Transaction, SignedTransaction } from "@pact-toolbox/types";

function isSignedTransaction(tx: Transaction): tx is SignedTransaction {
  return tx.sigs.every((sig) => sig !== null && sig.sig !== null);
}

function processTransaction(tx: Transaction) {
  if (isSignedTransaction(tx)) {
    // TypeScript knows tx is SignedTransaction here
    console.log("Ready to submit:", tx.hash);
  } else {
    console.log("Transaction needs more signatures");
  }
}
```

### Wallet Integration

```typescript
import type { WalletLike, UnsignedTransaction, SignedTransaction } from "@pact-toolbox/types";

class TransactionManager {
  constructor(private wallet: WalletLike) {}

  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    if (typeof this.wallet === "function") {
      // Single sign function
      return this.wallet(tx);
    } else if (Array.isArray(this.wallet)) {
      // Sign and quickSign functions
      const [sign] = this.wallet;
      return sign(tx);
    } else {
      // WalletApiLike
      return this.wallet.sign(tx);
    }
  }

  async signBatch(txs: UnsignedTransaction[]): Promise<SignedTransaction[]> {
    if (Array.isArray(this.wallet)) {
      const [, quickSign] = this.wallet;
      return quickSign(txs);
    } else if (typeof this.wallet === "object" && this.wallet.quickSign) {
      return this.wallet.quickSign(txs);
    } else {
      // Fallback to signing one by one
      return Promise.all(txs.map((tx) => this.signTransaction(tx)));
    }
  }
}
```

## Best Practices

### 1. Import Types Properly

```typescript
//  Good - Import only types
import type { PactCommand, PactTransactionResult } from "@pact-toolbox/types";

// L Bad - Runtime import of type-only package
import { PactCommand } from "@pact-toolbox/types";
```

### 2. Use Type Narrowing

```typescript
// Use discriminated unions effectively
function processPayload(payload: PactExecPayload | PactContPayload) {
  if ("exec" in payload) {
    // TypeScript knows this is PactExecPayload
    console.log("Executing:", payload.exec.code);
  } else {
    // TypeScript knows this is PactContPayload
    console.log("Continuing pact:", payload.cont.pactId);
  }
}
```

### 3. Leverage Type Safety

```typescript
// Let TypeScript catch errors at compile time
const chainId: ChainId = "0"; //  Valid
const chainId: ChainId = "20"; // L Type error

// Use literal types for better IntelliSense
const pred: "keys-all" | "keys-any" = "keys-all"; //  Autocomplete works
```

### 4. Create Type-Safe Builders

```typescript
// Build type-safe abstractions
class CommandBuilder {
  private command: Partial<PactCommand> = {};

  setPayload(payload: PactExecPayload | PactContPayload): this {
    this.command.payload = payload;
    return this;
  }

  addSigner(signer: PactSigner): this {
    this.command.signers = [...(this.command.signers || []), signer];
    return this;
  }

  build(): PactCommand {
    if (!this.command.payload || !this.command.meta) {
      throw new Error("Missing required fields");
    }
    return this.command as PactCommand;
  }
}
```

## Integration with Other Packages

The types package is used throughout the pact-toolbox ecosystem:

- **@pact-toolbox/transaction** - Uses transaction and result types
- **@pact-toolbox/config** - Uses network configuration types
- **@pact-toolbox/runtime** - Uses execution and result types
- **@pact-toolbox/signer** - Uses signing and wallet types
- **@pact-toolbox/network** - Uses network and configuration types

## Migration Guide

### From @kadena/types

```typescript
// Before
import type { ICommand } from "@kadena/types";

// After
import type { PactCommand } from "@pact-toolbox/types";
// Note: PactCommand extends and enhances ICommand
```

### From Custom Types

```typescript
// Replace custom interfaces with standard types
interface MyTransactionResult {
  // Before
  requestKey: string;
  result: any;
}

// After
import type { PactTransactionResult } from "@pact-toolbox/types";
```

## Contributing

When adding new types:

1. Ensure backward compatibility
2. Add comprehensive JSDoc comments
3. Include usage examples in documentation
4. Export from the main index.ts
5. Consider ecosystem-wide impact
