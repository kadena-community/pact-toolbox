import type { SigningConfig } from "./wallet-manager";

/**
 * Common CLI argument aliases for wallet configuration
 */
export const WALLET_CLI_ALIASES = {
  privateKey: ["privateKey", "private-key", "key", "k"],
  publicKey: ["publicKey", "public-key", "pub", "p"],
  account: ["account", "from", "sender", "a"],
  wallet: ["wallet", "wallet-type", "walletType", "w"],
  interactive: ["interactive", "i"],
  skipWallet: ["skipWallet", "skip-wallet", "no-wallet", "read-only"],
  privateKeyEnv: ["privateKeyEnv", "private-key-env", "key-env"],
  accountEnv: ["accountEnv", "account-env"],
} as const;

/**
 * Parse CLI arguments for wallet configuration
 * Handles various common formats and aliases
 */
export function parseWalletArgs(args: Record<string, unknown>): Partial<SigningConfig> {
  const result: Partial<SigningConfig> = {};

  // Helper to find value by aliases
  const findValue = (aliases: readonly string[]): unknown => {
    for (const alias of aliases) {
      if (args[alias] !== undefined) {
        return args[alias];
      }
    }
    return undefined;
  };

  // Parse each wallet configuration option
  const privateKey = findValue(WALLET_CLI_ALIASES.privateKey);
  if (privateKey) {
    result.privateKey = String(privateKey);
  }

  const publicKey = findValue(WALLET_CLI_ALIASES.publicKey);
  if (publicKey) {
    result.publicKey = String(publicKey);
  }

  const account = findValue(WALLET_CLI_ALIASES.account);
  if (account) {
    result.account = String(account);
  }

  const wallet = findValue(WALLET_CLI_ALIASES.wallet);
  if (wallet) {
    result.walletType = String(wallet) as SigningConfig["walletType"];
  }

  const interactive = findValue(WALLET_CLI_ALIASES.interactive);
  if (interactive !== undefined) {
    result.interactive = Boolean(interactive);
  }

  const skipWallet = findValue(WALLET_CLI_ALIASES.skipWallet);
  if (skipWallet !== undefined) {
    result.skipWallet = Boolean(skipWallet);
  }

  const privateKeyEnv = findValue(WALLET_CLI_ALIASES.privateKeyEnv);
  if (privateKeyEnv) {
    result.privateKeyEnv = String(privateKeyEnv);
  }

  const accountEnv = findValue(WALLET_CLI_ALIASES.accountEnv);
  if (accountEnv) {
    result.accountEnv = String(accountEnv);
  }

  return result;
}

/**
 * Extract wallet arguments from mixed CLI arguments
 * Separates wallet-specific args from script args
 */
export function extractWalletArgs(args: Record<string, unknown>): {
  walletArgs: Partial<SigningConfig>;
  scriptArgs: Record<string, unknown>;
} {
  const walletArgs = parseWalletArgs(args);
  const scriptArgs: Record<string, unknown> = {};

  // All wallet-related keys to exclude from script args
  const walletKeys = new Set<string>(Object.values(WALLET_CLI_ALIASES).flat() as string[]);

  // Copy non-wallet args to script args
  for (const [key, value] of Object.entries(args)) {
    if (!walletKeys.has(key)) {
      scriptArgs[key] = value;
    }
  }

  return { walletArgs, scriptArgs };
}

/**
 * Build wallet help text for CLI
 */
export function getWalletHelpText(): string {
  return `
Wallet Options:
  -k, --key <privateKey>          Private key (64-char hex)
  -p, --pub <publicKey>           Public key (64-char hex, for read-only)
  -a, --account <account>         Account name (e.g., k:abc123... or sender00)
  -w, --wallet <type>             Wallet type (keypair, zelcore, chainweaver)
  -i, --interactive               Interactive wallet setup
  --skip-wallet                   Skip wallet (read-only mode)
  --private-key-env <name>        Env var for private key (default: PACT_PRIVATE_KEY)
  --account-env <name>            Env var for account (default: PACT_ACCOUNT)

Environment Variables:
  PACT_PRIVATE_KEY                Private key for signing
  PACT_ACCOUNT                    Account name

Examples:
  # Use private key directly
  pact-toolbox script deploy.ts -k 251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898

  # Use environment variables
  export PACT_PRIVATE_KEY=251a920c...
  pact-toolbox script deploy.ts

  # Read-only mode with public key
  pact-toolbox script info.ts -p 6be2f485a7af75fedb4b7f153a903f7e6000ca4aa501179c91a2450b777bd2a7

  # Interactive setup
  pact-toolbox script deploy.ts -i
`.trim();
}