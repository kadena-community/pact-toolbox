import type { DeployContractParams, PactToolboxClient } from '@pact-toolbox/runtime';
import type { PactDependency, PactPrelude } from '../../../types';
import { preludeSpec } from '../../../utils';

export const marmaladeRepoUrl = 'gh:kadena-io/marmalade/pact';
export function marmaladePath(path: string) {
  return `${marmaladeRepoUrl}/${path}#main`;
}

export const marmaladeSpecs: PactDependency[] = [
  preludeSpec('account-protocols-v1.pact', marmaladePath('kip/account-protocols-v1.pact'), 'marmalade/kip'),
  preludeSpec('fungible-util.pact', marmaladePath('util/fungible-util.pact'), 'marmalade/util'),
  preludeSpec('token-policy-v2.pact', marmaladePath('kip/token-policy-v2.pact'), 'marmalade/kip'),
  preludeSpec('poly-fungible-v3.pact', marmaladePath('kip/poly-fungible-v3.pact'), 'marmalade/kip'),
  preludeSpec('ledger.interface.pact', marmaladePath('ledger/ledger.interface.pact'), 'marmalade/v2'),
  preludeSpec('sale.interface.pact', marmaladePath('policy-manager/sale.interface.pact'), 'marmalade/v2'),
  preludeSpec('policy-manager.pact', marmaladePath('policy-manager/policy-manager.pact'), 'marmalade/v2'),
  preludeSpec('ledger.pact', marmaladePath('ledger/ledger.pact'), 'marmalade/v2'),
  preludeSpec('manager-init.pact', marmaladePath('policy-manager/manager-init.pact'), 'marmalade/v2'),
  preludeSpec('util-v1.pact', marmaladePath('marmalade-util/util-v1.pact'), 'marmalade/v2'),
];

export default {
  name: 'marmalade-v2',
  specs: marmaladeSpecs,
  async repl(client: PactToolboxClient) {
    return '';
  },
  async deploy(client: PactToolboxClient, params: DeployContractParams = {}) {},
} as PactPrelude;
