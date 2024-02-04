import { logger } from './logger';
import { setupPactTestEnv } from './pact';
import { delay } from './utils';
let devnet;
let local;
let devnetStart;
let devnetEnd;
let localStart;
let localEnd;

try {
  devnetStart = Date.now();
  devnet = await setupPactTestEnv();
  await devnet.client.mineBlocks(1);
  await delay(5);
  await devnet.client.deployContract('hello-world.pact');
  logger.success('Deployed hello-world.pact');
  const signer = devnet.client.getSigner();
  const tx = devnet.client
    .execution('(free.hello-world.say-hello "Salama")')
    .addSigner(signer.publicKey)
    .createTransaction();

  const signedTx = await devnet.client.sign(tx);
  await devnet.client.submitAndListen(signedTx);
  logger.success('Ran hello-world.say-hello');
  await devnet.stop();
  devnetEnd = Date.now();
} catch (e) {
  await devnet?.stop();
  logger.error(e);
  process.exit(1);
}

try {
  localStart = Date.now();
  local = await setupPactTestEnv('local');
  await local.client.deployContract('hello-world.pact');
  logger.success('Deployed hello-world.pact');
  await local.client.runPact('(free.hello-world.say-hello "Salama")');
  logger.success('Ran hello-world.say-hello');
  await local.stop();
  localEnd = Date.now();
} catch (e) {
  await local?.stop();
  logger.error(e);
  process.exit(1);
}
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
