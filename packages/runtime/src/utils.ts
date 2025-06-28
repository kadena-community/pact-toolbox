import type { KeyPair } from "@pact-toolbox/types";

/**
 * Retrieves signer credentials from environment variables.
 * Looks for PUBLIC_KEY and SECRET_KEY with the specified prefix.
 * @param prefix - The environment variable prefix (default: "PACT_TOOLBOX")
 * @returns Partial KeyPair with available credentials, or undefined if none found
 * @example
 * ```typescript
 * // Looks for PACT_TOOLBOX_PUBLIC_KEY and PACT_TOOLBOX_SECRET_KEY
 * const signer = getSignerFromEnvVars();
 * 
 * // Looks for DEVNET_PUBLIC_KEY and DEVNET_SECRET_KEY
 * const devnetSigner = getSignerFromEnvVars('DEVNET');
 * ```
 */
export function getSignerFromEnvVars(prefix: string = "PACT_TOOLBOX"): Partial<KeyPair> | undefined {
  const publicKey = process.env[`${prefix}_PUBLIC_KEY`];
  const secretKey = process.env[`${prefix}_SECRET_KEY`];
  if (publicKey || secretKey) {
    return {
      publicKey,
      secretKey,
      account: publicKey ? `k:${publicKey}` : undefined,
    };
  }
  return undefined;
}

/**
 * Type guard to check if a partial KeyPair has all required fields.
 * @param signer - The signer object to validate
 * @returns True if signer has both publicKey and secretKey
 * @example
 * ```typescript
 * const signer = getSignerFromEnvVars();
 * if (signer && isValidateSigner(signer)) {
 *   // signer is now typed as KeyPair
 *   console.log('Valid signer:', signer.publicKey);
 * }
 * ```
 */
export function isValidateSigner(signer: Partial<KeyPair>): signer is KeyPair {
  if (!signer.publicKey || !signer.secretKey) {
    return false;
  }
  return true;
}

/**
 * Type guard to check if an unknown value is a KeyPair.
 * @param signer - The value to check
 * @returns True if the value is a KeyPair object
 * @example
 * ```typescript
 * function processSigner(signer: unknown) {
 *   if (isKeyPair(signer)) {
 *     // signer is now typed as KeyPair
 *     return signer.publicKey;
 *   }
 *   throw new Error('Invalid signer');
 * }
 * ```
 */
export function isKeyPair(signer: unknown): signer is KeyPair {
  if (typeof signer === "object" && signer !== null && "publicKey" in signer && "secretKey" in signer) {
    return true;
  }
  return false;
}
