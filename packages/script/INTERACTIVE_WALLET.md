# Interactive Wallet Configuration

The `@pact-toolbox/script` package now provides comprehensive interactive wallet setup with support for multiple wallet adapters.

## Features

### ✅ **Full Interactive Mode**
When running scripts with `-i` or `--interactive` flag, users can:
1. Choose wallet type (Keypair, Generate New, Zelcore, Chainweaver)
2. Input credentials securely
3. Save generated keys to file
4. Configure account names

### ✅ **Multiple Wallet Adapters**

#### 1. **Keypair Wallet** (Default)
- Direct private key management
- Instant transaction signing
- No external dependencies
- Options:
  - Paste private key directly
  - Load from environment variable
  - Generate new keypair

#### 2. **Zelcore Desktop Wallet**
- Integrates with Zelcore desktop app
- Multi-account support
- Hardware wallet compatible
- Requires Zelcore running on port 9467

#### 3. **Chainweaver Legacy Wallet**
- Official Kadena wallet integration
- Desktop app integration
- Transaction approval in app
- Requires Chainweaver running on port 9467

### ✅ **Flexible CLI Arguments**
```bash
# Private key
-k, --key, --private-key, --privateKey

# Public key (read-only)
-p, --pub, --public-key, --publicKey

# Account
-a, --account, --from, --sender

# Wallet type
-w, --wallet, --wallet-type, --walletType

# Interactive mode
-i, --interactive

# Skip wallet
--skip-wallet, --no-wallet, --read-only
```

## Usage Examples

### Interactive Setup
```bash
# Enter interactive mode
pact-toolbox script deploy.ts -i

# You'll be prompted to:
# 1. Select wallet type
# 2. Enter credentials
# 3. Configure account
```

### Direct Private Key
```bash
# Via argument
pact-toolbox script deploy.ts -k YOUR_PRIVATE_KEY

# Via environment
export PACT_PRIVATE_KEY=YOUR_KEY
pact-toolbox script deploy.ts

# Custom env var
pact-toolbox script deploy.ts --private-key-env MY_KEY_VAR
```

### Generate New Keypair
```bash
# Interactive generation
pact-toolbox script deploy.ts -i
# Select "Generate New Keypair"

# The script will:
# 1. Generate Ed25519 keypair
# 2. Display public/private keys
# 3. Optionally save to file
# 4. Configure account name
```

### Desktop Wallets
```bash
# Zelcore
pact-toolbox script deploy.ts --wallet zelcore

# Chainweaver
pact-toolbox script deploy.ts --wallet chainweaver-legacy
```

### Read-Only Mode
```bash
# With public key only
pact-toolbox script deploy.ts -p YOUR_PUBLIC_KEY

# Skip wallet entirely
pact-toolbox script query.ts --skip-wallet
```

## Script Context

Scripts receive the configured wallet through context:

```typescript
export default createScript({
  async run(ctx) {
    const { wallet, currentSigner, coin } = ctx;

    // Check wallet availability
    if (wallet.getWallet()) {
      // Full wallet - can sign
      const account = await wallet.getWallet().getAccount();
      console.log("Wallet:", account.address);
    }

    // Check signer
    if (currentSigner) {
      console.log("Signer:", currentSigner.account);
      console.log("Public Key:", currentSigner.publicKey);
    }
  }
});
```

## Testing

Use the provided test scripts:

```bash
# Test wallet configuration
pact-toolbox script wallet-test.ts -i

# Test interactive setup
pact-toolbox script interactive-wallet-test.ts -i

# Test with different wallets
pact-toolbox script wallet-test.ts -k YOUR_KEY
pact-toolbox script wallet-test.ts --wallet zelcore
pact-toolbox script wallet-test.ts --wallet chainweaver-legacy
```

## Architecture

The wallet manager:
1. **Checks CLI arguments** first (highest priority)
2. **Checks environment variables** if no CLI args
3. **Uses network config** from pact-toolbox.config.ts
4. **Enters interactive mode** if no credentials found
5. **Connects to desktop wallets** when specified

## Security

- Private keys are never logged or displayed unless explicitly requested
- Generated keys can be saved to file with warnings
- Desktop wallets manage their own key security
- Read-only mode available for queries

## Why No @pact-toolbox/wallet-manager?

The script package's `WalletManager` class directly:
- Constructs wallet adapters based on configuration
- Handles all wallet initialization logic
- Manages signing and account selection
- Provides a unified interface for all wallet types

This eliminates the need for the separate `@pact-toolbox/wallet-manager` package, keeping the dependency tree lean and giving scripts full control over wallet configuration.