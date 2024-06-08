import type { KeysetConfig } from "@pact-toolbox/config";
import type { DeployContractOptions, PactToolboxClient } from "@pact-toolbox/runtime";
import { join } from "pathe";

import { logger } from "@pact-toolbox/utils";

import type { PactDependency, PactPrelude } from "../../../types";
import { deployPactDependency } from "../../../deployPrelude";
import { preludeSpec, renderTemplate } from "../../../utils";

function chainWebPath(path: string) {
  return `gh:kadena-io/chainweb-node/pact/${path}#master`;
}

const chainWebSpec = {
  root: [
    preludeSpec("ns.pact", chainWebPath("namespaces/v1/ns.pact")),
    preludeSpec("gas-payer-v1.pact", chainWebPath("gas-payer/gas-payer-v1.pact")),
    preludeSpec("fungible-v2.pact", chainWebPath("coin-contract/v2/fungible-v2.pact")),
    preludeSpec("fungible-xchain-v1.pact", chainWebPath("coin-contract/v4/fungible-xchain-v1.pact")),
    preludeSpec("coin.pact", chainWebPath("coin-contract/coin-install.pact")),
  ],
  util: [
    preludeSpec("util-ns.pact", chainWebPath("util/util-ns.pact"), "util"),
    preludeSpec("guards.pact", chainWebPath("util/guards.pact"), "util"),
  ],
} satisfies Record<string, PactDependency[]>;

export default {
  name: "kadena/chainweb",
  specs: chainWebSpec,
  async shouldDeploy(client: PactToolboxClient) {
    if (client.isChainwebNetwork()) {
      return false;
    }
    if (await client.isContractDeployed("coin")) {
      return false;
    }
    return true;
  },
  async repl(client: PactToolboxClient) {
    const keys = client.getSigner();
    const context = {
      publicKey: keys.publicKey,
    };
    const installTemplate = (await import("./install.handlebars")).template;
    return renderTemplate(installTemplate, context);
  },
  async deploy(client: PactToolboxClient, params: DeployContractOptions = {}) {
    const { signer } = params;
    const keys = client.getSigner(signer);
    const rootKeysets = {
      "ns-admin-keyset": {
        keys: [keys.publicKey],
        pred: "keys-all",
      },
      "ns-operate-keyset": {
        keys: [keys.publicKey],
        pred: "keys-all",
      },
      "ns-genesis-keyset": { keys: [], pred: "=" },
    } as Record<string, KeysetConfig>;

    const utilKeysets = {
      "util-ns-users": {
        keys: [keys.publicKey],
        pred: "keys-all",
      },
      "util-ns-admin": {
        keys: [keys.publicKey],
        pred: "keys-all",
      },
    } as Record<string, KeysetConfig>;
    const preludeDir = join(client.getPreludeDir(), "kadena/chainweb");
    // deploy root prelude
    for (const dep of chainWebSpec.root) {
      await deployPactDependency(dep, preludeDir, client, {
        ...params,
        prepareTx: {
          keysets: rootKeysets,
        },
        signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }
    // deploy util prelude
    for (const dep of chainWebSpec.util) {
      await deployPactDependency(dep, preludeDir, client, {
        ...params,
        prepareTx: { keysets: utilKeysets },
        signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }
  },
} as PactPrelude;
