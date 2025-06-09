import crypto from "uncrypto";

import type { ReadonlyUint8Array } from "../codecs/types";
import { assertKeyExporterIsAvailable, assertKeyGenerationIsAvailable, assertPRNGIsAvailable } from "../assertions";
import { signBytes, verifySignature } from "./signatures";

function addPkcs8Header(bytes: ReadonlyUint8Array): ReadonlyUint8Array {
  // prettier-ignore
  return new Uint8Array([
        /**
         * PKCS#8 header
         */
        0x30, // ASN.1 sequence tag
        0x2e, // Length of sequence (46 more bytes)

            0x02, // ASN.1 integer tag
            0x01, // Length of integer
                0x00, // Version number

            0x30, // ASN.1 sequence tag
            0x05, // Length of sequence
                0x06, // ASN.1 object identifier tag
                0x03, // Length of object identifier
                    // Edwards curve algorithms identifier https://oid-rep.orange-labs.fr/get/1.3.101.112
                        0x2b, // iso(1) / identified-organization(3) (The first node is multiplied by the decimal 40 and the result is added to the value of the second node)
                        0x65, // thawte(101)
                    // Ed25519 identifier
                        0x70, // id-Ed25519(112)

        /**
         * Private key payload
         */
        0x04, // ASN.1 octet string tag
        0x22, // String length (34 more bytes)

            // Private key bytes as octet string
            0x04, // ASN.1 octet string tag
            0x20, // String length (32 bytes)

        ...bytes
    ]);
}

export async function createPrivateKeyFromBytes(bytes: ReadonlyUint8Array, extractable?: boolean): Promise<CryptoKey> {
  const actualLength = bytes.byteLength;
  if (actualLength !== 32) {
    throw new Error(`Invalid private key length: ${actualLength}`);
  }
  const privateKeyBytesPkcs8 = addPkcs8Header(bytes);
  return crypto.subtle.importKey("pkcs8", privateKeyBytesPkcs8, "Ed25519", extractable ?? false, ["sign"]);
}

export async function getPublicKeyFromPrivateKey(
  privateKey: CryptoKey,
  extractable: boolean = false,
): Promise<CryptoKey> {
  assertKeyExporterIsAvailable();

  if (privateKey.extractable === false) {
    throw new Error(`Private key ${privateKey} is not extractable`);
  }

  // Export private key.
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);

  // Import public key.
  return await crypto.subtle.importKey(
    "jwk",
    {
      crv /* curve */: "Ed25519",
      ext /* extractable */: extractable,
      key_ops /* key operations */: ["verify"],
      kty /* key type */: "OKP" /* octet key pair */,
      x /* public key x-coordinate */: jwk.x,
    },
    "Ed25519",
    extractable,
    ["verify"],
  );
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  await assertKeyGenerationIsAvailable();
  const keyPair = await crypto.subtle.generateKey(
    /* algorithm */ "Ed25519", // Native implementation status: https://github.com/WICG/webcrypto-secure-curves/issues/20
    /* extractable */ false, // Prevents the bytes of the private key from being visible to JS.
    /* allowed uses */ ["sign", "verify"],
  );
  return keyPair as CryptoKeyPair;
}

export async function generateExtractableKeyPair(): Promise<CryptoKeyPair> {
  await assertKeyGenerationIsAvailable();
  const keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  return keyPair as CryptoKeyPair;
}

export async function createKeyPairFromBytes(bytes: ReadonlyUint8Array, extractable?: boolean): Promise<CryptoKeyPair> {
  assertPRNGIsAvailable();

  if (bytes.byteLength !== 64) {
    throw new Error(`invalid key pair length: ${bytes.byteLength}`);
  }
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.importKey("raw", bytes.slice(32), "Ed25519", /* extractable */ true, ["verify"]),
    createPrivateKeyFromBytes(bytes.slice(0, 32), extractable),
  ]);

  // Verify the key pair
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const signedData = await signBytes(privateKey, randomBytes);
  const isValid = await verifySignature(publicKey, signedData, randomBytes);
  if (!isValid) {
    throw new Error("public key must match private key");
  }

  return { privateKey, publicKey } as CryptoKeyPair;
}

export async function createKeyPairFromPrivateKeyBytes(
  bytes: ReadonlyUint8Array,
  extractable: boolean = false,
): Promise<CryptoKeyPair> {
  const privateKeyPromise = createPrivateKeyFromBytes(bytes, extractable);

  // Here we need the private key to be extractable in order to export
  // it as a public key. Therefore, if the `extractable` parameter
  // is `false`, we need to create two private keys such that:
  //   - The extractable one is used to create the public key and
  //   - The non-extractable one is the one we will return.
  const [publicKey, privateKey] = await Promise.all([
    // This nested promise makes things efficient by
    // creating the public key in parallel with the
    // second private key creation, if it is needed.
    (extractable ? privateKeyPromise : createPrivateKeyFromBytes(bytes, true /* extractable */)).then(
      async (privateKey) => await getPublicKeyFromPrivateKey(privateKey, true /* extractable */),
    ),
    privateKeyPromise,
  ]);

  return { privateKey, publicKey };
}
