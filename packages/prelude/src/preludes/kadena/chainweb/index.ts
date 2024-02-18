import type { KeysetConfig } from '@pact-toolbox/config';
import type { DeployContractParams, PactToolboxRuntime } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { join } from 'node:path';
import { deployPactDependency } from '../../../deployPrelude';
import { PactDependency, PactPrelude } from '../../../types';
import { preludeSpec, renderTemplate } from '../../../utils';

function chainWebPath(path: string) {
  return `gh:kadena-io/chainweb-node/pact/${path}#master`;
}

const chainWebSpec: Record<string, PactDependency[]> = {
  root: [
    preludeSpec('ns.pact', chainWebPath('namespaces/v1/ns.pact')),
    preludeSpec('gas-payer-v1.pact', chainWebPath('gas-payer/gas-payer-v1.pact')),
    preludeSpec('fungible-v2.pact', chainWebPath('coin-contract/v2/fungible-v2.pact')),
    preludeSpec('fungible-xchain-v1.pact', chainWebPath('coin-contract/v4/fungible-xchain-v1.pact')),
    preludeSpec('coin-v6.pact', chainWebPath('coin-contract/v6/coin-v6-install.pact')),
  ],
  util: [
    preludeSpec('util-ns.pact', chainWebPath('util/util-ns.pact'), 'util'),
    preludeSpec('guards.pact', chainWebPath('util/guards.pact'), 'util'),
  ],
};

export default {
  name: 'kadena/chainweb',
  specs: chainWebSpec,
  async shouldDeploy(runtime: PactToolboxRuntime) {
    if (runtime.isChainwebNetwork()) {
      return false;
    }
    if (await runtime.isContractDeployed('coin')) {
      return false;
    }
    return true;
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
    const preludeDir = join(runtime.getPreludeDir(), 'kadena/chainweb');
    // deploy root prelude
    for (const dep of chainWebSpec.root) {
      await deployPactDependency(dep, preludeDir, runtime, {
        ...params,
        keysets: rootKeysets,
        signer: signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }
    // deploy util prelude
    for (const dep of chainWebSpec.util) {
      await deployPactDependency(dep, preludeDir, runtime, {
        ...params,
        keysets: utilKeysets,
        signer: signer || runtime.network.senderAccount,
      });
      logger.success(`Deployed ${dep.name}`);
    }
  },
} as PactPrelude;
