import { genKeyPair } from "@kadena/cryptography-utils";

import { createSignableMessage, KeyPairSigner } from "./src";
import { createKeyPairFromPrivateKeyBytes, generateKeyPair, fromHex } from "@pact-toolbox/crypto";

console.time("native -> generateKeyPair");
const keyPair = await generateKeyPair();
const signer = await KeyPairSigner.fromKeyPair(keyPair);
console.log(signer.address);
console.timeEnd("native -> generateKeyPair");

console.time("@kadena/cryptography-utils -> genKeyPair");
const keyPair2 = genKeyPair();
console.timeEnd("@kadena/cryptography-utils -> genKeyPair");
console.log(keyPair2.publicKey);

console.time("validate keyPair2");
const secretBytes = fromHex(keyPair2.secretKey);
const keyPair3 = await createKeyPairFromPrivateKeyBytes(secretBytes);
const signer2 = await KeyPairSigner.fromKeyPair(keyPair3);
console.timeEnd("validate keyPair2");
console.log(signer2.keyPair.publicKey.toString());

const message = "Hello, world!";
const messageBytes = createSignableMessage(message);
console.time("signer -> signMessages");
const _signature = await signer.signMessages([messageBytes]);
console.timeEnd("signer -> signMessages");
