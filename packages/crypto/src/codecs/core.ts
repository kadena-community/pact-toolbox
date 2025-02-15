import type { ReadonlyUint8Array } from "./types";
import { assertByteArrayHasEnoughBytesForCodec } from "../assertions";

/**
 * Defines an offset in bytes.
 */
export type Offset = number;

type BaseEncoder<TFrom> = {
  /** Encode the provided value and return the encoded bytes directly. */
  readonly encode: (value: TFrom) => ReadonlyUint8Array;
  /**
   * Writes the encoded value into the provided byte array at the given offset.
   * Returns the offset of the next byte after the encoded value.
   */
  readonly write: (value: TFrom, bytes: Uint8Array, offset: Offset) => Offset;
};

export type FixedSizeEncoder<TFrom, TSize extends number = number> = BaseEncoder<TFrom> & {
  /** The fixed size of the encoded value in bytes. */
  readonly fixedSize: TSize;
};

export type VariableSizeEncoder<TFrom> = BaseEncoder<TFrom> & {
  /** The total size of the encoded value in bytes. */
  readonly getSizeFromValue: (value: TFrom) => number;
  /** The maximum size an encoded value can be in bytes, if applicable. */
  readonly maxSize?: number;
};

/**
 * An object that can encode a value to a `Uint8Array`.
 */
export type Encoder<TFrom> = FixedSizeEncoder<TFrom> | VariableSizeEncoder<TFrom>;

type BaseDecoder<TTo> = {
  /** Decodes the provided byte array at the given offset (or zero) and returns the value directly. */
  readonly decode: (bytes: ReadonlyUint8Array | Uint8Array, offset?: Offset) => TTo;
  /**
   * Reads the encoded value from the provided byte array at the given offset.
   * Returns the decoded value and the offset of the next byte after the encoded value.
   */
  readonly read: (bytes: ReadonlyUint8Array | Uint8Array, offset: Offset) => [TTo, Offset];
};

export type FixedSizeDecoder<TTo, TSize extends number = number> = BaseDecoder<TTo> & {
  /** The fixed size of the encoded value in bytes. */
  readonly fixedSize: TSize;
};

export type VariableSizeDecoder<TTo> = BaseDecoder<TTo> & {
  /** The maximum size an encoded value can be in bytes, if applicable. */
  readonly maxSize?: number;
};

/**
 * An object that can decode a value from a `Uint8Array`.
 */
export type Decoder<TTo> = FixedSizeDecoder<TTo> | VariableSizeDecoder<TTo>;

export type FixedSizeCodec<TFrom, TTo extends TFrom = TFrom, TSize extends number = number> = FixedSizeDecoder<
  TTo,
  TSize
> &
  FixedSizeEncoder<TFrom, TSize>;

export type VariableSizeCodec<TFrom, TTo extends TFrom = TFrom> = VariableSizeDecoder<TTo> & VariableSizeEncoder<TFrom>;

/**
 * An object that can encode and decode a value to and from a `Uint8Array`.
 * It supports encoding looser types than it decodes for convenience.
 * For example, a `bigint` encoder will always decode to a `bigint`
 * but can be used to encode a `number`.
 *
 * @typeParam TFrom - The type of the value to encode.
 * @typeParam TTo - The type of the decoded value. Defaults to `TFrom`.
 */
export type Codec<TFrom, TTo extends TFrom = TFrom> = FixedSizeCodec<TFrom, TTo> | VariableSizeCodec<TFrom, TTo>;

/**
 * Get the encoded size of a given value in bytes.
 */
export function getEncodedSize<TFrom>(
  value: TFrom,
  encoder: { fixedSize: number } | { getSizeFromValue: (value: TFrom) => number },
): number {
  return "fixedSize" in encoder ? encoder.fixedSize : encoder.getSizeFromValue(value);
}

