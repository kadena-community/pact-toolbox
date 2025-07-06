import type { NetworkMeta } from "@pact-toolbox/types";
import {
  DEFAULT_GAS_LIMIT,
  DEFAULT_GAS_PRICE,
  DEFAULT_TTL,
  DEFAULT_KEY_PAIRS,
  DEFAULT_KEY_PAIRS_OBJECT,
  DEFAULT_KEYSETS,
} from "@pact-toolbox/network-config";
import { join } from "pathe";

import type { PactToolboxConfigObj } from "./config";

// Re-export shared constants
export {
  DEFAULT_GAS_LIMIT,
  DEFAULT_GAS_PRICE,
  DEFAULT_TTL,
  DEFAULT_KEY_PAIRS,
  DEFAULT_KEY_PAIRS_OBJECT,
  DEFAULT_KEYSETS,
} from "@pact-toolbox/network-config";

// Legacy camelCase exports for backwards compatibility in config package
export {
  DEFAULT_KEY_PAIRS as defaultKeyPairs,
  DEFAULT_KEY_PAIRS_OBJECT as defaultKeyPairsObject,
  DEFAULT_KEYSETS as defaultKeysets,
} from "@pact-toolbox/network-config";

/**
 * Default transaction metadata
 */
export const defaultMeta: NetworkMeta = {
  ttl: DEFAULT_TTL,
  gasLimit: DEFAULT_GAS_LIMIT,
  gasPrice: DEFAULT_GAS_PRICE,
  chainId: "0",
};

/**
 * Default directory for Chainweb configuration files
 */
export const chainwebConfigDir: string = join(process.cwd(), ".pact-toolbox/chainweb");

/**
 * Default configuration for pact-toolbox
 */
export const defaultConfig: PactToolboxConfigObj = {
  defaultNetwork: "pactServer",
  networks: {
    pactServer: {
      type: "pact-server" as const,
      rpcUrl: "http://localhost:{port}",
      networkId: "development",
      keyPairs: DEFAULT_KEY_PAIRS,
      keysets: DEFAULT_KEYSETS,
      senderAccount: "sender00",
      autoStart: true,
      serverConfig: {
        port: 9091,
        logDir: ".pact-toolbox/pact/logs",
        persistDir: ".pact-toolbox/pact/persist",
        verbose: true,
        pragmas: [],
        execConfig: ["DisablePact44", "AllowReadInLocal"],
        gasLimit: 150000,
        gasRate: 0.01,
        entity: "entity",
      },
      meta: defaultMeta,
      name: "pactServer",
    },
  },
  contractsDir: "pact",
  scriptsDir: "scripts",
  preludes: ["kadena/chainweb"],
  deployPreludes: true,
  downloadPreludes: true,
};
