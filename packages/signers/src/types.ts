import type { Address, SignatureBytes } from "@pact-toolbox/crypto";
import type { PactCommand, PartiallySignedTransaction } from "@pact-toolbox/types";

// Core types for signature handling
export type SignatureDictionary = Readonly<Record<Address, SignatureBytes>>;

// Message types for arbitrary data signing
export type SignableMessage = Readonly<{
  content: Uint8Array;
  signatures: SignatureDictionary;
}>;

// Configuration types
export type SignerConfig = Readonly<{
  abortSignal?: AbortSignal;
}>;

// Main signer interface - simplified to focus on Kadena ecosystem needs
export interface Signer<TAddress extends string = string> {
  readonly address: Address<TAddress>;
  readonly keyPair?: CryptoKeyPair; // Optional for external signers (wallets)

  // Core Kadena functionality - sign Pact commands
  signPactCommands(commands: PactCommand[], config?: SignerConfig): Promise<PartiallySignedTransaction[]>;

  // Optional message signing for arbitrary data
  signMessages?(messages: readonly SignableMessage[], config?: SignerConfig): Promise<readonly SignatureDictionary[]>;
}

// Type assertion utility
export function assertIsSigner<TAddress extends string>(value: unknown): asserts value is Signer<TAddress> {
  if (
    typeof value !== "object" ||
    value === null ||
    !("address" in value) ||
    !("signPactCommands" in value) ||
    typeof (value as any).signPactCommands !== "function"
  ) {
    throw new Error("Value is not a Signer");
  }
}