/** Fills the missing `encode` function using the existing `write` function. */
export function createEncoder<TFrom, TSize extends number>(
  encoder: Omit<FixedSizeEncoder<TFrom, TSize>, "encode">,
): FixedSizeEncoder<TFrom, TSize>;
export function createEncoder<TFrom>(encoder: Omit<VariableSizeEncoder<TFrom>, "encode">): VariableSizeEncoder<TFrom>;
export function createEncoder<TFrom>(
  encoder: Omit<FixedSizeEncoder<TFrom>, "encode"> | Omit<VariableSizeEncoder<TFrom>, "encode">,
): Encoder<TFrom>;
export function createEncoder<TFrom>(
  encoder: Omit<FixedSizeEncoder<TFrom>, "encode"> | Omit<VariableSizeEncoder<TFrom>, "encode">,
): Encoder<TFrom> {
  return Object.freeze({
    ...encoder,
    encode: (value) => {
      const bytes = new Uint8Array(getEncodedSize(value, encoder));
      encoder.write(value, bytes, 0);
      return bytes;
    },
  });
}

/** Fills the missing `decode` function using the existing `read` function. */
export function createDecoder<TTo, TSize extends number>(
  decoder: Omit<FixedSizeDecoder<TTo, TSize>, "decode">,
): FixedSizeDecoder<TTo, TSize>;
export function createDecoder<TTo>(decoder: Omit<VariableSizeDecoder<TTo>, "decode">): VariableSizeDecoder<TTo>;
export function createDecoder<TTo>(
  decoder: Omit<FixedSizeDecoder<TTo>, "decode"> | Omit<VariableSizeDecoder<TTo>, "decode">,
): Decoder<TTo>;
export function createDecoder<TTo>(
  decoder: Omit<FixedSizeDecoder<TTo>, "decode"> | Omit<VariableSizeDecoder<TTo>, "decode">,
): Decoder<TTo> {
  return Object.freeze({
    ...decoder,
    decode: (bytes, offset = 0) => decoder.read(bytes, offset)[0],
  });
}

/** Fills the missing `encode` and `decode` function using the existing `write` and `read` functions. */
export function createCodec<TFrom, TTo extends TFrom = TFrom, TSize extends number = number>(
  codec: Omit<FixedSizeCodec<TFrom, TTo, TSize>, "decode" | "encode">,
): FixedSizeCodec<TFrom, TTo, TSize>;
export function createCodec<TFrom, TTo extends TFrom = TFrom>(
  codec: Omit<VariableSizeCodec<TFrom, TTo>, "decode" | "encode">,
): VariableSizeCodec<TFrom, TTo>;
export function createCodec<TFrom, TTo extends TFrom = TFrom>(
  codec:
    | Omit<FixedSizeCodec<TFrom, TTo>, "decode" | "encode">
    | Omit<VariableSizeCodec<TFrom, TTo>, "decode" | "encode">,
): Codec<TFrom, TTo>;
export function createCodec<TFrom, TTo extends TFrom = TFrom>(
  codec:
    | Omit<FixedSizeCodec<TFrom, TTo>, "decode" | "encode">
    | Omit<VariableSizeCodec<TFrom, TTo>, "decode" | "encode">,
): Codec<TFrom, TTo> {
  return Object.freeze({
    ...codec,
    decode: (bytes, offset = 0) => codec.read(bytes, offset)[0],
    encode: (value) => {
      const bytes = new Uint8Array(getEncodedSize(value, codec));
      codec.write(value, bytes, 0);
      return bytes;
    },
  });
}

export function isFixedSize<TFrom, TSize extends number>(
  encoder: FixedSizeEncoder<TFrom, TSize> | VariableSizeEncoder<TFrom>,
): encoder is FixedSizeEncoder<TFrom, TSize>;
export function isFixedSize<TTo, TSize extends number>(
  decoder: FixedSizeDecoder<TTo, TSize> | VariableSizeDecoder<TTo>,
): decoder is FixedSizeDecoder<TTo, TSize>;
export function isFixedSize<TFrom, TTo extends TFrom, TSize extends number>(
  codec: FixedSizeCodec<TFrom, TTo, TSize> | VariableSizeCodec<TFrom, TTo>,
): codec is FixedSizeCodec<TFrom, TTo, TSize>;
export function isFixedSize<TSize extends number>(
  codec: { fixedSize: TSize } | { maxSize?: number },
): codec is { fixedSize: TSize };
export function isFixedSize(codec: { fixedSize: number } | { maxSize?: number }): codec is { fixedSize: number } {
  return "fixedSize" in codec && typeof codec.fixedSize === "number";
}

