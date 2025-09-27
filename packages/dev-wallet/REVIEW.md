# Dev Wallet Code Review & Refactoring Plan

## Executive Summary

After a thorough review of the `packages/dev-wallet` codebase, I've identified several areas for improvement. While the overall architecture is solid, there are opportunities to enhance code quality, security, and maintainability by following SolidJS best practices and modern web development patterns.

## Critical Issues Found

### 1. **Security & Crypto Wallet Architecture**

#### Issues:
- **Private keys stored in plain text in memory**: `wallet.ts:22` stores unencrypted private key in class property
- **Insufficient key derivation**: No support for HD wallets (BIP32/BIP39)
- **Weak encryption implementation**: Using basic encryption without key stretching
- **No secure session management**: Session password stored in plain text in memory
- **Missing security headers**: No CSP or other security headers for wallet UI

#### Recommendations:
- Implement proper key derivation with PBKDF2/Argon2
- Use Web Crypto API for all cryptographic operations
- Implement secure session management with time-based clearing
- Add security headers and CSP policies
- Consider using secure enclave/hardware security where available

### 2. **SolidJS Anti-Patterns**

#### Issues:
- **Improper event handling**: Using imperative event emitters instead of reactive patterns
- **Store mutations outside produce**: Direct state modifications in some places
- **Missing memo optimization**: No memoization for expensive computations
- **Inefficient Show/For usage**: Not using keyed For loops for lists
- **Component prop drilling**: Passing props through multiple levels unnecessarily

#### Recommendations:
- Replace EventEmitter with createSignal/createEffect patterns
- Always use produce for store mutations
- Add createMemo for derived state
- Use keyed For loops with proper track functions
- Implement context providers for shared state

### 3. **Code Smells & Workarounds**

#### Issues:
- **Manager class with DOM manipulation**: `manager.tsx` directly manipulates DOM (anti-pattern)
- **Hardcoded timeouts**: Multiple `setTimeout` calls with magic numbers
- **Circular dependencies**: wallet.ts imports from stores which import from wallet
- **Mixed responsibilities**: Wallet class handles UI, storage, and crypto operations
- **Global state pollution**: Using window/globalThis for context passing
- **Inconsistent error handling**: Mix of try-catch and promise rejections

#### Recommendations:
- Remove DOM manipulation, use reactive rendering
- Replace timeouts with proper reactive state management
- Refactor to eliminate circular dependencies
- Apply Single Responsibility Principle
- Use proper dependency injection
- Implement consistent error boundary pattern

### 4. **TypeScript Issues**

#### Issues:
- **Duplicate type definitions**: Account type defined multiple times
- **Any types**: Several `any` types throughout the codebase
- **Missing strict null checks**: Optional properties not properly handled
- **Type assertions**: Unnecessary type assertions and non-null assertions

#### Recommendations:
- Consolidate type definitions
- Replace all `any` with proper types
- Enable strict TypeScript checks
- Remove unnecessary assertions

### 5. **Framework Integration Issues**

#### Issues:
- **UI coupling**: Wallet core logic tightly coupled with UI
- **Browser-specific code**: No proper isomorphic handling
- **Manager pattern complexity**: Overcomplicated manager for simple mounting
- **Missing framework adapters**: No easy integration for React/Vue/Angular

#### Recommendations:
- Separate core wallet logic from UI
- Implement proper SSR/browser detection
- Simplify manager to just mounting logic
- Create framework-specific adapters

## Refactoring Plan

### Phase 1: Security Hardening (Priority: Critical)
1. Implement secure key storage with Web Crypto API
2. Add proper key derivation (PBKDF2 with salt)
3. Implement secure session management
4. Add CSP headers and security policies
5. Audit and fix all crypto operations

### Phase 2: Core Architecture Refactoring (Priority: High)
1. Separate wallet core from UI logic
2. Create proper abstraction layers:
   - `wallet-core.ts` - Pure wallet logic
   - `wallet-ui.ts` - UI integration
   - `wallet-storage.ts` - Storage operations
3. Eliminate circular dependencies
4. Implement dependency injection pattern
5. Create proper error boundaries

### Phase 3: SolidJS Best Practices (Priority: High)
1. Replace EventEmitter with reactive patterns
2. Implement proper store patterns with produce
3. Add memoization for expensive operations
4. Fix component prop drilling with context
5. Optimize rendering with proper keyed loops

### Phase 4: TypeScript Improvements (Priority: Medium)
1. Enable strict TypeScript checks
2. Remove all `any` types
3. Consolidate duplicate type definitions
4. Add proper type guards and validators
5. Implement branded types for sensitive data

### Phase 5: Framework Integration (Priority: Medium)
1. Create framework-agnostic core
2. Implement React adapter
3. Implement Vue adapter
4. Simplify manager pattern
5. Add proper SSR support

### Phase 6: Code Quality (Priority: Low)
1. Remove all magic numbers
2. Add proper logging with levels
3. Implement feature flags
4. Add comprehensive error messages
5. Create proper documentation

## Implementation Priority

### Immediate Actions (Do First):
1. Fix private key storage security issue
2. Remove DOM manipulation from manager
3. Fix circular dependencies
4. Replace EventEmitter with reactive patterns

### Short Term (Next Sprint):
1. Implement proper crypto operations
2. Separate core from UI logic
3. Fix TypeScript issues
4. Add security headers

### Long Term (Future Sprints):
1. Create framework adapters
2. Implement HD wallet support
3. Add comprehensive testing
4. Create documentation

## Code Examples of Improvements

### 1. Reactive Pattern Instead of EventEmitter
```typescript
// Before (current)
walletEventEmitter.emit('account-selected', account);

// After (improved)
const [selectedAccount, setSelectedAccount] = createSignal<Account>();
const selectAccount = (account: Account) => setSelectedAccount(account);
```

### 2. Proper Store Mutations
```typescript
// Before (current)
walletState.accounts.push(newAccount);

// After (improved)
setWalletState(produce(state => {
  state.accounts.push(newAccount);
}));
```

### 3. Secure Key Storage
```typescript
// Before (current)
private keyPairSigner: KeyPairSigner | null = null;

// After (improved)
private async getSecureKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    await this.deriveKey(),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}
```

### 4. Proper Component Architecture
```typescript
// Before (mixed concerns)
export class DevWallet extends BaseWallet {
  private modalManager?: ModalManager;
  // ... mixing UI and logic
}

// After (separated)
export class WalletCore {
  // Pure wallet logic
}

export class WalletUI {
  constructor(private core: WalletCore) {}
  // UI-specific logic
}
```

## Conclusion

The dev-wallet codebase has a solid foundation but requires significant refactoring to meet best practices for security, SolidJS patterns, and TypeScript. The most critical issues are around security (private key handling) and architectural concerns (separation of concerns, circular dependencies). These should be addressed immediately.

The refactoring should be done incrementally, starting with the most critical security issues, then moving to architectural improvements, and finally addressing code quality issues.