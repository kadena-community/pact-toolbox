import { genKeyPair } from "@kadena/cryptography-utils";
import { Bench } from "tinybench";

import { generateKeyPair, getKAccountFromPublicKey } from "../src";

const bench = new Bench({
  warmup: true,
});

bench
  .add("@pact-toolbox/crypto -> generateKeyPair", async () => {
    const keyPair = await generateKeyPair();
    await getKAccountFromPublicKey(keyPair.publicKey);
  })
  .add("@kadena/cryptography-utils -> genKeyPair", () => genKeyPair());

console.log(await getKAccountFromPublicKey(await generateKeyPair().then((keyPair) => keyPair.publicKey)));
console.log(genKeyPair().publicKey);
await bench.run();
console.table(bench.table());
