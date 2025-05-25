import type { NetworkConfig } from "@pact-toolbox/config";

import { getNetworkPort, isDevNetworkConfig, isPactServerNetworkConfig } from "@pact-toolbox/config";
import { getRandomNetworkPorts, getRandomPort, isPortTaken, logger, writeFile } from "@pact-toolbox/utils";

import { access } from "node:fs/promises";
import { execSync } from "node:child_process";
import { DEFAULT_CERTIFICATE, DEFAULT_KEY } from "./config/certificate";

export async function ensureAvailablePorts(networkConfig: NetworkConfig): Promise<void> {
  const port = getNetworkPort(networkConfig);
  const isPortInUse = await isPortTaken(port);
  if (isPortInUse) {
    logger.warn(`Port ${port} is in use, finding a new one`);
    if (isPactServerNetworkConfig(networkConfig)) {
      if (networkConfig.serverConfig) {
        networkConfig.serverConfig.port = (await getRandomPort()).toString();
      }
    }
    if (isDevNetworkConfig(networkConfig)) {
      if (networkConfig.containerConfig) {
        networkConfig.containerConfig.port = (await getRandomPort()).toString();
      }
    }
  }
}

async function isOpenSSLAvailable(): Promise<boolean> {
  try {
    execSync("openssl version", { stdio: "ignore" }); // stdio: "ignore" to prevent output
    return true;
  } catch {
    return false;
  }
}

export async function generateSelfSignedCert(certPath: string, keyPath: string): Promise<void> {
  const openSSLAvailable = await isOpenSSLAvailable();
  if (!openSSLAvailable) {
    console.warn("OpenSSL not found/usable. Attempting to use static fallback certificates.");
    await Promise.all([writeFile(certPath, DEFAULT_CERTIFICATE), writeFile(keyPath, DEFAULT_KEY)]);
    return;
  }

  const genKeyCommand = `openssl genpkey -algorithm RSA -out "${keyPath}" -pkeyopt rsa_keygen_bits:2048`;
  const genCertCommand = `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=devnet-bootstrap-node" -nodes`;

  try {
    execSync(genKeyCommand, { stdio: "pipe" });
    execSync(genCertCommand, { stdio: "pipe" });
  } catch (error: any) {
    if (error.stderr) {
      console.error(`OpenSSL stderr: ${error.stderr.toString()}`);
    }
    if (error.stdout) {
      console.error(`OpenSSL stdout: ${error.stdout.toString()}`);
    }
    throw new Error(`Failed to generate certificate/key using OpenSSL.`);
  }
}

export async function ensureCertificates(certFilePath: string, keyFilePath: string): Promise<void> {
  try {
    await Promise.all([access(certFilePath), access(keyFilePath)]);
  } catch {
    await generateSelfSignedCert(certFilePath, keyFilePath);
  }
}
