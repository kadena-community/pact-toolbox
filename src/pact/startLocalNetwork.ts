import { PactToolboxClient } from '../client';
import { PactToolboxConfigObj, isDevNetworkConfig, isPactServerNetworkConfig } from '../config';
import { logger } from '../logger';
import { ProcessWrapper } from '../types';
import { deployPreludes } from './deployPrelude';
import { startDevNet } from './devnet';
import { downloadPreludes } from './downloadPrelude';
import { startPactLocalServer } from './localServer';

export async function startLocalNetwork(config: PactToolboxConfigObj, showLogs = false, client?: PactToolboxClient) {
  const networkName = config.defaultNetwork || 'local';
  config.defaultNetwork = networkName;
  const currentNetwork = config.networks[networkName];

  if (!currentNetwork) {
    logger.fatal(`Network ${networkName} not found in config`);
    process.exit(1);
  }
  if (!(isPactServerNetworkConfig(currentNetwork) || isDevNetworkConfig(currentNetwork))) {
    logger.fatal(`Network ${networkName} is not a local or devnet network`);
    process.exit(1);
  }

  if (!client) {
    client = new PactToolboxClient(config);
  }
  if (config.pact.downloadPreludes) {
    // download preludes
    await downloadPreludes(config.pact, client);
    logger.success('Downloaded preludes');
  }

  let processWrapper: ProcessWrapper | undefined;
  if (isPactServerNetworkConfig(currentNetwork) && currentNetwork.autoStart) {
    // start local server
    processWrapper = await startPactLocalServer(currentNetwork, showLogs);
    logger.success(
      `Pact local server started and listening on http://localhost:${currentNetwork.serverConfig?.port || 8080}`,
    );
    if (config.pact.deployPreludes) {
      logger.start('Deploying preludes');
      await deployPreludes(config.pact, client);
      logger.success('Deployed preludes');
    }
  } else if (isDevNetworkConfig(currentNetwork) && currentNetwork.autoStart) {
    // start devnet
    processWrapper = await startDevNet(currentNetwork, showLogs);
    logger.success(`Devnet is ready and listening on http://localhost:${currentNetwork.containerConfig?.port || 8080}`);
  }

  // log all signers and keys
  const signers = currentNetwork.signers || [];
  logger.info('Test accounts:');

  console.table(signers);

  return processWrapper;
}
