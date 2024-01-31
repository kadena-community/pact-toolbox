import type { DeployContractParams, PactToolboxClient } from '../../../client';
import type { KeysetConfig, PactDependency, PactPrelude } from '../../../config';
import { logger } from '../../../logger';
import { deployPactDependency } from '../../../pact/deployPrelude';
import { preludeSpec } from '../../../pact/utils';
import { renderTemplate } from '../../../utils';

const chainWebRepoUrl = 'gh:kadena-io/chainweb-node/pact';
function chainWebPath(path: string) {
  return `${chainWebRepoUrl}/${path}#master`;
}

const chainWebSpec: Record<string, PactDependency[]> = {
  root: [
    preludeSpec('ns.pact', chainWebPath('namespaces/v1/ns.pact'), 'chainweb/root'),
    preludeSpec('gas-payer-v1.pact', chainWebPath('gas-payer/gas-payer-v1.pact'), 'chainweb/root'),
    preludeSpec('coin-v5.pact', chainWebPath('coin-contract/v5/coin-v5-install.pact'), 'chainweb/root', [
      preludeSpec('fungible-v2.pact', chainWebPath('coin-contract/v2/fungible-v2.pact'), 'chainweb/root'),
      preludeSpec('fungible-xchain-v1.pact', chainWebPath('coin-contract/v4/fungible-xchain-v1.pact'), 'chainweb/root'),
    ]),
  ],
  util: [
    preludeSpec('util-ns.pact', chainWebPath('util/util-ns.pact'), 'chainweb/util'),
    preludeSpec('guards.pact', chainWebPath('util/guards.pact'), 'chainweb/util'),
  ],
};

export default {
  name: 'chainweb',
  specs: chainWebSpec,
  async shouldDeploy(client: PactToolboxClient, config: PactToolboxClient) {
    return client.getConfig().defaultNetwork === 'local';
  },
  async repl(client: PactToolboxClient) {
    const keys = client.getSigner();
    const __dirname = new URL('.', import.meta.url).pathname;
    const context = {
      publicKey: keys.publicKey,
    };
    return renderTemplate((await import('./install.handlebars')).template, context);
  },
  async deploy(client: PactToolboxClient, params: DeployContractParams = {}) {
    const { signer } = params;
    const keys = client.getSigner(signer);
    const rootKeysets = {
      'ns-admin-keyset': {
        keys: [keys.publicKey],
        pred: 'keys-all',
      },
      'ns-operate-keyset': {
        keys: [keys.publicKey],
        pred: 'keys-all',
      },
      'ns-genesis-keyset': { keys: [], pred: '=' },
    } as Record<string, KeysetConfig>;

    const utilKeysets = {
      'util-ns-users': {
        keys: [keys.publicKey],
        pred: 'keys-all',
      },
      'util-ns-admin': {
        keys: [keys.publicKey],
        pred: 'keys-all',
      },
    } as Record<string, KeysetConfig>;
    // deploy root prelude
    for (const dep of chainWebSpec.root) {
      logger.start(`Deploying ${dep.name}`);
      await deployPactDependency(dep, client, {
        ...params,
        keysets: rootKeysets,
        signer: signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }
    // deploy util prelude
    for (const dep of chainWebSpec.util) {
      logger.start(`Deploying ${dep.name}`);
      await deployPactDependency(dep, client, {
        ...params,
        keysets: utilKeysets,
        signer: signer || client.network.senderAccount,
      });
      logger.success(`Deployed ${dep.name}`);
    }
  },
} as PactPrelude;
