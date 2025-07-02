# Dependency Analysis Report for pact-toolbox Monorepo

## Summary

The pact-toolbox monorepo contains 39 packages, with several critical cyclic dependencies that need to be addressed.

## Critical Cyclic Dependencies Found

### 1. Context ↔ Wallet Adapters ↔ Dev Wallet Cycle
```
@pact-toolbox/context 
  → @pact-toolbox/wallet-adapters 
  → @pact-toolbox/dev-wallet 
  → @pact-toolbox/context
```

**Problem**: The context package depends on wallet-adapters, which depends on dev-wallet, which then depends back on context. This creates a circular dependency that makes it impossible to build these packages in isolation.

**Suggested Fix**: 
- Extract shared interfaces/types to a separate `@pact-toolbox/wallet-types` package
- Make context depend only on the types package, not the implementations
- Have wallet implementations (dev-wallet) depend on context, not the other way around

### 2. Transaction ↔ Context ↔ Wallet Cycle
```
@pact-toolbox/transaction 
  → @pact-toolbox/context 
  → @pact-toolbox/wallet-adapters 
  → @pact-toolbox/dev-wallet 
  → @pact-toolbox/kda 
  → @pact-toolbox/transaction
```

**Problem**: Transaction depends on context, which through the wallet dependency chain eventually depends back on transaction.

**Suggested Fix**:
- Remove the direct dependency of transaction on context
- Use dependency injection or events for context-transaction communication
- Consider if transaction really needs to know about the full context

### 3. Wallet UI ↔ Wallet Adapters Cycle
```
@pact-toolbox/wallet-ui 
  → @pact-toolbox/wallet-adapters 
  → @pact-toolbox/dev-wallet 
  → @pact-toolbox/kda 
  → @pact-toolbox/transaction 
  → @pact-toolbox/wallet-ui
```

**Problem**: Wallet UI depends on wallet-adapters, which through the chain eventually depends back on wallet-ui.

**Suggested Fix**:
- Transaction should not depend on wallet-ui directly
- UI components should be separate from core wallet logic
- Consider using peer dependencies for UI components

### 4. Runtime ↔ Context Cycle (through multiple paths)
```
@pact-toolbox/runtime 
  → @pact-toolbox/context 
  → @pact-toolbox/wallet-adapters 
  → ... 
  → @pact-toolbox/network 
  → @pact-toolbox/prelude 
  → @pact-toolbox/runtime
```

**Problem**: Runtime and context are interdependent through multiple paths.

**Suggested Fix**:
- Runtime should not depend on context directly
- Extract shared runtime interfaces to a separate package
- Use dependency injection for runtime services

### 5. Test ↔ Wallet Adapters Cycle
```
@pact-toolbox/test 
  → @pact-toolbox/wallet-adapters 
  → @pact-toolbox/dev-wallet 
  → @pact-toolbox/kda 
  → @pact-toolbox/test
```

**Problem**: Test framework depends on wallet-adapters, but KDA service depends on test framework.

**Suggested Fix**:
- KDA should not have test as a runtime dependency (only devDependency)
- Extract test utilities that KDA needs into a separate package

## Architectural Concerns

### Packages with Too Many Dependencies (>5)

1. **@pact-toolbox/transaction** (14 dependencies)
   - Depends on almost every major package in the system
   - Should be split into smaller, focused packages

2. **@pact-toolbox/kda** (13 dependencies)
   - Service layer has too many dependencies
   - Consider splitting into separate services (coin, marmalade, namespace)

3. **@pact-toolbox/script** (13 dependencies)
   - High-level orchestration package with many dependencies
   - This might be acceptable for a CLI/script runner

4. **@pact-toolbox/test** (12 dependencies)
   - Test framework depending on too many implementation details
   - Should depend on interfaces, not implementations

5. **@pact-toolbox/context** (11 dependencies)
   - Context is doing too much - managing wallets, network, and more
   - Should be split into focused context providers

### Core Package Issues

- **@pact-toolbox/crypto** has 5 dependencies (should have 0-1)
- **@pact-toolbox/chainweb-client** has 3 dependencies (acceptable but could be reduced)
- **@pact-toolbox/types** has 3 dependencies (should have 0)

Core packages should have minimal dependencies to maintain stability.

### Most Depended Upon Packages

Good architectural patterns:
- Build tools (tsconfig, tsdown, prettier-config, vitest-config) are widely used
- Types package is widely used (good for type safety)
- Utils package is widely used (common utilities)

## Recommended Refactoring Strategy

### Phase 1: Break Circular Dependencies
1. **Create @pact-toolbox/wallet-types package**
   - Extract all wallet interfaces and types
   - No implementation dependencies

2. **Create @pact-toolbox/context-types package**
   - Extract context interfaces
   - No implementation dependencies

3. **Fix KDA test dependency**
   - Move test to devDependencies only

### Phase 2: Reduce Core Package Dependencies
1. **Refactor @pact-toolbox/crypto**
   - Remove all dependencies except types
   - Move test utilities to separate package

2. **Refactor @pact-toolbox/types**
   - Should have zero dependencies
   - Move any logic to utils package

### Phase 3: Split Large Packages
1. **Split @pact-toolbox/transaction**
   - Create transaction-builder (core logic)
   - Create transaction-dispatcher (network logic)
   - Create transaction-wallet (wallet integration)

2. **Split @pact-toolbox/kda**
   - Create kda-coin
   - Create kda-marmalade
   - Create kda-namespace

3. **Split @pact-toolbox/context**
   - Create context-core
   - Create context-wallet
   - Create context-network

### Phase 4: Establish Clear Layer Boundaries
```
Layer 1 (Zero deps): types, crypto-core
Layer 2 (Layer 1 only): utils, signers, wallet-core
Layer 3 (Layer 1-2): chainweb-client, transaction-core
Layer 4 (Layer 1-3): Services (kda-*, context-*)
Layer 5 (All layers): Apps, CLI, Tests
```

## Benefits of Refactoring

1. **Faster builds**: Packages can be built in parallel without circular dependencies
2. **Better testability**: Packages can be tested in isolation
3. **Clearer architecture**: Each package has a single responsibility
4. **Easier maintenance**: Changes in one package don't cascade unnecessarily
5. **Better tree-shaking**: Applications can import only what they need

## Implementation Priority

1. **High Priority** (Blocking issues):
   - Fix context ↔ wallet-adapters cycle
   - Fix transaction ↔ context cycle
   - Remove test from KDA runtime dependencies

2. **Medium Priority** (Architecture improvement):
   - Reduce crypto package dependencies
   - Split transaction package
   - Create type-only packages

3. **Low Priority** (Nice to have):
   - Split KDA services
   - Further optimize dependency graph
   - Create more granular packages