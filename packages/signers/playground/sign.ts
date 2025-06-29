// Removed import of createSignWithKeypair from @kadena/client
import { genKeyPair, verifySig } from "@kadena/cryptography-utils";
import type { PactCommand } from "@pact-toolbox/types";
import { Bench } from "tinybench";

import { fromHex, type SignatureBytes, verifySignature } from "@pact-toolbox/crypto";

import { finalizeTransaction } from "../src/utils";
import { KeyPairSigner } from "../src/signer";

// Generate key pairs
const keyPair = genKeyPair();
const secretKeyBytes = fromHex(keyPair.secretKey);
const signer = await KeyPairSigner.fromPrivateKeyBytes(secretKeyBytes);
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

// Use pact-toolbox signer instead of @kadena/client
const signerFromKeyPair = await KeyPairSigner.fromPrivateKeyBytes(secretKeyBytes);
const [signedCommand] = await signerFromKeyPair.signPactCommands([command]);
console.log(finalizeTransaction(signedCommand));
const [signedCommand2] = await signer.signPactCommands([command]);
console.log(finalizeTransaction(signedCommand2));
await verifySignature(
  signerFromKeyPair.keyPair.publicKey,
  fromHex(signedCommand.sigs[0]!.sig!) as SignatureBytes,
  signedCommand.hash,
);
await verifySignature(
  signer.keyPair.publicKey,
  fromHex(signedCommand2.sigs[0]!.sig!) as SignatureBytes,
  signedCommand2.hash,
);

verifySig(signedCommand2.hash, fromHex(signedCommand2.sigs[0]!.sig!) as SignatureBytes, fromHex(keyPair.publicKey));
const bench = new Bench({
  warmup: true,
  // time: 100000,
});
bench
  .add("@pact-toolbox/signers -> KeyPairSigner.fromPrivateKeyBytes", async () => {
    const keyPair = genKeyPair();
    const secretKeyBytes = fromHex(keyPair.secretKey);
    const signer = await KeyPairSigner.fromPrivateKeyBytes(secretKeyBytes);
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
    const [signedCommand] = await signer.signPactCommands([command]);
    verifySig(signedCommand.hash, fromHex(signedCommand.sigs[0]!.sig!) as SignatureBytes, fromHex(keyPair.publicKey));
  })
  .add("@pact-toolbox/signers -> keyPairSigner", async () => {
    const signer = await KeyPairSigner.generate();
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
      fromHex(signedCommand.sigs[0]!.sig!) as SignatureBytes,
      signedCommand.hash,
    );
  });

await bench.run();

console.table(bench.table());
