import { PactToolboxClient } from '../client';
import { PactToolboxConfigObj, isDevNetworkConfig, isPactServerNetworkConfig, resolveConfig } from '../config';
import { logger } from '../logger';
import { ProcessWrapper } from '../types';
import { deployPreludes } from './deployPrelude';
import { startDevNet } from './devnet';
import { downloadPreludes } from './downloadPrelude';
import { startPactLocalServer } from './localServer';

export interface PactTestEnv {
  client: PactToolboxClient;
  stop: () => Promise<void>;
  config: PactToolboxConfigObj;
}
export async function setupPactTestEnv(
  configOverrides?: Partial<PactToolboxConfigObj> | string,
  client?: PactToolboxClient,
): Promise<PactTestEnv> {
  const config = typeof configOverrides === 'object' ? await resolveConfig(configOverrides) : await resolveConfig();
  const networkName = (typeof configOverrides === 'string' ? configOverrides : config.defaultNetwork) || 'local';
  config.defaultNetwork = networkName;
  if (!client) {
    client = new PactToolboxClient(config);
  }
  if (config.pact.downloadPreludes) {
    // download preludes
    await downloadPreludes(config.pact, client);
    logger.success('Downloaded preludes');
  }

  const currentNetwork = config.networks[networkName];

  if (!currentNetwork) {
    logger.fatal(`Network ${networkName} not found in config`);
  }

  let processWrapper: ProcessWrapper | undefined;
  if (isPactServerNetworkConfig(currentNetwork) && currentNetwork.autoStart) {
    // start local server
    processWrapper = await startPactLocalServer(currentNetwork, false);
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
    processWrapper = await startDevNet(currentNetwork);
    logger.success(`Devnet is ready and listening on http://localhost:${currentNetwork.containerConfig?.port || 8080}`);
  }

  // close when unhandled promise rejection
  // process.on('unhandledRejection', (reason) => {
  //   console.log('Unhandled Rejection at:', reason);
  //   pactServer.kill();
  // });

  return {
    stop: async () => processWrapper?.stop(),
    client,
    config,
  };
}
