import { hash } from "@kadena/cryptography-utils";
import { blake2b as blake2bJs } from "blakejs";
import { Bench } from "tinybench";

import { blake2bBase64Url } from "../src/hash";

const bench = new Bench();
const input = "hello world";

bench
  .add("blakejs/blake2b", () => blake2bJs(input, undefined, 32))
  .add("@kadena/cryptography-utils -> hash", () => hash(input))
  .add("@pact-toolbox/crypto -> blake2bBase64Url", () => blake2bBase64Url(input));

console.log(hash(input));
console.log(blake2bBase64Url(input));

bench.warmup = true;
await bench.run();
console.table(bench.table());
