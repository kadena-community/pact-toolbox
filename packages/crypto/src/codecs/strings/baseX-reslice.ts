import type { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from "../core";
import { assertValidBaseString } from "../../assertions";
import { combineCodec, createDecoder, createEncoder } from "../core";

/**
 * Encodes a string using a custom alphabet by reslicing the bits of the byte array.
 * @see {@link getBaseXResliceCodec} for a more detailed description.
 */
export function getBaseXResliceEncoder(alphabet: string, bits: number): VariableSizeEncoder<string> {
  return createEncoder({
    getSizeFromValue: (value: string) => Math.floor((value.length * bits) / 8),
    write(value: string, bytes, offset) {
      assertValidBaseString(alphabet, value);
      if (value === "") return offset;
      const charIndices = [...value].map((c) => alphabet.indexOf(c));
      const reslicedBytes = reslice(charIndices, bits, 8, false);
      bytes.set(reslicedBytes, offset);
      return reslicedBytes.length + offset;
    },
  });
}

/**
 * Decodes a string using a custom alphabet by reslicing the bits of the byte array.
 * @see {@link getBaseXResliceCodec} for a more detailed description.
 */
export function getBaseXResliceDecoder(alphabet: string, bits: number): VariableSizeDecoder<string> {
  return createDecoder({
    read(rawBytes, offset = 0): [string, number] {
      const bytes = offset === 0 ? rawBytes : rawBytes.slice(offset);
      if (bytes.length === 0) return ["", rawBytes.length];
      const charIndices = reslice([...bytes], 8, bits, true);
      return [charIndices.map((i) => alphabet[i]).join(""), rawBytes.length];
    },
  });
}
/**
 * A string serializer that reslices bytes into custom chunks
 * of bits that are then mapped to a custom alphabet.
 *
 * This can be used to create serializers whose alphabet
 * is a power of 2 such as base16 or base64.
 */
export function getBaseXResliceCodec(alphabet: string, bits: number): VariableSizeCodec<string> {
  return combineCodec(getBaseXResliceEncoder(alphabet, bits), getBaseXResliceDecoder(alphabet, bits));
}

/** Helper function to reslice the bits inside bytes. */
function reslice(input: number[], inputBits: number, outputBits: number, useRemainder: boolean): number[] {
  const output = [];
  let accumulator = 0;
  let bitsInAccumulator = 0;
  const mask = (1 << outputBits) - 1;
  for (const value of input) {
    accumulator = (accumulator << inputBits) | value;
    bitsInAccumulator += inputBits;
    while (bitsInAccumulator >= outputBits) {
      bitsInAccumulator -= outputBits;
      output.push((accumulator >> bitsInAccumulator) & mask);
    }
  }
  if (useRemainder && bitsInAccumulator > 0) {
    output.push((accumulator << (outputBits - bitsInAccumulator)) & mask);
  }
  return output;
}
