/**
 * Generate a URL-safe unique ID using crypto.getRandomValues
 * @param t - Length of the ID (default: 21)
 * @returns URL-safe unique ID string
 * @example
 * ```typescript
 * const id = nanoid(); // "V1StGXR8_Z5jdHi6B-myT"
 * const shortId = nanoid(10); // "V1StGXR8_Z"
 * ```
 */
export function nanoid(t = 21): string {
  return crypto.getRandomValues(new Uint8Array(t)).reduce(
    (t, e) =>
      (t +=
        // eslint-disable-next-line no-bitwise
        36 > (e &= 63) ? e.toString(36) : 62 > e ? (e - 26).toString(36).toUpperCase() : 62 < e ? "-" : "_"),
    "",
  );
}

/**
 * Fallback UUID generation when crypto API is not available
 * @internal
 */
function fallbackWhenNoCrypto() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(/[xy]/g, (c) => {
    // eslint-disable-next-line no-bitwise
    const r = (Math.random() * 16) | 0;
    // eslint-disable-next-line no-bitwise
    const v = "x" === c ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a cryptographically secure UUID v4
 * @returns UUID v4 string in standard format
 * @example
 * ```typescript
 * const id = getUuid(); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 * ```
 */
export function getUuid(): string {
  if ("undefined" === typeof crypto) {
    return fallbackWhenNoCrypto();
  }
  // use nanoid instead of native crypto.randomUUID, mainly for nodejs/jest and also old browsers
  return "function" === typeof crypto.randomUUID ? crypto.randomUUID() : nanoid(21);
}