export function assertIsFixedSize<TFrom, TSize extends number>(
  encoder: FixedSizeEncoder<TFrom, TSize> | VariableSizeEncoder<TFrom>,
): asserts encoder is FixedSizeEncoder<TFrom, TSize>;
export function assertIsFixedSize<TTo, TSize extends number>(
  decoder: FixedSizeDecoder<TTo, TSize> | VariableSizeDecoder<TTo>,
): asserts decoder is FixedSizeDecoder<TTo, TSize>;
export function assertIsFixedSize<TFrom, TTo extends TFrom, TSize extends number>(
  codec: FixedSizeCodec<TFrom, TTo, TSize> | VariableSizeCodec<TFrom, TTo>,
): asserts codec is FixedSizeCodec<TFrom, TTo, TSize>;
export function assertIsFixedSize<TSize extends number>(
  codec: { fixedSize: TSize } | { maxSize?: number },
): asserts codec is { fixedSize: TSize };
export function assertIsFixedSize(
  codec: { fixedSize: number } | { maxSize?: number },
): asserts codec is { fixedSize: number } {
  if (!isFixedSize(codec)) {
    throw new Error("expected a fixed size codec");
  }
}

export function isVariableSize<TFrom>(encoder: Encoder<TFrom>): encoder is VariableSizeEncoder<TFrom>;
export function isVariableSize<TTo>(decoder: Decoder<TTo>): decoder is VariableSizeDecoder<TTo>;
export function isVariableSize<TFrom, TTo extends TFrom>(
  codec: Codec<TFrom, TTo>,
): codec is VariableSizeCodec<TFrom, TTo>;
export function isVariableSize(codec: { fixedSize: number } | { maxSize?: number }): codec is { maxSize?: number };
export function isVariableSize(codec: { fixedSize: number } | { maxSize?: number }): codec is { maxSize?: number } {
  return !isFixedSize(codec);
}

export function assertIsVariableSize<T>(encoder: Encoder<T>): asserts encoder is VariableSizeEncoder<T>;
export function assertIsVariableSize<T>(decoder: Decoder<T>): asserts decoder is VariableSizeDecoder<T>;
export function assertIsVariableSize<TFrom, TTo extends TFrom>(
  codec: Codec<TFrom, TTo>,
): asserts codec is VariableSizeCodec<TFrom, TTo>;
export function assertIsVariableSize(
  codec: { fixedSize: number } | { maxSize?: number },
): asserts codec is { maxSize?: number };
export function assertIsVariableSize(
  codec: { fixedSize: number } | { maxSize?: number },
): asserts codec is { maxSize?: number } {
  if (!isVariableSize(codec)) {
    throw new Error("expected a variable size codec");
  }
}

/**
 * Converts an encoder A to a encoder B by mapping their values.
 */
export function transformEncoder<TOldFrom, TNewFrom, TSize extends number>(
  encoder: FixedSizeEncoder<TOldFrom, TSize>,
  unmap: (value: TNewFrom) => TOldFrom,
): FixedSizeEncoder<TNewFrom, TSize>;
export function transformEncoder<TOldFrom, TNewFrom>(
  encoder: VariableSizeEncoder<TOldFrom>,
  unmap: (value: TNewFrom) => TOldFrom,
): VariableSizeEncoder<TNewFrom>;
export function transformEncoder<TOldFrom, TNewFrom>(
  encoder: Encoder<TOldFrom>,
  unmap: (value: TNewFrom) => TOldFrom,
): Encoder<TNewFrom>;
export function transformEncoder<TOldFrom, TNewFrom>(
  encoder: Encoder<TOldFrom>,
  unmap: (value: TNewFrom) => TOldFrom,
): Encoder<TNewFrom> {
  return createEncoder({
    ...(isVariableSize(encoder)
      ? { ...encoder, getSizeFromValue: (value: TNewFrom) => encoder.getSizeFromValue(unmap(value)) }
      : encoder),
    write: (value: TNewFrom, bytes, offset) => encoder.write(unmap(value), bytes, offset),
  });
}

