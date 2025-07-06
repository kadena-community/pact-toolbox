import { vi } from "vitest";
import type { Wallet, PartiallySignedTransaction, TransactionSig } from "@pact-toolbox/types";

// Mock signer factory
export function createMockSigner(publicKey: string, canSign = true): Wallet {
  return {
    id: 'mock',
    isInstalled: vi.fn().mockReturnValue(true),
    connect: vi.fn().mockResolvedValue({
      publicKey,
      address: `k:${publicKey}`,
    }),
    getAccount: vi.fn().mockResolvedValue({
      publicKey,
      address: `k:${publicKey}`,
    }),
    getNetwork: vi.fn().mockResolvedValue({
      id: 'test',
      networkId: 'development',
      name: 'Test Network',
      url: 'http://localhost:8080',
    }),
    isConnected: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sign: vi.fn().mockImplementation(async (tx: PartiallySignedTransaction) => {
      if (!canSign) {
        throw new Error("Signer cannot sign");
      }

      const cmd = JSON.parse(tx.cmd);
      const signers = cmd.signers || [];

      // Create signatures only for signers this signer controls
      const sigs: TransactionSig[] = signers.map((signer: any, index: number) => {
        if (signer.pubKey === publicKey) {
          return { sig: `${publicKey}-signature-${index}`, pubKey: signer.pubKey };
        }
        return tx.sigs?.[index] || { pubKey: signer.pubKey, sig: undefined };
      });

      return {
        ...tx,
        sigs,
      };
    }),
  };
}