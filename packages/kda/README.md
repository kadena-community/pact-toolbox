# @pact-toolbox/kda

High-level services and utilities for interacting with Kadena blockchain smart contracts, including coin operations, namespace management, Marmalade NFT framework, and Pact standard library functions.

## Overview

This package provides a service-based architecture for Kadena blockchain operations, offering both high-level services that handle transaction building and wallet integration, as well as standalone utility functions for general use.

## Architecture

### Services (Require Network Context)

Services are configured with a `ToolboxNetworkContext` that provides network configuration, wallet management, and blockchain client access. They handle transaction building, signing, and submission automatically.

- **CoinService** - Coin contract operations (transfers, account creation, balance queries)
- **MarmaladeService** - Marmalade NFT framework operations (token creation, minting, transfers, sales)
- **NamespaceService** - Namespace management operations (principal namespace creation, module definition)

### Standalone Utilities (No Network Required)

Utility functions that work independently without requiring network context or wallet access.

- **pact utilities** - Guards, keysets, capabilities, time functions, validation
- **validation utilities** - Namespace, keyset, and account validation (offline operations)

## Installation

```bash
npm install @pact-toolbox/kda
# or
pnpm add @pact-toolbox/kda
```

## Quick Start

### Using Services

```typescript
import { CoinService, MarmaladeService, NamespaceService } from '@pact-toolbox/kda';
import { ToolboxNetworkContext } from '@pact-toolbox/transaction';

// Create network context
const context = new ToolboxNetworkContext(/* network config */);

// Initialize services
const coinService = new CoinService({ context, defaultChainId: "0" });
const marmaladeService = new MarmaladeService({ context, defaultChainId: "0" });
const namespaceService = new NamespaceService({ context, defaultChainId: "0" });

// Transfer coins
const result = await coinService.transfer({
  from: "k:sender-public-key",
  to: "k:receiver-public-key", 
  amount: "10.0"
});

// Create NFT token
const tokenResult = await marmaladeService.createToken({
  id: "my-nft-token",
  precision: 0,
  uri: "https://example.com/metadata.json",
  policies: [],
  creator: "creator-public-key"
});

// Create principal namespace
const namespaceResult = await namespaceService.createPrincipalNamespace({
  adminKeyset: { keys: ["admin-key"], pred: "keys-all" }
});
```

### Using Standalone Utilities

```typescript
import { pact } from '@pact-toolbox/kda';

// Create keyset guard
const guard = pact.createKeysetGuard("my-keyset", ["key1", "key2"], "keys-all");

// Create capability
const capability = pact.createCapability("coin.TRANSFER", "from", "to", 10.0);

// Format time for Pact
const pactTime = pact.formatTime(new Date());

// Validate namespace name format
const isValid = pact.validateNamespaceName("n_abc123...");

// Validate keyset for principal namespace
const keysetValid = pact.validatePrincipalKeyset({
  keys: ["my-key"],
  pred: "keys-all"
});

// Check if namespace is a principal namespace
const isPrincipal = pact.isPrincipalNamespace("n_abc123...");
```

## API Reference

### CoinService

Service for coin contract operations requiring network context and wallet.

```typescript
// Configuration
const coinService = new CoinService({
  context: ToolboxNetworkContext,
  defaultChainId?: ChainId
});

// Methods
await coinService.getBalance(account: string, options?: CoinOperationOptions): Promise<string>
await coinService.getAccountDetails(account: string, options?: CoinOperationOptions): Promise<AccountInfo>
await coinService.accountExists(account: string, options?: CoinOperationOptions): Promise<boolean>
await coinService.createAccount(options: CreateAccountOptions): Promise<PactTransactionResult>
await coinService.transfer(options: TransferOptions): Promise<PactTransactionResult>
await coinService.transferCreate(options: TransferCreateOptions): Promise<PactTransactionResult>
await coinService.transferCrosschain(options: CrosschainTransferOptions): Promise<PactTransactionResult>
await coinService.fund(options: TransferCreateOptions): Promise<PactTransactionResult>
```

### MarmaladeService

Service for Marmalade NFT operations requiring network context and wallet.

```typescript
// Configuration
const marmaladeService = new MarmaladeService({
  context: ToolboxNetworkContext,
  defaultChainId?: ChainId
});

// Methods
await marmaladeService.getTokenInfo(tokenId: string, options?: MarmaladeOperationOptions): Promise<TokenInfo>
await marmaladeService.getBalance(tokenId: string, account: string, options?: MarmaladeOperationOptions): Promise<string>
await marmaladeService.tokenExists(tokenId: string, options?: MarmaladeOperationOptions): Promise<boolean>
await marmaladeService.createToken(options: CreateTokenOptions): Promise<PactTransactionResult>
await marmaladeService.mintToken(options: MintTokenOptions): Promise<PactTransactionResult>
await marmaladeService.transferToken(options: TransferTokenOptions): Promise<PactTransactionResult>
await marmaladeService.transferCreateToken(options: TransferCreateTokenOptions): Promise<PactTransactionResult>
await marmaladeService.burnToken(options: BurnTokenOptions): Promise<PactTransactionResult>
await marmaladeService.createSale(options: CreateSaleOptions): Promise<PactTransactionResult>
await marmaladeService.buyToken(options: BuyTokenOptions): Promise<PactTransactionResult>
```

### NamespaceService

Service for principal namespace operations requiring network context and wallet.