/**
 * Converts an decoder A to a decoder B by mapping their values.
 */
export function transformDecoder<TOldTo, TNewTo, TSize extends number>(
  decoder: FixedSizeDecoder<TOldTo, TSize>,
  map: (value: TOldTo, bytes: ReadonlyUint8Array | Uint8Array, offset: number) => TNewTo,
): FixedSizeDecoder<TNewTo, TSize>;
export function transformDecoder<TOldTo, TNewTo>(
  decoder: VariableSizeDecoder<TOldTo>,
  map: (value: TOldTo, bytes: ReadonlyUint8Array | Uint8Array, offset: number) => TNewTo,
): VariableSizeDecoder<TNewTo>;
export function transformDecoder<TOldTo, TNewTo>(
  decoder: Decoder<TOldTo>,
  map: (value: TOldTo, bytes: ReadonlyUint8Array | Uint8Array, offset: number) => TNewTo,
): Decoder<TNewTo>;
export function transformDecoder<TOldTo, TNewTo>(
  decoder: Decoder<TOldTo>,
  map: (value: TOldTo, bytes: ReadonlyUint8Array | Uint8Array, offset: number) => TNewTo,
): Decoder<TNewTo> {
  return createDecoder({
    ...decoder,
    read: (bytes: ReadonlyUint8Array | Uint8Array, offset) => {
      const [value, newOffset] = decoder.read(bytes, offset);
      return [map(value, bytes, offset), newOffset];
    },
  });
}

/**
 * Combines an encoder and a decoder into a codec.
 * The encoder and decoder must have the same fixed size, max size and description.
 * If a description is provided, it will override the encoder and decoder descriptions.
 */
export function combineCodec<TFrom, TTo extends TFrom, TSize extends number>(
  encoder: FixedSizeEncoder<TFrom, TSize>,
  decoder: FixedSizeDecoder<TTo, TSize>,
): FixedSizeCodec<TFrom, TTo, TSize>;
export function combineCodec<TFrom, TTo extends TFrom>(
  encoder: VariableSizeEncoder<TFrom>,
  decoder: VariableSizeDecoder<TTo>,
): VariableSizeCodec<TFrom, TTo>;
export function combineCodec<TFrom, TTo extends TFrom>(
  encoder: Encoder<TFrom>,
  decoder: Decoder<TTo>,
): Codec<TFrom, TTo>;
export function combineCodec<TFrom, TTo extends TFrom>(
  encoder: Encoder<TFrom>,
  decoder: Decoder<TTo>,
): Codec<TFrom, TTo> {
  if (isFixedSize(encoder) !== isFixedSize(decoder)) {
    throw new Error("encoder and decoder size compatibility mismatch");
  }

  if (isFixedSize(encoder) && isFixedSize(decoder) && encoder.fixedSize !== decoder.fixedSize) {
    throw new Error(`encoder and decoder fixed size mismatch ${encoder.fixedSize} !== ${decoder.fixedSize}`);
  }

  if (!isFixedSize(encoder) && !isFixedSize(decoder) && encoder.maxSize !== decoder.maxSize) {
    throw new Error(`encoder and decoder max size mismatch ${encoder.maxSize} !== ${decoder.maxSize}`);
  }

  return {
    ...decoder,
    ...encoder,
    decode: decoder.decode,
    encode: encoder.encode,
    read: decoder.read,
    write: encoder.write,
  };
}

