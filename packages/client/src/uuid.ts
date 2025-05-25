/**
 * crypto.randomUUID is the standard way to create uuid v4 and it is much faster than the uuid package, and it is well supported on all major browsers
 * NOTE: it only works on secure connection (https), don't worry it also works on localhost
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

function fallbackWhenNoCrypto() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(/[xy]/g, (c) => {
    // eslint-disable-next-line no-bitwise
    const r = (Math.random() * 16) | 0;
    // eslint-disable-next-line no-bitwise
    const v = "x" === c ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getUuid(): string {
  if ("undefined" === typeof crypto) {
    return fallbackWhenNoCrypto();
  }
  // use nanoid instead of native crypto.randomUUID, mainly for nodejs/jest and also old browsers
  return "function" === typeof crypto.randomUUID ? crypto.randomUUID() : nanoid(21);
}
