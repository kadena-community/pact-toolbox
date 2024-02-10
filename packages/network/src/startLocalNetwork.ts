import { PactToolboxConfigObj, isLocalNetwork } from '@pact-toolbox/config';
import { deployPreludes, downloadPreludes } from '@pact-toolbox/prelude';
import { PactToolboxClient } from '@pact-toolbox/runtime';
import { logger } from '@pact-toolbox/utils';
import { startChainWeb } from './chainweb';
import { startDevNet } from './devnet';
import { startPactLocalServer } from './pactServer';
import { ProcessWrapper } from './types';

interface StartLocalNetworkOptions {
  silent?: boolean;
  client?: PactToolboxClient;
  logAccounts?: boolean;
}
export async function startLocalNetwork(
  config: PactToolboxConfigObj,
  { client, silent = true, logAccounts }: StartLocalNetworkOptions = {},
) {
  const networkName = config.defaultNetwork || 'local';
  config.defaultNetwork = networkName;
  const currentNetwork = config.networks[networkName];

  if (!currentNetwork) {
    logger.fatal(`Network ${networkName} not found in config`);
    process.exit(1);
  }
  if (!isLocalNetwork(currentNetwork)) {
    logger.fatal(`Network ${networkName} is not a local or devnet network`);
    process.exit(1);
  }

  if (!client) {
    client = new PactToolboxClient(config);
  }
  if (config.pact.downloadPreludes) {
    // download preludes
    await downloadPreludes({
      client,
      contractsDir: config.pact.contractsDir ?? 'contracts',
      preludes: config.pact.preludes ?? [],
    });
    logger.success('Downloaded preludes');
  }

  let processWrapper: ProcessWrapper | undefined;

  switch (currentNetwork.type) {
    case 'pact-server':
      processWrapper = await startPactLocalServer(currentNetwork, silent);
      logger.success(
        `Pact local server started and listening on http://localhost:${currentNetwork.serverConfig?.port || 8080}`,
      );
      if (config.pact.deployPreludes) {
        logger.start('Deploying preludes');
        await deployPreludes({
          client,
          contractsDir: config.pact.contractsDir ?? 'contracts',
          preludes: config.pact.preludes ?? [],
        });
        logger.success('Deployed preludes');
      }
      break;
    case 'chainweb-devnet':
      processWrapper = await startDevNet(currentNetwork, silent);
      logger.success(
        `Devnet is ready and listening on http://localhost:${currentNetwork.containerConfig?.port || 8080}`,
      );
      break;
    case 'chainweb-local':
      processWrapper = await startChainWeb(currentNetwork, silent);
      logger.success(`Local chainweb is ready and listening on http://localhost:${currentNetwork?.proxyPort || 8080}`);
      break;
    default:
      throw new Error(`Unsupported network type`);
  }

  if (logAccounts) {
    // log all signers and keys
    const signers = currentNetwork.signers || [];
    logger.info('Test accounts:');

    console.table(signers);
  }

  return processWrapper;
}
