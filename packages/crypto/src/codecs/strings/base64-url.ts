import type { VariableSizeCodec, VariableSizeDecoder, VariableSizeEncoder } from "../core";
import { combineCodec, createDecoder, createEncoder, transformDecoder, transformEncoder } from "../core";
import { getBaseXResliceDecoder, getBaseXResliceEncoder } from "./baseX-reslice";

const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Encodes strings in base64url. */
export function getBase64UrlEncoder(): VariableSizeEncoder<string> {
  if (__BROWSER__) {
    return createEncoder({
      getSizeFromValue: (value: string) => {
        try {
          const paddedValue = value
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(value.length / 4) * 4, "=");
          return atob(paddedValue).length;
        } catch {
          throw new Error(`Invalid string for base64url: ${value}`);
        }
      },
      write(value: string, bytes, offset) {
        try {
          const paddedValue = value
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(value.length / 4) * 4, "=");
          const bytesToAdd = atob(paddedValue)
            .split("")
            .map((c) => c.charCodeAt(0));
          bytes.set(bytesToAdd, offset);
          return bytesToAdd.length + offset;
        } catch {
          throw new Error(`Invalid string for base64url: ${value}`);
        }
      },
    });
  }

  if (__NODEJS__) {
    return createEncoder({
      getSizeFromValue: (value: string) => Buffer.from(value, "base64url").length,
      write(value: string, bytes, offset) {
        // assertValidBaseString(base64UrlAlphabet, value);
        const buffer = Buffer.from(value, "base64url");
        bytes.set(buffer, offset);
        return buffer.length + offset;
      },
    });
  }

  return transformEncoder(getBaseXResliceEncoder(base64UrlAlphabet, 6), (value: string): string => value);
}

/** Decodes strings in base64url. */
export function getBase64UrlDecoder(): VariableSizeDecoder<string> {
  if (__BROWSER__) {
    return createDecoder({
      read(bytes, offset = 0) {
        const slice = bytes.slice(offset);
        const base64 = btoa(Array.from(slice, (b) => String.fromCharCode(b)).join(""))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        return [base64, bytes.length];
      },
    });
  }

  if (__NODEJS__) {
    return createDecoder({
      read: (bytes, offset = 0) => [Buffer.from(bytes.slice(offset)).toString("base64url"), bytes.length],
    });
  }

  return transformDecoder(getBaseXResliceDecoder(base64UrlAlphabet, 6), (value: string): string => value);
}

/** Encodes and decodes strings in base64url. */
export function getBase64UrlCodec(): VariableSizeCodec<string> {
  return combineCodec(getBase64UrlEncoder(), getBase64UrlDecoder());
}

export const base64Url: VariableSizeCodec<string> = getBase64UrlCodec();
