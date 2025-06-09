import type { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from "../core";
import { combineCodec, createDecoder, createEncoder } from "../core";
import { removeNullCharacters } from "./null";
import { TextEncoder, TextDecoder } from "../text";

/** Encodes UTF-8 strings using the native `TextEncoder` API. */
export function getUtf8Encoder(): VariableSizeEncoder<string> {
  let textEncoder: TextEncoder;
  return createEncoder({
    getSizeFromValue: (value) => (textEncoder ||= new TextEncoder()).encode(value).length,
    write: (value: string, bytes, offset) => {
      const bytesToAdd = (textEncoder ||= new TextEncoder()).encode(value);
      bytes.set(bytesToAdd, offset);
      return offset + bytesToAdd.length;
    },
  });
}

/** Decodes UTF-8 strings using the native `TextDecoder` API. */
export function getUtf8Decoder(): VariableSizeDecoder<string> {
  let textDecoder: TextDecoder;
  return createDecoder({
    read(bytes, offset) {
      const value = (textDecoder ||= new TextDecoder()).decode(bytes.slice(offset));
      return [removeNullCharacters(value), bytes.length];
    },
  });
}

/** Encodes and decodes UTF-8 strings using the native `TextEncoder` and `TextDecoder` API. */
export function getUtf8Codec(): VariableSizeCodec<string> {
  return combineCodec(getUtf8Encoder(), getUtf8Decoder());
}

export const utf8: VariableSizeCodec<string> = getUtf8Codec();