```typescript
// Configuration
const namespaceService = new NamespaceService({
  context: ToolboxNetworkContext,
  defaultChainId?: ChainId
});

// Methods
namespaceService.generatePrincipalNamespace(adminKeyset: PactKeyset): string
await namespaceService.createPrincipalNamespace(options: CreatePrincipalNamespaceOptions): Promise<NamespaceResult>
```

### Pact Utilities (Standalone)

Utility functions for Pact data structures and operations (no network required).

```typescript
import { pact } from '@pact-toolbox/kda';

// Guards
pact.createKeysetGuard(name: string, keys: string[], pred?: string): KeysetGuard
pact.createCapabilityGuard(capabilityName: string, ...args: PactValue[]): CapabilityGuard
pact.createUserGuard(fun: string, ...args: PactValue[]): UserGuard
pact.createModuleGuard(name: string, ...args: PactValue[]): ModuleGuard

// Keysets
pact.createKeyset(guard: KeysetGuard): PactKeyset
pact.createSingleKeyKeyset(publicKey: string): PactKeyset
pact.createMultiSigKeyset(publicKeys: string[], threshold?: number): PactKeyset

// Time utilities
pact.formatTime(date: Date): PactTime
pact.parseTime(pactTime: string | PactTime): Date
pact.getCurrentTime(): PactTime
pact.addTime(date: Date, seconds: number): PactTime

// Decimal utilities
pact.createDecimal(value: string | number): PactDecimal
pact.parseDecimal(decimal: PactDecimal | string): number
pact.formatDecimal(value: number, precision?: number): string

// Validation
pact.validateAccountName(account: string): boolean
pact.validatePublicKey(publicKey: string): boolean
pact.validateNamespaceName(namespaceName: string): boolean
pact.validatePrincipalKeyset(keyset: PactKeyset): boolean
pact.isPrincipalNamespace(namespaceName: string): boolean

// Account utilities
pact.createKAccount(publicKey: string): string
pact.extractPublicKey(account: string): string

// Capabilities
pact.createCapability(name: string, ...args: PactValue[]): Capability
pact.coinCapabilities.gas(): Capability
pact.coinCapabilities.transfer(from: string, to: string, amount: string): Capability
pact.coinCapabilities.transferXchain(from: string, to: string, amount: string, targetChainId: string): Capability
```


## Examples

### Complete Coin Transfer Workflow

```typescript
import { CoinService } from '@pact-toolbox/kda';
import { ToolboxNetworkContext } from '@pact-toolbox/transaction';

// Setup
const context = new ToolboxNetworkContext(networkConfig);
const coinService = new CoinService({ context });

// Check if destination account exists
const exists = await coinService.accountExists("k:receiver-key");

if (!exists) {
  // Create account if it doesn't exist
  await coinService.createAccount({
    account: "k:receiver-key",
    guard: { keys: ["receiver-key"], pred: "keys-all" }
  });
}

// Transfer coins
const result = await coinService.transfer({
  from: "k:sender-key",
  to: "k:receiver-key",
  amount: "10.0",
  chainId: "0"
});

console.log(`Transfer completed: ${result.reqKey}`);
```

### NFT Creation and Minting

```typescript
import { MarmaladeService } from '@pact-toolbox/kda';

const marmaladeService = new MarmaladeService({ context });

// Create NFT collection
const tokenResult = await marmaladeService.createToken({
  id: "my-collection.nft-001",
  precision: 0,
  uri: "https://example.com/metadata/001.json",
  policies: ["marmalade.policy.non-fungible"],
  creator: "creator-public-key"
});

// Mint NFT to owner
const mintResult = await marmaladeService.mintToken({
  tokenId: "my-collection.nft-001",
  account: "k:owner-key",
  guard: { keys: ["owner-key"], pred: "keys-all" },
  amount: "1.0"
});
```

### Principal Namespace Creation

```typescript
import { NamespaceService } from '@pact-toolbox/kda';

const namespaceService = new NamespaceService({ context });

// Create principal namespace
const result = await namespaceService.createPrincipalNamespace({
  adminKeyset: { keys: ["admin-key"], pred: "keys-all" },
  userKeyset: { keys: ["user-key"], pred: "keys-all" }
});

console.log(`Namespace created: ${result.namespace}`);

// Generate namespace name without blockchain interaction
const namespaceName = namespaceService.generatePrincipalNamespace({
  keys: ["admin-key"], 
  pred: "keys-all"
});
```

## Error Handling

Services return structured error information:

```typescript
try {
  const result = await coinService.transfer(options);
  console.log("Success:", result);
} catch (error) {
  console.error("Transfer failed:", error.message);
}

// Namespace service returns structured results
const result = await namespaceService.createPrincipalNamespace(options);
if (result.status === "error") {
  console.error("Namespace creation failed:", result.error);
} else {
  console.log("Namespace created:", result.namespace);
}
```

## TypeScript Support

This package provides full TypeScript support with comprehensive type definitions for all operations, ensuring type safety and excellent developer experience.

```typescript
import type { 
  CoinServiceConfig,
  TransferOptions,
  MarmaladeServiceConfig,
  CreateTokenOptions,
  NamespaceServiceConfig,
  CreatePrincipalNamespaceOptions
} from '@pact-toolbox/kda';
```

## Contributing

This package is part of the [pact-toolbox](https://github.com/kadena-community/pact-toolbox) monorepo. Please refer to the main repository for contribution guidelines.

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)