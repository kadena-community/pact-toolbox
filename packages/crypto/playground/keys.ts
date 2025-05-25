import { genKeyPair } from "@kadena/cryptography-utils";
import { Bench } from "tinybench";

import { generateKeyPair, getAddressFromPublicKey } from "../src";

const bench = new Bench();

bench
  .add("@pact-toolbox/crypto -> generateKeyPair", async () => {
    const keyPair = await generateKeyPair();
    await getAddressFromPublicKey(keyPair.publicKey);
  })
  .add("@kadena/cryptography-utils -> genKeyPair", () => genKeyPair());

console.log(await getAddressFromPublicKey(await generateKeyPair().then((keyPair) => keyPair.publicKey)));
console.log(genKeyPair().publicKey);
bench.warmup = true;
await bench.run();
console.table(bench.table());
