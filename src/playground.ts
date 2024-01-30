import { logger } from './logger';
import { setupPactTestEnv } from './pact';

const devnetStart = Date.now();
const devnet = await setupPactTestEnv();
await devnet.client.deployContract('hello-world.pact');
logger.success('Deployed hello-world.pact');
await devnet.client.runPact('(free.hello-world.say-hello "Salama")');
logger.success('Ran hello-world.say-hello');
await devnet.stop();
const devnetEnd = Date.now();

const localStart = Date.now();
const local = await setupPactTestEnv('local');
await local.client.deployContract('hello-world.pact');
logger.success('Deployed hello-world.pact');
await local.client.runPact('(free.hello-world.say-hello "Salama")');
logger.success('Ran hello-world.say-hello');
await local.stop();
const localEnd = Date.now();

const devNetDelta = devnetEnd - devnetStart;
const localDelta = localEnd - localStart;
logger.success(`Devnet: ${devNetDelta / 1000}s`);
logger.success(`Local: ${localDelta / 1000}s`);
// log which is faster and by how much x times
logger.box(
  localDelta < devNetDelta
    ? `Local is faster by ${devNetDelta / localDelta} times`
    : `Devnet is faster by ${localDelta / devNetDelta} times`,
);
