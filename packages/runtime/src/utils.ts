import type { KeyPair } from "@pact-toolbox/types";

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

export function isValidateSigner(signer: Partial<KeyPair>): signer is KeyPair {
  if (!signer.publicKey || !signer.secretKey) {
    return false;
  }
  return true;
}

export function isKeyPair(signer: unknown): signer is KeyPair {
  if (typeof signer === "object" && signer !== null && "publicKey" in signer && "secretKey" in signer) {
    return true;
  }
  return false;
}
