import { Signer } from "@pact-toolbox/client-utils";

export function getSignerFromEnvVars(prefix: string = "PACT_TOOLBOX"): Partial<Signer> {
  const publicKey = process.env[`${prefix}_PUBLIC_KEY`];
  const secretKey = process.env[`${prefix}_SECRET_KEY`];

  return {
    publicKey,
    secretKey,
    account: `k:${publicKey}`,
  };
}

export function getSignerFromArgs(args: Record<string, unknown>): Partial<Signer> {
  const publicKey = args.publicKey as string;
  const secretKey = args.secretKey as string;

  return {
    publicKey,
    secretKey,
    account: `k:${publicKey}`,
  };
}

export function getSignerFromEnv(args: Record<string, unknown> = {}, prefix: string = "PACT_TOOLBOX"): Partial<Signer> {
  const signerFromEnv = getSignerFromEnvVars(prefix);
  const signerFromArgs = getSignerFromArgs(args);

  return {
    ...signerFromEnv,
    ...signerFromArgs,
  };
}

export function isValidateSigner(signer: Partial<Signer>): signer is Signer {
  if (!signer.publicKey || !signer.secretKey) {
    return false;
  }
  return true;
}
