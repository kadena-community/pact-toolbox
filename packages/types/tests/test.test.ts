import { describe, expect, it } from "vitest";

import type { ChainId, PactCommand, PactKeyset, NetworkMeta } from "../src";

describe("@pact-toolbox/types", () => {
  it("should export all expected types", () => {
    // Test that all types can be imported
    const chainId: ChainId = "0";
    expect(chainId).toBe("0");

    const keyset: PactKeyset = {
      keys: ["test-key"],
      pred: "keys-all",
    };
    expect(keyset.keys).toHaveLength(1);
    expect(keyset.pred).toBe("keys-all");
  });

  it("should support valid chain IDs", () => {
    const validChainIds: ChainId[] = ["0", "1", "2", "19"];
    expect(validChainIds).toHaveLength(4);
  });

  it("should define proper command structure", () => {
    const command: Partial<PactCommand> = {
      payload: {
        exec: {
          code: "(+ 1 2)",
          data: {},
        },
      },
      meta: {
        chainId: "0",
      },
      signers: [],
      networkId: "mainnet01",
      nonce: "test-nonce",
    };

    expect(command.payload?.exec?.code).toBe("(+ 1 2)");
    expect(command.meta?.chainId).toBe("0");
  });

  it("should define proper network config structure", () => {
    const networkMeta: NetworkMeta = {
      chainId: "0",
      gasLimit: 10000,
      gasPrice: 0.0000001,
      ttl: 600,
    };

    expect(networkMeta.chainId).toBe("0");
    expect(networkMeta.gasLimit).toBe(10000);
  });
});
