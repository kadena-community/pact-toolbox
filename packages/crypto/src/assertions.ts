import crypto from "uncrypto";

import type { ReadonlyUint8Array } from "./codecs/types";

function assertIsSecureContext() {
  if (!__NODEJS__ && __BROWSER__ && !globalThis.isSecureContext) {
    throw new Error("Must be in a secure context (HTTPS, localhost, file://)");
  }
}

let cachedEd25519Decision: PromiseLike<boolean> | boolean | undefined;
async function isEd25519CurveSupported(subtle: SubtleCrypto): Promise<boolean> {
  if (cachedEd25519Decision === undefined) {
    cachedEd25519Decision = new Promise((resolve) => {
      subtle
        .generateKey("Ed25519", /* extractable */ false, ["sign", "verify"])
        .catch(() => {
          resolve((cachedEd25519Decision = false));
        })
        .then(() => {
          resolve((cachedEd25519Decision = true));
        });
    });
  }
  if (typeof cachedEd25519Decision === "boolean") {
    return cachedEd25519Decision;
  } else {
    return await cachedEd25519Decision;
  }
}

export function assertDigestCapabilityIsAvailable(): void {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.digest !== "function") {
    throw new Error("SubtleCrypto.digest is not available");
  }
}

export async function assertKeyGenerationIsAvailable(): Promise<void> {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.generateKey !== "function") {
    throw new Error("SubtleCrypto.generateKey is not available");
  }
  if (!(await isEd25519CurveSupported(crypto.subtle))) {
    throw new Error("Ed25519 curve is not supported");
  }
}

export function assertKeyExporterIsAvailable(): void {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.exportKey !== "function") {
    throw new Error("SubtleCrypto.exportKey is not available");
  }
}

export function assertSigningCapabilityIsAvailable(): void {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.sign !== "function") {
    throw new Error("SubtleCrypto.sign is not available");
  }
}

export function assertVerificationCapabilityIsAvailable(): void {
  assertIsSecureContext();
  if (typeof crypto === "undefined" || typeof crypto.subtle?.verify !== "function") {
    throw new Error("SubtleCrypto.verify is not available");
  }
}

export function assertPRNGIsAvailable(): void {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Crypto.getRandomValues is not available");
  }
}

/**
 * Asserts that a given byte array is not empty.
 */
export function assertByteArrayIsNotEmptyForCodec(
  codecDescription: string,
  bytes: ReadonlyUint8Array | Uint8Array,
  offset = 0,
): void {
  if (bytes.length - offset <= 0) {
    throw new Error(`Empty byte array for ${codecDescription}`);
  }
}

/**
 * Asserts that a given byte array has enough bytes to decode.
 */
export function assertByteArrayHasEnoughBytesForCodec(
  codecDescription: string,
  expected: number,
  bytes: ReadonlyUint8Array | Uint8Array,
  offset = 0,
): void {
  const bytesLength = bytes.length - offset;
  if (bytesLength < expected) {
    throw new Error(`Not enough bytes to decode ${codecDescription}. Expected: ${expected}, Actual: ${bytesLength}`);
  }
}

/**
 * Asserts that a given offset is within the byte array bounds.
 * This range is between 0 and the byte array length and is inclusive.
 * An offset equals to the byte array length is considered a valid offset
 * as it allows the post-offset of codecs to signal the end of the byte array.
 */
export function assertByteArrayOffsetIsNotOutOfRange(
  codecDescription: string,
  offset: number,
  bytesLength: number,
): void {
  if (offset < 0 || offset > bytesLength) {
    throw new Error(`Offset is out of range for ${codecDescription}: ${offset}`);
  }
}

/**
 * Asserts that a given string matches a given alphabet.
 */
export function assertValidBaseString(alphabet: string, testValue: string, givenValue: string = testValue): void {
  if (!testValue.match(new RegExp(`^[${alphabet}]*$`))) {
    throw new Error(`Invalid base${alphabet.length} string: ${givenValue}`);
  }
}