/**
 * Converts a codec A to a codec B by mapping their values.
 */
export function transformCodec<TOldFrom, TNewFrom, TTo extends TNewFrom & TOldFrom, TSize extends number>(
  codec: FixedSizeCodec<TOldFrom, TTo, TSize>,
  unmap: (value: TNewFrom) => TOldFrom,
): FixedSizeCodec<TNewFrom, TTo, TSize>;
export function transformCodec<TOldFrom, TNewFrom, TTo extends TNewFrom & TOldFrom>(
  codec: VariableSizeCodec<TOldFrom, TTo>,
  unmap: (value: TNewFrom) => TOldFrom,
): VariableSizeCodec<TNewFrom, TTo>;
export function transformCodec<TOldFrom, TNewFrom, TTo extends TNewFrom & TOldFrom>(
  codec: Codec<TOldFrom, TTo>,
  unmap: (value: TNewFrom) => TOldFrom,
): Codec<TNewFrom, TTo>;
export function transformCodec<
  TOldFrom,
  TNewFrom,
  TOldTo extends TOldFrom,
  TNewTo extends TNewFrom,
  TSize extends number,
>(
  codec: FixedSizeCodec<TOldFrom, TOldTo, TSize>,
  unmap: (value: TNewFrom) => TOldFrom,
  map: (value: TOldTo, bytes: ReadonlyUint8Array | Uint8Array, offset: number) => TNewTo,
): FixedSizeCodec<TNewFrom, TNewTo, TSize>;
export function transformCodec<TOldFrom, TNewFrom, TOldTo extends TOldFrom, TNewTo extends TNewFrom>(
  codec: VariableSizeCodec<TOldFrom, TOldTo>,
  unmap: (value: TNewFrom) => TOldFrom,
  map: (value: TOldTo, bytes: ReadonlyUint8Array | Uint8Array, offset: number) => TNewTo,
): VariableSizeCodec<TNewFrom, TNewTo>;
export function transformCodec<TOldFrom, TNewFrom, TOldTo extends TOldFrom, TNewTo extends TNewFrom>(
  codec: Codec<TOldFrom, TOldTo>,
  unmap: (value: TNewFrom) => TOldFrom,
  map: (value: TOldTo, bytes: ReadonlyUint8Array | Uint8Array, offset: number) => TNewTo,
): Codec<TNewFrom, TNewTo>;
export function transformCodec<TOldFrom, TNewFrom, TOldTo extends TOldFrom, TNewTo extends TNewFrom>(
  codec: Codec<TOldFrom, TOldTo>,
  unmap: (value: TNewFrom) => TOldFrom,
  map?: (value: TOldTo, bytes: ReadonlyUint8Array | Uint8Array, offset: number) => TNewTo,
): Codec<TNewFrom, TNewTo> {
  return createCodec({
    ...transformEncoder(codec, unmap),
    read: map ? transformDecoder(codec, map).read : (codec.read as unknown as Decoder<TNewTo>["read"]),
  });
}

/**
 * Concatenates an array of `Uint8Array`s into a single `Uint8Array`.
 * Reuses the original byte array when applicable.
 */
