import type { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from "../core";
import { getBaseXCodec, getBaseXDecoder, getBaseXEncoder } from "./baseX";

const alphabet = "0123456789";

/** Encodes strings in base10. */
export function getBase10Encoder(): VariableSizeEncoder<string> {
  return getBaseXEncoder(alphabet);
}

/** Decodes strings in base10. */
export function getBase10Decoder(): VariableSizeDecoder<string> {
  return getBaseXDecoder(alphabet);
}

/** Encodes and decodes strings in base10. */
export function getBase10Codec(): VariableSizeCodec<string> {
  return getBaseXCodec(alphabet);
}

export const base10: VariableSizeCodec<string> = getBase10Codec();
