import { KeysetConfig } from '@pact-toolbox/config';
import type { DeployContractParams, PactToolboxRuntime } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { deployPactDependency } from '../../../deployPrelude';
import type { PactDependency, PactPrelude } from '../../../types';
import { preludeSpec, renderTemplate } from '../../../utils';
export const marmaladeRepoUrl = 'gh:salamaashoush/pact';
export function marmaladePath(path: string) {
  return `${marmaladeRepoUrl}/${path}#main`;
}

export const marmaladeSpecs: Record<string, PactDependency[]> = {
  kip: [
    preludeSpec('account-protocols-v1.pact', marmaladePath('kip/account-protocols-v1.pact'), 'kip'),
    preludeSpec('manifest.pact', marmaladePath('kip/manifest.pact'), 'kip'),
    preludeSpec('token-policy-v2.pact', marmaladePath('kip/token-policy-v2.pact'), 'kip'),
    preludeSpec('poly-fungible-v3.pact', marmaladePath('kip/poly-fungible-v3.pact'), 'kip'),
  ],
  util: [
    preludeSpec('fungible-util.pact', marmaladePath('util/fungible-util.pact'), 'util'),
    preludeSpec('guards1.pact', marmaladePath('util/guards1.pact'), 'util'),
  ],
  'marmalade-v2': [
    preludeSpec('ledger.interface.pact', marmaladePath('ledger/ledger.interface.pact'), 'marmalade-v2'),
    preludeSpec('sale.interface.pact', marmaladePath('policy-manager/sale.interface.pact'), 'marmalade-v2'),
    preludeSpec('policy-manager.pact', marmaladePath('policy-manager/policy-manager.pact'), 'marmalade-v2'),
    preludeSpec('ledger.pact', marmaladePath('ledger/ledger.pact'), 'marmalade-v2'),

    // Concrete policies
    preludeSpec(
      'collection-policy-v1.pact',
      marmaladePath('concrete-policies/collection-policy/collection-policy-v1.pact'),
      'marmalade-v2',
    ),
    preludeSpec(
      'guard-policy-v1.pact',
      marmaladePath('concrete-policies/guard-policy/guard-policy-v1.pact'),
      'marmalade-v2',
    ),
    preludeSpec(
      'non-fungible-policy-v1.pact',
      marmaladePath('concrete-policies/non-fungible-policy/non-fungible-policy-v1.pact'),
      'marmalade-v2',
    ),
    preludeSpec(
      'royalty-policy-v1.pact',
      marmaladePath('concrete-policies/royalty-policy/royalty-policy-v1.pact'),
      'marmalade-v2',
    ),

    // init
    preludeSpec('manager-init.pact', marmaladePath('policy-manager/manager-init.pact'), 'marmalade-v2'),

    // util
    preludeSpec('util-v1.pact', marmaladePath('marmalade-util/util-v1.pact'), 'marmalade-v2'),
  ],
  'marmalade-sale': [
    preludeSpec(
      'conventional-auction.pact',
      marmaladePath('sale-contracts/conventional-auction/conventional-auction.pact'),
      'marmalade-sale',
    ),
    preludeSpec(
      'dutch-auction.pact',
      marmaladePath('sale-contracts/dutch-auction/dutch-auction.pact'),
      'marmalade-sale',
    ),
  ],
};

export default {
  name: 'kadena/marmalade',
  specs: marmaladeSpecs,
  requires: ['kadena/chainweb'],
  async shouldDeploy(runtime: PactToolboxRuntime) {
    return false;
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
    let { signer } = params;
    if (!signer) {
      signer = 'sender00';
    }
    const keys = runtime.getSigner(signer);
    const keysets = {
      'marmalade-admin': {
        keys: [keys.publicKey],
        pred: 'keys-all',
      },
      'marmalade-user': {
        keys: [keys.publicKey],
        pred: 'keys-all',
      },
    } as Record<string, KeysetConfig>;

    // deploy  util
    for (const dep of marmaladeSpecs.util) {
      await deployPactDependency(dep, runtime, {
        ...params,
        data: {
          ns: 'kip',
          ...params.data,
        },
        keysets,
        signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }

    // deploy kip
    for (const dep of marmaladeSpecs.kip) {
      await deployPactDependency(dep, runtime, {
        ...params,
        data: {
          ns: 'kip',
          ...params.data,
        },
        keysets,
        signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }

    // deploy  marmalade-v2
    for (const dep of marmaladeSpecs['marmalade-v2']) {
      await deployPactDependency(dep, runtime, {
        ...params,
        data: {
          ns: 'marmalade-v2',
          ...params.data,
        },
        keysets,
        signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }

    // deploy  marmalade-sale
    for (const dep of marmaladeSpecs['marmalade-sale']) {
      await deployPactDependency(dep, runtime, {
        ...params,
        data: {
          ns: 'marmalade-sale',
          ...params.data,
        },
        keysets,
        signer,
      });
      logger.success(`Deployed ${dep.name}`);
    }
  },
} as PactPrelude;
