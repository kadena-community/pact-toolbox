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

## What's Included

This package exports TypeScript type definitions used across the pact-toolbox ecosystem:

- Configuration types for network setup
- Transaction and signing types
- Pact command and result types
- Wallet interface definitions
- Re-exports of essential types from @kadena/types

## Type Reference

The package exports types from two main categories:

### Configuration Types (from `config.ts`)

#### `SerializableNetworkConfig`

Complete network configuration including key pairs and metadata.

```typescript
interface SerializableNetworkConfig extends CommonNetworkConfig {
  type: "chainweb-local" | "chainweb" | "pact-server" | "chainweb-devnet";
  serverConfig?: {
    port?: number;
  };
  containerConfig?: {
    port?: number;
  };
  autoStart?: boolean;
}

interface CommonNetworkConfig {
  networkId: string;
  rpcUrl: string;
  name?: string;
  senderAccount: string; // Required
  keyPairs: KeyPair[]; // Required
  keysets: Record<string, PactKeyset>; // Required
  meta: NetworkMeta; // Required
}
```

#### `KeyPair`

Extended key pair with account information.

```typescript
interface KeyPair extends IKeyPair {
  account: string | `k:${string}`; // Required account identifier
}
```

#### `NetworkMeta`

Default transaction metadata for a network.

```typescript
interface NetworkMeta {
  chainId: ChainId; // Required
  gasLimit?: number;
  gasPrice?: number;
  ttl?: number;
}
```

#### `MultiNetworkConfig`

Configuration for multiple networks.

```typescript
interface MultiNetworkConfig {
  default: string;
  configs: Record<string, SerializableNetworkConfig>;
  environment: "development" | "production" | "test";
}
```

#### `GetRpcUrlParams`

Parameters for constructing RPC URLs.

```typescript
interface GetRpcUrlParams {
  chainId?: string;
  networkId?: string;
}
```

#### `StandardPrelude`

Standard prelude types available.

```typescript
type StandardPrelude = "kadena/chainweb" | "kadena/marmalade";
```

### Pact Types (from `pact.ts`)

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

#### `Serializable`

JSON-serializable value type.

```typescript
type Serializable = string | number | boolean | null | PactKeyset | Serializable[] | { [key: string]: Serializable };
```

#### `PactKeyPair`

Basic key pair for Pact operations.

```typescript
interface PactKeyPair {
  publicKey: string;
  secretKey: string;
}
```

#### `PactKeyset`

Authorization keyset definition.

```typescript
interface PactKeyset {
  keys: string[]; // List of public keys
  pred: PactBuiltInPredicate | (string & {}); // Predicate function
}

type PactBuiltInPredicate = "keys-all" | "keys-any" | "keys-2";
```

#### `PactCapability`

Capability grant specification.

```typescript
interface PactCapability {
  name: string; // Capability name (e.g., 'coin.TRANSFER')
  args: PactValue[]; // Capability arguments
}
```

#### `PactCommand`

Core command structure for transactions.

```typescript
interface PactCommand<Payload extends PactCmdPayload = PactExecPayload> {
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
  exec: PactExec;
}

interface PactExec {
  code: string; // Pact code to execute
  data: PactEnvData; // Environment data
}

type PactEnvData = Record<string, Serializable>;
```

#### `PactContPayload`

Continuation/defpact payload.

```typescript
interface PactContPayload {
  cont: PactCont;
}

interface PactCont {
  pactId: string; // Pact execution ID
  step: number; // Step number
  rollback: boolean; // Rollback flag
  data: PactEnvData;
  proof?: string | null; // SPV proof
}
```

#### `PactMetadata`

Transaction metadata.

```typescript
interface PactMetadata {
  chainId: ChainId;
  sender?: string;
  gasLimit?: number;
  gasPrice?: number;
  ttl?: number;
  creationTime?: number;
}
```

#### `PactSigner`

Transaction signer specification.

```typescript
interface PactSigner {
  pubKey: string; // Public key
  address?: string; // Optional address
  scheme?: SignerScheme; // Signature scheme
  clist?: PactCapability[]; // Capability list
}

type SignerScheme = "ED25519" | "ETH" | "WebAuthn";
```

#### `PactVerifier`

Transaction verifier specification.

```typescript
interface PactVerifier {
  name: string;
  proof: PactValue;
  clist?: PactCapability[];
}
```

#### Transaction Types

