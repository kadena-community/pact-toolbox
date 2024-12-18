import type { Address, SignatureBytes } from "@pact-toolbox/crypto";

export type SignatureDictionary = Readonly<Record<Address, SignatureBytes>>;

export type BaseSignerConfig = Readonly<{
  abortSignal?: AbortSignal;
}>;

export interface BaseTransactionSignerConfig extends BaseSignerConfig {}
