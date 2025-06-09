// import { base64url } from "@scure/base";

import { base64Url } from "../codecs/strings/base64-url";
import { blake2b } from "./blake2b";

export function blake2bBase64Url(input: string | Uint8Array): string {
  return base64Url.decode(blake2b(input, undefined, 32));
}