```typescript
type Transaction = PartiallySignedTransaction | SignedTransaction;

interface PartiallySignedTransaction {
  cmd: string; // Command JSON string
  hash: Uint8Array | string; // Transaction hash
  sigs: TransactionSig[]; // Array of partial or full signatures
}

interface SignedTransaction {
  cmd: string; // Command JSON string
  hash: string; // Transaction hash (always string)
  sigs: TransactionFullSig[]; // Array of complete signatures
}

interface TransactionFullSig {
  sig: string;
  pubKey?: string;
}

interface TransactionPartialSig {
  pubKey: string;
  sig?: string;
}

type TransactionSig = TransactionFullSig | TransactionPartialSig;
```

#### Result Types

```typescript
interface PactTransactionResult {
  reqKey: string; // Request key
  txId: number | null; // Transaction ID
  result: PactTransactionResultSuccess | PactTransactionResultError;
  gas: number; // Gas consumed
  logs: string | null; // Log output
  continuation: PactContinuationResult | null;
  metaData: ChainwebResponseMetaData | null;
  events?: PactEvent[]; // Optional events array
}

interface PactTransactionResultSuccess {
  status: "success";
  data: PactValue;
}

interface PactTransactionResultError {
  status: "failure";
  error: object; // Generic error object
}

interface LocalPactTransactionResult extends PactTransactionResult {
  preflightWarnings?: string[];
}

interface PactTransactionDescriptor {
  requestKey: string;
  chainId: ChainId;
  networkId: string;
}
```

#### `PactContinuationResult`

Defpact execution result.

```typescript
interface PactContinuationResult {
  pactId: string; // Pact ID
  step: number; // Current step
  stepCount: number; // Total steps
  executed: boolean | null; // Execution status
  stepHasRollback: boolean; // Rollback availability
  continuation: {
    def: string; // Fully-qualified defpact name
    args: PactValue; // Arguments (single value, not array)
  };
  yield: {
    data: Array<[string, PactValue]>; // Array of key-value tuples
    provenance: {
      targetChainId: ChainId;
      moduleHash: string;
    } | null;
  } | null;
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
  params: Array<PactValue>; // Event parameters
  moduleHash: string; // Module hash
}
```

#### Wallet Types

```typescript
interface WalletApiLike {
  sign: SignFunction;
  quickSign?: QuickSignFunction;
  getSigner: (networkId?: string) => Promise<{
    publicKey: string;
    address: string;
  }>;
}

interface SignFunction {
  (tx: PartiallySignedTransaction): Promise<Transaction>;
}

interface QuickSignFunction {
  (tx: PartiallySignedTransaction): Promise<Transaction>;
  (txs: PartiallySignedTransaction[]): Promise<Transaction[]>;
}
```

#### Additional Types

```typescript
type PactSignerLike = string | PactSigner;

type PactCapabilityLike = (withCapability: (name: string, ...args: PactValue[]) => PactCapability) => PactCapability[];

// Re-exported from @kadena/types
export type { PactValue } from "@kadena/types";
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
  senderAccount: "k:sender-public-key",
  keyPairs: [],
  keysets: {},
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
  senderAccount: "sender00",
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
  meta: {
    chainId: "0",
    gasLimit: 150000,
    gasPrice: 0.00001,
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
import type { Transaction, SignedTransaction, TransactionFullSig } from "@pact-toolbox/types";

function isSignedTransaction(tx: Transaction): tx is SignedTransaction {
  return (
    typeof tx.hash === "string" &&
    tx.sigs.every(
      (sig): sig is TransactionFullSig =>
        typeof sig === "object" && sig !== null && "sig" in sig && typeof sig.sig === "string",
    )
  );
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
import type { PartiallySignedTransaction, Transaction } from "@pact-toolbox/types";
import type { Wallet } from "@pact-toolbox/wallet-core";

class TransactionManager {
  constructor(private wallet: Wallet) {}
  async sign(tx: PartiallySignedTransaction): Promise<Transaction> {
    return this.wallet.sign(tx);
  }
}
```

## Best Practices

### 1. Import Types Properly

```typescript
// ✅ Good - Import only types
import type { PactCommand, PactTransactionResult } from "@pact-toolbox/types";

// ❌ Bad - Runtime import of type-only package
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
const chainId: ChainId = "0"; // ✅ Valid
// const chainId: ChainId = "20"; // ❌ Type error

// Use literal types for better IntelliSense
const pred: PactBuiltInPredicate = "keys-all"; // ✅ Autocomplete works
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
- **@pact-toolbox/signers** - Uses signing and wallet types
- **@pact-toolbox/network** - Uses network and configuration types
- **@pact-toolbox/kda** - Uses all core types

## Contributing

When adding new types:

1. Ensure backward compatibility
2. Add comprehensive JSDoc comments
3. Include usage examples in documentation
4. Export from the appropriate file (config.ts or pact.ts)
5. Consider ecosystem-wide impact

## License

MIT
