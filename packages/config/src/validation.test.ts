import { describe, test, expect } from "vitest";
import {
  ConfigValidationError,
  validatePactServerConfig,
  validateDevNetContainerConfig,
  validateDevNetMiningConfig,
  validateNetworkConfig,
  validateNetworkMeta,
} from "./validation";
import type { ChainId } from "@pact-toolbox/types";

describe("Configuration Validation", () => {
  describe("validatePactServerConfig", () => {
    test("validates valid config", () => {
      const config = {
        port: 8080,
        logDir: "./logs",
        persistDir: "./data",
        verbose: true,
        gasLimit: 100000,
        gasRate: 0.01,
      };

      expect(() => validatePactServerConfig(config)).not.toThrow();
    });

    test("rejects invalid port", () => {
      const config = { port: 70000 };
      expect(() => validatePactServerConfig(config)).toThrow(ConfigValidationError);
      expect(() => validatePactServerConfig(config)).toThrow(/must be between 1 and 65535/);
    });

    test("rejects negative gas limit", () => {
      const config = { gasLimit: -100 };
      expect(() => validatePactServerConfig(config)).toThrow(/gas limit must be a non-negative number/i);
    });

    test("rejects non-boolean verbose", () => {
      const config = { verbose: "yes" };
      // @ts-expect-error verbose must be a boolean
      expect(() => validatePactServerConfig(config)).toThrow(/verbose must be a boolean/i);
    });
  });

  describe("validateDevNetContainerConfig", () => {
    test("validates valid config", () => {
      const config = {
        port: 8080,
        persistDb: true,
        onDemandMining: false,
        constantDelayBlockTime: 5,
      };

      expect(() => validateDevNetContainerConfig(config)).not.toThrow();
    });

    test("rejects invalid port", () => {
      const config = { port: 0 };
      expect(() => validateDevNetContainerConfig(config)).toThrow(/must be between 1 and 65535/);
    });

    test("rejects negative constantDelayBlockTime", () => {
      const config = { constantDelayBlockTime: -5 };
      expect(() => validateDevNetContainerConfig(config)).toThrow(
        /constantDelayBlockTime must be a non-negative number/i,
      );
    });
  });

  describe("validateDevNetMiningConfig", () => {
    test("validates valid config", () => {
      const config = {
        transactionBatchPeriod: 0.1,
        confirmationCount: 5,
        confirmationPeriod: 5.0,
        disableConfirmationWorker: false,
        idlePeriod: 10,
      };

      expect(() => validateDevNetMiningConfig(config)).not.toThrow();
    });

    test("rejects negative values", () => {
      const config = { idlePeriod: -10 };
      expect(() => validateDevNetMiningConfig(config)).toThrow(/idlePeriod must be a non-negative number/i);
    });

    test("rejects non-boolean flags", () => {
      const config = { disableIdleWorker: "true" };
      // @ts-expect-error disableIdleWorker must be a boolean
      expect(() => validateDevNetMiningConfig(config)).toThrow(/disableIdleWorker must be a boolean/i);
    });
  });

  describe("validateNetworkMeta", () => {
    test("validates valid metadata", () => {
      const meta = {
        chainId: "0" as ChainId,
        gasLimit: 100000,
        gasPrice: 0.00001,
        ttl: 3600,
      };

      expect(() => validateNetworkMeta(meta)).not.toThrow();
    });

    test("rejects invalid chain ID", () => {
      const meta = { chainId: "abc" };
      // @ts-expect-error chain ID must be a numeric string
      expect(() => validateNetworkMeta(meta)).toThrow(/chain ID must be a numeric string/i);
    });

    test("rejects excessive TTL", () => {
      const meta = { chainId: "0", ttl: 100000 };
      // @ts-expect-error TTL must be a non-negative number
      expect(() => validateNetworkMeta(meta)).toThrow(/TTL exceeds maximum \(24 hours\)/i);
    });

    test("rejects excessive gas price", () => {
      const meta = { chainId: "0", gasPrice: 2 };
      // @ts-expect-error gas price must be a non-negative number
      expect(() => validateNetworkMeta(meta)).toThrow(/gas price seems too high/i);
    });
  });

  describe("validateNetworkConfig", () => {
    test("validates Pact Server network", () => {
      const config = {
        type: "pact-server" as const,
        networkId: "development",
        rpcUrl: "http://localhost:8080",
        senderAccount: "sender00",
        keyPairs: [],
        keysets: {},
        autoStart: true,
        serverConfig: {
          port: 8080,
        },
        meta: {
          chainId: "0" as ChainId,
          gasLimit: 150000,
          gasPrice: 0.00000001,
          ttl: 900,
        },
      };
      expect(() => validateNetworkConfig(config)).not.toThrow();
    });

    test("validates DevNet network", () => {
      const config = {
        type: "chainweb-devnet" as const,
        networkId: "development",
        rpcUrl: "http://localhost:8080",
        senderAccount: "sender00",
        keyPairs: [],
        keysets: {},
        autoStart: true,
        containerConfig: {
          port: 8080,
          onDemandMining: true,
        },
        meta: {
          chainId: "0" as ChainId,
          gasLimit: 150000,
          gasPrice: 0.00000001,
          ttl: 900,
        },
      };

      expect(() => validateNetworkConfig(config)).not.toThrow();
    });

    test("validates Chainweb network", () => {
      const config = {
        type: "chainweb" as const,
        networkId: "testnet04",
        rpcUrl: "https://api.testnet.chainweb.com/chainweb/0.0/{networkId}/chain/{chainId}/pact",
        senderAccount: "",
        keyPairs: [],
        keysets: {},
        meta: {
          chainId: "0" as ChainId,
          gasLimit: 150000,
          gasPrice: 0.00000001,
          ttl: 900,
        },
      };

      expect(() => validateNetworkConfig(config)).not.toThrow();
    });

    test("rejects invalid network type", () => {
      const config = {
        type: "invalid-type",
        networkId: "test",
      } as any;

      expect(() => validateNetworkConfig(config)).toThrow(ConfigValidationError);
    });

    test("rejects missing network ID", () => {
      const config = {
        type: "chainweb" as const,
      } as any;

      expect(() => validateNetworkConfig(config)).toThrow(/network ID is required/i);
    });

    test("validates URL with placeholders", () => {
      const config = {
        type: "chainweb" as const,
        networkId: "testnet04",
        rpcUrl: "https://api.chainweb.com/{networkId}/{chainId}/pact",
        senderAccount: "",
        keyPairs: [],
        keysets: {},
        meta: {
          chainId: "0" as ChainId,
          gasLimit: 150000,
          gasPrice: 0.00000001,
          ttl: 900,
        },
      };

      expect(() => validateNetworkConfig(config)).not.toThrow();
    });

    test("rejects invalid URL", () => {
      const config = {
        type: "chainweb" as const,
        networkId: "testnet04",
        rpcUrl: "not-a-url",
        senderAccount: "",
        keyPairs: [],
        keysets: {},
        meta: {
          chainId: "0" as ChainId,
          gasLimit: 150000,
          gasPrice: 0.00000001,
          ttl: 900,
        },
      };

      expect(() => validateNetworkConfig(config)).toThrow(/has invalid URL format/);
    });
  });

  // Remove safeParseNetworkConfig tests as we removed that function

  describe("Key validation", () => {
    test("validates proper hex keys", () => {
      const config = {
        type: "pact-server" as const,
        networkId: "development",
        rpcUrl: "http://localhost:8080",
        senderAccount: "test",
        keyPairs: [
          {
            account: "test",
            publicKey: "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca",
            secretKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
          },
        ],
        keysets: {},
        meta: {
          chainId: "0" as ChainId,
          gasLimit: 150000,
          gasPrice: 0.00000001,
          ttl: 900,
        },
      };

      expect(() => validateNetworkConfig(config)).not.toThrow();
    });

    test("rejects invalid public key format", () => {
      const config = {
        type: "pact-server" as const,
        networkId: "development",
        rpcUrl: "http://localhost:8080",
        senderAccount: "test",
        keyPairs: [
          {
            account: "test",
            publicKey: "invalid-key",
            secretKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
          },
        ],
        keysets: {},
        meta: {
          chainId: "0" as ChainId,
          gasLimit: 150000,
          gasPrice: 0.00000001,
          ttl: 900,
        },
      };

      expect(() => validateNetworkConfig(config)).toThrow(/public key must be a 64-character hex string/i);
    });

    test("validates keysets", () => {
      const config = {
        type: "pact-server" as const,
        networkId: "development",
        rpcUrl: "http://localhost:8080",
        senderAccount: "sender00",
        keyPairs: [],
        keysets: {
          admin: {
            keys: ["368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"],
            pred: "keys-all" as const,
          },
        },
        meta: {
          chainId: "0" as ChainId,
          gasLimit: 150000,
          gasPrice: 0.00000001,
          ttl: 900,
        },
      };

      expect(() => validateNetworkConfig(config)).not.toThrow();
    });
  });
});
