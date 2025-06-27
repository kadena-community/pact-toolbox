/**
 * Utility functions for network package
 */

import { access } from "node:fs/promises";
import { execSync } from "node:child_process";
import { logger, writeFile } from "@pact-toolbox/node-utils";
import { DEFAULT_CERTIFICATE, DEFAULT_KEY } from "./config/certificate";

/**
 * Check if OpenSSL is available on the system
 */
async function isOpenSSLAvailable(): Promise<boolean> {
  try {
    execSync("openssl version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a self-signed certificate using OpenSSL or fallback
 */
async function generateSelfSignedCert(certPath: string, keyPath: string): Promise<void> {
  const hasOpenSSL = await isOpenSSLAvailable();
  
  if (!hasOpenSSL) {
    logger.warn("OpenSSL not found. Using fallback certificates.");
    await Promise.all([
      writeFile(certPath, DEFAULT_CERTIFICATE),
      writeFile(keyPath, DEFAULT_KEY)
    ]);
    return;
  }

  try {
    // Generate RSA key
    execSync(
      `openssl genpkey -algorithm RSA -out "${keyPath}" -pkeyopt rsa_keygen_bits:2048`,
      { stdio: "pipe" }
    );
    
    // Generate certificate
    execSync(
      `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=devnet-bootstrap-node" -nodes`,
      { stdio: "pipe" }
    );
  } catch (error) {
    logger.error("Failed to generate certificate with OpenSSL:", error);
    throw new Error("Certificate generation failed");
  }
}

/**
 * Ensure SSL certificates exist, generating them if needed
 */
export async function ensureCertificates(certPath: string, keyPath: string): Promise<void> {
  try {
    // Check if both files exist
    await Promise.all([
      access(certPath),
      access(keyPath)
    ]);
  } catch {
    // Generate if missing
    await generateSelfSignedCert(certPath, keyPath);
  }
}