export const mergeBytes = (byteArrays: Uint8Array[]): Uint8Array => {
  const nonEmptyByteArrays = byteArrays.filter((arr) => arr.length);
  if (nonEmptyByteArrays.length === 0) {
    return byteArrays.length ? byteArrays[0]! : new Uint8Array();
  }

  if (nonEmptyByteArrays.length === 1) {
    return nonEmptyByteArrays[0]!;
  }

  const totalLength = nonEmptyByteArrays.reduce((total, arr) => total + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  nonEmptyByteArrays.forEach((arr) => {
    result.set(arr, offset);
    offset += arr.length;
  });
  return result;
};

/**
 * Pads a `Uint8Array` with zeroes to the specified length.
 * If the array is longer than the specified length, it is returned as-is.
 */
export const padBytes = (bytes: ReadonlyUint8Array | Uint8Array, length: number): ReadonlyUint8Array | Uint8Array => {
  if (bytes.length >= length) return bytes;
  const paddedBytes = new Uint8Array(length).fill(0);
  paddedBytes.set(bytes);
  return paddedBytes;
};

/**
 * Fixes a `Uint8Array` to the specified length.
 * If the array is longer than the specified length, it is truncated.
 * If the array is shorter than the specified length, it is padded with zeroes.
 */
export const fixBytes = (bytes: ReadonlyUint8Array | Uint8Array, length: number): ReadonlyUint8Array | Uint8Array =>
  padBytes(bytes.length <= length ? bytes : bytes.slice(0, length), length);

/**
 * Returns true if and only if the provided `data` byte array contains
 * the provided `bytes` byte array at the specified `offset`.
 */
export function containsBytes(
  data: ReadonlyUint8Array | Uint8Array,
  bytes: ReadonlyUint8Array | Uint8Array,
  offset: number,
): boolean {
  const slice = offset === 0 && data.length === bytes.length ? data : data.slice(offset, offset + bytes.length);
  if (slice.length !== bytes.length) return false;
  return bytes.every((b, i) => b === slice[i]);
}

/**
 * Creates a fixed-size encoder from a given encoder.
 *
 * @param encoder - The encoder to wrap into a fixed-size encoder.
 * @param fixedBytes - The fixed number of bytes to write.
 */
export function fixEncoderSize<TFrom, TSize extends number>(
  encoder: Encoder<TFrom>,
  fixedBytes: TSize,
): FixedSizeEncoder<TFrom, TSize> {
  return createEncoder({
    fixedSize: fixedBytes,
    write: (value: TFrom, bytes: Uint8Array, offset: Offset) => {
      // Here we exceptionally use the `encode` function instead of the `write`
      // function as using the nested `write` function on a fixed-sized byte
      // array may result in a out-of-bounds error on the nested encoder.
      const variableByteArray = encoder.encode(value);
      const fixedByteArray =
        variableByteArray.length > fixedBytes ? variableByteArray.slice(0, fixedBytes) : variableByteArray;
      bytes.set(fixedByteArray, offset);
      return offset + fixedBytes;
    },
  });
}

/**
 * Creates a fixed-size decoder from a given decoder.
 *
 * @param decoder - The decoder to wrap into a fixed-size decoder.
 * @param fixedBytes - The fixed number of bytes to read.
 */
export function fixDecoderSize<TTo, TSize extends number>(
  decoder: Decoder<TTo>,
  fixedBytes: TSize,
): FixedSizeDecoder<TTo, TSize> {
  return createDecoder({
    fixedSize: fixedBytes,
    read: (bytes, offset) => {
      assertByteArrayHasEnoughBytesForCodec("fixCodecSize", fixedBytes, bytes, offset);
      // Slice the byte array to the fixed size if necessary.
      if (offset > 0 || bytes.length > fixedBytes) {
        bytes = bytes.slice(offset, offset + fixedBytes);
      }
      // If the nested decoder is fixed-size, pad and truncate the byte array accordingly.
      if (isFixedSize(decoder)) {
        bytes = fixBytes(bytes, decoder.fixedSize);
      }
      // Decode the value using the nested decoder.
      const [value] = decoder.read(bytes, 0);
      return [value, offset + fixedBytes];
    },
  });
}

/**
 * Creates a fixed-size codec from a given codec.
 *
 * @param codec - The codec to wrap into a fixed-size codec.
 * @param fixedBytes - The fixed number of bytes to read/write.
 */
export function fixCodecSize<TFrom, TTo extends TFrom, TSize extends number>(
  codec: Codec<TFrom, TTo>,
  fixedBytes: TSize,
): FixedSizeCodec<TFrom, TTo, TSize> {
  return combineCodec(fixEncoderSize(codec, fixedBytes), fixDecoderSize(codec, fixedBytes));
}
