import type { Encoder } from "../codecs/core";
import type { ReadonlyUint8Array } from "../codecs/types";
import { assertSigningCapabilityIsAvailable, assertVerificationCapabilityIsAvailable } from "../assertions";
import { getBase16Encoder } from "../codecs/strings/base16";

export type Signature = string & { readonly __brand: unique symbol };
export type SignatureBytes = Uint8Array & { readonly __brand: unique symbol };

let base16Encoder: Encoder<string> | undefined;

export function assertIsSignature(putativeSignature: string): asserts putativeSignature is Signature {
  if (!base16Encoder) base16Encoder = getBase16Encoder();
  // Fast-path; see if the input string is of an acceptable length.
  if (
    // Lowest value (64 bytes of zeroes)
    putativeSignature.length < 64 ||
    // Highest value (64 bytes of 255)
    putativeSignature.length > 88
  ) {
    throw new Error(`Invalid signature length: ${putativeSignature.length} out of range`);
  }
  // Slow-path; actually attempt to decode the input string.
  const bytes = base16Encoder.encode(putativeSignature);
  const numBytes = bytes.byteLength;
  if (numBytes !== 64) {
    throw new Error(`Invalid signature length: ${numBytes} bytes`);
  }
}

export function isSignature(putativeSignature: string): putativeSignature is Signature {
  if (!base16Encoder) base16Encoder = getBase16Encoder();

  // Fast-path; see if the input string is of an acceptable length.
  if (
    // Lowest value (64 bytes of zeroes)
    putativeSignature.length < 64 ||
    // Highest value (64 bytes of 255)
    putativeSignature.length > 88
  ) {
    return false;
  }
  // Slow-path; actually attempt to decode the input string.
  const bytes = base16Encoder.encode(putativeSignature);
  const numBytes = bytes.byteLength;
  if (numBytes !== 64) {
    return false;
  }
  return true;
}

export async function signBytes(key: CryptoKey, data: ReadonlyUint8Array): Promise<SignatureBytes> {
  assertSigningCapabilityIsAvailable();
  const signedData = await crypto.subtle.sign("Ed25519", key, data);
  return new Uint8Array(signedData) as SignatureBytes;
}

export function signature(putativeSignature: string): Signature {
  assertIsSignature(putativeSignature);
  return putativeSignature;
}

export async function verifySignature(
  key: CryptoKey,
  signature: SignatureBytes,
  data: ReadonlyUint8Array | Uint8Array,
): Promise<boolean> {
  assertVerificationCapabilityIsAvailable();
  return await crypto.subtle.verify("Ed25519", key, signature, data);
}
