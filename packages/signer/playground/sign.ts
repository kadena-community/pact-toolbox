import { createSignWithKeypair } from "@kadena/client";
import { genKeyPair, hash, verifySig } from "@kadena/cryptography-utils";
import type { PactCommand } from "@pact-toolbox/types";
import { Bench } from "tinybench";

import { base64Url, getBase16Codec, getBase64UrlCodec, SignatureBytes, verifySignature } from "@pact-toolbox/crypto";

import { finalizeTransaction } from "../src/command-signer";
import { createKeyPairSignerFromPrivateKeyBytes, generateKeyPairSigner } from "../src/keypair-signer";

// Generate key pairs
const base16Codecs = getBase16Codec();
const base64UrlCodecs = getBase64UrlCodec();
const keyPair = genKeyPair();
const secretKeyBytes = base16Codecs.encode(keyPair.secretKey);
const signer = await createKeyPairSignerFromPrivateKeyBytes(secretKeyBytes);
// Get public keys in hex format

// Create a PactCommand
const command: PactCommand = {
  payload: {
    exec: {
      data: {},
      code: "(+ 1 2)",
    },
  },
  meta: {
    chainId: "0",
    sender: `k:${keyPair.publicKey}`,
    gasLimit: 1000,
    gasPrice: 1e-6,
    ttl: 15 * 60,
    creationTime: Math.round(Date.now() / 1000),
  },
  signers: [{ pubKey: keyPair.publicKey }],
  networkId: "testnet",
  nonce: "some-nonce",
};

const sign = createSignWithKeypair(keyPair);

function signCommand(command: PactCommand) {
  const cmd = JSON.stringify(command);
  return sign({
    cmd,
    hash: hash(cmd),
    sigs: [],
  });
}
const signedCommand = await signCommand(command);
console.log(signedCommand);
const [signedCommand2] = await signer.signPactCommands([command]);
console.log(finalizeTransaction(signedCommand2));
await verifySignature(
  signer.keyPair.publicKey,
  base16Codecs.encode(signedCommand.sigs[0]!.sig!) as SignatureBytes,
  base64UrlCodecs.encode(signedCommand.hash),
);
await verifySignature(
  signer.keyPair.publicKey,
  base16Codecs.encode(signedCommand2.sigs[0]!.sig!) as SignatureBytes,
  signedCommand2.hash,
);

verifySig(
  signedCommand2.hash,
  base16Codecs.encode(signedCommand2.sigs[0]!.sig!) as SignatureBytes,
  base16Codecs.encode(keyPair.publicKey) as Uint8Array,
);
const bench = new Bench({
  warmup: true,
  // time: 100000,
});
bench
  .add("@kadena/client -> createSignWithKeyPair", async () => {
    const keyPair = genKeyPair();
    const sign = createSignWithKeypair(keyPair);
    // Create a PactCommand
    const command: PactCommand = {
      payload: {
        exec: {
          data: {},
          code: "(+ 1 2)",
        },
      },
      meta: {
        chainId: "0",
        sender: `k:${keyPair.publicKey}`,
        gasLimit: 1000,
        gasPrice: 1e-6,
        ttl: 15 * 60,
        creationTime: Math.round(Date.now() / 1000),
      },
      signers: [{ pubKey: keyPair.publicKey }],
      networkId: "testnet",
      nonce: "some-nonce",
    };
    const cmd = JSON.stringify(command);
    const signedCommand = await sign({
      cmd,
      hash: hash(cmd),
      sigs: [],
    });
    verifySig(
      base64Url.encode(signedCommand.hash) as Uint8Array,
      base16Codecs.encode(signedCommand.sigs[0]!.sig!) as SignatureBytes,
      base16Codecs.encode(keyPair.publicKey) as Uint8Array,
    );
  })
  .add("@pact-toolbox/signer -> keyPairSigner", async () => {
    const signer = await generateKeyPairSigner();
    // Create a PactCommand
    const command: PactCommand = {
      payload: {
        exec: {
          data: {},
          code: "(+ 1 2)",
        },
      },
      meta: {
        chainId: "0",
        sender: `k:${signer.address}`,
        gasLimit: 1000,
        gasPrice: 1e-6,
        ttl: 15 * 60,
        creationTime: Math.round(Date.now() / 1000),
      },
      signers: [{ pubKey: signer.address }],
      networkId: "testnet",
      nonce: "some-nonce",
    };
    const [signedCommand] = await signer.signPactCommands([command]);
    await verifySignature(
      signer.keyPair.publicKey,
      base16Codecs.encode(signedCommand.sigs[0]!.sig!) as SignatureBytes,
      signedCommand.hash,
    );
  });

await bench.run();

console.table(bench.table());
