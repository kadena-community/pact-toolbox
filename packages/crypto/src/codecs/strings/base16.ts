import type { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from "../core";
import { combineCodec, createDecoder, createEncoder } from "../core";

const enum HexC {
  ZERO = 48, // 0
  NINE = 57, // 9
  A_UP = 65, // A
  F_UP = 70, // F
  A_LO = 97, // a
  F_LO = 102, // f
}

function charCodeToBase16(char: number) {
  if (char >= HexC.ZERO && char <= HexC.NINE) return char - HexC.ZERO;
  if (char >= HexC.A_UP && char <= HexC.F_UP) return char - (HexC.A_UP - 10);
  if (char >= HexC.A_LO && char <= HexC.F_LO) return char - (HexC.A_LO - 10);
}

/** Encodes strings in base16. */
export function getBase16Encoder(): VariableSizeEncoder<string> {
  return createEncoder({
    getSizeFromValue: (value: string) => Math.ceil(value.length / 2),
    write(value: string, bytes, offset) {
      const len = value.length;
      const al = len / 2;
      if (len === 1) {
        const c = value.charCodeAt(0);
        const n = charCodeToBase16(c);
        if (n === undefined) {
          throw new Error(`Invalid string for base16: ${value}`);
        }
        bytes.set([n], offset);
        return 1 + offset;
      }
      const hexBytes = new Uint8Array(al);
      for (let i = 0, j = 0; i < al; i++) {
        const c1 = value.charCodeAt(j++);
        const c2 = value.charCodeAt(j++);

        const n1 = charCodeToBase16(c1);
        const n2 = charCodeToBase16(c2);
        if (n1 === undefined || (n2 === undefined && !Number.isNaN(c2))) {
          throw new Error(`Invalid string for base16: ${value}`);
        }
        hexBytes[i] = !Number.isNaN(c2) ? (n1 << 4) | (n2 ?? 0) : n1;
      }

      bytes.set(hexBytes, offset);
      return hexBytes.length + offset;
    },
  });
}

/** Decodes strings in base16. */
export function getBase16Decoder(): VariableSizeDecoder<string> {
  return createDecoder({
    read(bytes, offset) {
      const value = bytes.slice(offset).reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
      return [value, bytes.length];
    },
  });
}

/** Encodes and decodes strings in base16. */
export function getBase16Codec(): VariableSizeCodec<string> {
  return combineCodec(getBase16Encoder(), getBase16Decoder());
}

export const base16: VariableSizeCodec<string> = getBase16Codec();
