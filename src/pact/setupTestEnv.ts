import { PactToolboxClient } from '../client';
import { PactToolboxConfig, PactToolboxConfigObj, resolveConfig } from '../config';
import { logger } from '../logger';
import { downloadPreludes } from './downloadPrelude';
import { startPactLocalServer } from './localServer';

export interface PactTestEnv {
  client: PactToolboxClient;
  stop: () => void;
  config: PactToolboxConfigObj;
}
export async function setupPactTestEnv(
  configOverrides: PactToolboxConfig = {},
  client?: PactToolboxClient,
): Promise<PactTestEnv> {
  const config = await resolveConfig(configOverrides);
  if (!client) {
    client = new PactToolboxClient(config);
  }
  if (config.pact.downloadPreludes) {
    // download preludes
    await downloadPreludes(config.pact, client);
    logger.success('Downloaded preludes');
  }
  // start local server
  logger.start('Starting Pact local server');
  const pactServer = await startPactLocalServer(config.pact, false, client);
  logger.success(`Pact local server started and listening on http://localhost:${config.pact.server?.port}`);
  process.on('SIGINT', () => {
    pactServer.kill();
    process.exit();
  });
  // close when unhandled promise rejection
  process.on('unhandledRejection', (reason) => {
    console.log('Unhandled Rejection at:', reason);
    pactServer.kill();
    process.exit();
  });

  return {
    stop: () => {
      if (!pactServer.killed) {
        pactServer.kill();
      }
    },
    client,
    config,
  };
}
