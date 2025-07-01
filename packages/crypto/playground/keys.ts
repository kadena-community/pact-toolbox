import { genKeyPair } from "@kadena/cryptography-utils";
import { Bench } from "tinybench";

import { generateKeyPair, getKAccountFromPublicKey } from "../src";

const bench = new Bench({
  warmup: true,
});

bench
  .add("@pact-toolbox/crypto -> generateKeyPair", async () => {
    const keyPair = await generateKeyPair();
    console.log(keyPair.privateKey);
    await getKAccountFromPublicKey(keyPair.publicKey);
  })
  .add("@kadena/cryptography-utils -> genKeyPair", () => genKeyPair());

const keyPair = await generateKeyPair();
console.log(await getKAccountFromPublicKey(keyPair.publicKey));
console.log(genKeyPair().publicKey);
await bench.run();
console.table(bench.table());
