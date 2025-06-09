import type { FixedSizeCodec, FixedSizeDecoder, FixedSizeEncoder } from "./codecs/core";
import { assertKeyExporterIsAvailable } from "./assertions";
import { combineCodec, fixDecoderSize, fixEncoderSize, transformEncoder } from "./codecs/core";
import { base16 } from "./codecs/strings/base16";
import { generateExtractableKeyPair } from "./keys/keys";

export type Address<TAddress extends string = string> = TAddress & {
  readonly __brand: unique symbol;
};

export function isAddress(putativeAddress: string): putativeAddress is Address<typeof putativeAddress> {
  // Fast-path; see if the input string is of an acceptable length.
  if (
    // Lowest address (32 bytes of zeroes)
    putativeAddress.length < 32 ||
    // Highest address (32 bytes of 255)
    putativeAddress.length > 44
  ) {
    return false;
  }
  // Slow-path; actually attempt to decode the input string.

  const bytes = base16.encode(putativeAddress);
  const numBytes = bytes.byteLength;
  if (numBytes !== 32) {
    return false;
  }
  return true;
}

export function assertIsAddress(putativeAddress: string): asserts putativeAddress is Address<typeof putativeAddress> {
  // Fast-path; see if the input string is of an acceptable length.
  if (
    // Lowest address (32 bytes of zeroes)
    putativeAddress.length < 32 ||
    // Highest address (32 bytes of 255)
    putativeAddress.length > 44
  ) {
    throw new Error(`Invalid address length: ${putativeAddress.length} out of range`);
  }
  // Slow-path; actually attempt to decode the input string.
  const bytes = base16.encode(putativeAddress);
  const numBytes = bytes.byteLength;
  if (numBytes !== 32) {
    throw new Error(`Invalid address length: ${numBytes} bytes`);
  }
}

export function address<TAddress extends string = string>(putativeAddress: TAddress): Address<TAddress> {
  assertIsAddress(putativeAddress);
  return putativeAddress as Address<TAddress>;
}

let addressEncoder: FixedSizeEncoder<Address, 32> | undefined;
let addressDecoder: FixedSizeDecoder<Address, 32> | undefined;
let addressCodec: FixedSizeCodec<Address, Address, 32> | undefined;
export function getAddressEncoder(): FixedSizeEncoder<Address, 32> {
  return (addressEncoder ??= transformEncoder(fixEncoderSize(base16, 32), (putativeAddress) =>
    address(putativeAddress),
  ));
}

export function getAddressDecoder(): FixedSizeDecoder<Address, 32> {
  return (addressDecoder ??= fixDecoderSize(base16, 32) as FixedSizeDecoder<Address, 32>);
}

export function getAddressCodec(): FixedSizeCodec<Address, Address, 32> {
  return (addressCodec ??= combineCodec(getAddressEncoder(), getAddressDecoder()));
}

export function getAddressComparator(): (x: string, y: string) => number {
  return new Intl.Collator("en", {
    caseFirst: "lower",
    ignorePunctuation: false,
    localeMatcher: "best fit",
    numeric: false,
    sensitivity: "variant",
    usage: "sort",
  }).compare;
}

export async function exportBase16Key(key: CryptoKey): Promise<string> {
  assertKeyExporterIsAvailable();
  if (!key.extractable || key.algorithm.name !== "Ed25519") {
    throw new Error(`Key is not extractable or has an invalid algorithm: ${key.algorithm.name}`);
  }
  const keyBytes = await crypto.subtle.exportKey("raw", key);
  return getAddressDecoder().decode(new Uint8Array(keyBytes));
}

export type KAccount = `k:${Address<string>}` & {
  readonly __brand: unique symbol;
};

export function isKAccount(putativeAccount: string): putativeAccount is KAccount {
  return putativeAccount.startsWith("k:") && isAddress(putativeAccount.slice(2));
}

export function assertIsKAccount(putativeAccount: string): asserts putativeAccount is KAccount {
  if (!isKAccount(putativeAccount)) {
    throw new Error(`Invalid account: ${putativeAccount}`);
  }
}

export function kAccount(putativeAccount: string): KAccount {
  assertIsKAccount(putativeAccount);
  return putativeAccount as KAccount;
}

export async function getKAccountFromPublicKey(publicKey: CryptoKey): Promise<KAccount> {
  const address = await exportBase16Key(publicKey);
  return kAccount(`k:${address}`);
}

interface KeyPair {
  publicKey: string;
  privateKey: string;
}
export async function genKeyPair(): Promise<KeyPair> {
  const keyPair = await generateExtractableKeyPair();
  return {
    publicKey: await exportBase16Key(keyPair.publicKey),
    privateKey: await exportBase16Key(keyPair.privateKey),
  };
}
