import type { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from "../core";
import { getBaseXCodec, getBaseXDecoder, getBaseXEncoder } from "./baseX";

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Encodes strings in base58. */
export function getBase58Encoder(): VariableSizeEncoder<string> {
  return getBaseXEncoder(alphabet);
}

/** Decodes strings in base58. */
export function getBase58Decoder(): VariableSizeDecoder<string> {
  return getBaseXDecoder(alphabet);
}

/** Encodes and decodes strings in base58. */
export function getBase58Codec(): VariableSizeCodec<string> {
  return getBaseXCodec(alphabet);
}

export const base58: VariableSizeCodec<string> = getBase58Codec();
