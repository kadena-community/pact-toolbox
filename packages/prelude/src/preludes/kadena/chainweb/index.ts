import type { KeysetConfig } from '@pact-toolbox/config';
import type { DeployContractParams, PactToolboxRuntime } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { deployPactDependency } from '../../../deployPrelude';
import { PactDependency, PactPrelude } from '../../../types';
import { preludeSpec, renderTemplate } from '../../../utils';

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
  async shouldDeploy(runtime: PactToolboxRuntime) {
    if (runtime.isChainwebNetwork()) {
      return false;
    }
    const isDeployed = await runtime.isContractDeployed('coin');
    return !isDeployed;
  },
  async repl(runtime: PactToolboxRuntime) {
    const keys = runtime.getSigner();
    const context = {
      publicKey: keys.publicKey,
    };
    const installTemplate = (await import('./install.handlebars')).template;
    return renderTemplate(installTemplate, context);
  },
  async deploy(runtime: PactToolboxRuntime, params: DeployContractParams = {}) {
    const { signer } = params;
    const keys = runtime.getSigner(signer);
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
      await deployPactDependency(dep, runtime, {
        ...params,
        keysets: rootKeysets,
        signer: signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }
    // deploy util prelude
    for (const dep of chainWebSpec.util) {
      logger.start(`Deploying ${dep.name}`);
      await deployPactDependency(dep, runtime, {
        ...params,
        keysets: utilKeysets,
        signer: signer || runtime.network.senderAccount,
      });
      logger.success(`Deployed ${dep.name}`);
    }
  },
} as PactPrelude;
