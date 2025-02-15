/**Removes null characters from a string. */
export function removeNullCharacters(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u0000/g, "");
}

/** Pads a string with null characters at the end. */
export function padNullCharacters(value: string, chars: number): string {
  return value.padEnd(chars, "\u0000");
}
