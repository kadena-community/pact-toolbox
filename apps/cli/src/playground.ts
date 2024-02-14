import { createPactTestEnv } from '@pact-toolbox/test';
import { logger } from '@pact-toolbox/utils';

const table: Record<string, number> = {};

async function bench(label: string, f: () => Promise<void>) {
  const start = process.hrtime();
  await f();
  const end = process.hrtime(start);

  const time = end[0] * 1000 + end[1] / 1000000;
  table[label] = time;
  console.log(`${label}: ${time}ms`);
  return time;
}

// local
await bench('localPactServer', async () => {
  const local = await createPactTestEnv({
    network: 'local',
  });
  await local.start();
  await local.runtime.deployContract('hello-world.pact');
  const signer = local.runtime.getSigner();
  const tx = local.runtime
    .execution('(free.hello-world.say-hello "Salama")')
    .addSigner(signer.publicKey)
    .createTransaction();
  const signedTx = await local.runtime.sign(tx);
  console.log(await local.runtime.submitAndListen(signedTx));
  await local.stop();
});

// localChainweb
await bench('localChainweb', async () => {
  const localChainweb = await createPactTestEnv({
    network: 'localChainweb',
  });
  await localChainweb.start();
  await localChainweb.runtime.deployContract('hello-world.pact');
  const signer = localChainweb.runtime.getSigner();
  const tx = localChainweb.runtime
    .execution('(free.hello-world.say-hello "Salama")')
    .addSigner(signer.publicKey)
    .createTransaction();
  const signedTx = await localChainweb.runtime.sign(tx);
  console.log(await localChainweb.runtime.submitAndListen(signedTx));
  await localChainweb.stop();
});

//  devnetOnDemand
await bench('devnetOnDemand', async () => {
  const devnetOnDemand = await createPactTestEnv({
    network: 'devnetOnDemand',
  });
  await devnetOnDemand.start();
  await devnetOnDemand.runtime.deployContract('hello-world.pact');
  const signer = devnetOnDemand.runtime.getSigner();
  const tx = devnetOnDemand.runtime
    .execution('(free.hello-world.say-hello "Salama")')
    .addSigner(signer.publicKey)
    .createTransaction();
  const signedTx = await devnetOnDemand.runtime.sign(tx);
  console.log(await devnetOnDemand.runtime.submitAndListen(signedTx));
  await devnetOnDemand.stop();
});

// devnet
await bench('devnet', async () => {
  const devnet = await createPactTestEnv({
    network: 'devnet',
  });
  await devnet.start();
  await devnet.runtime.deployContract('hello-world.pact');
  const signer = devnet.runtime.getSigner();
  const tx = devnet.runtime
    .execution('(free.hello-world.say-hello "Salama")')
    .addSigner(signer.publicKey)
    .createTransaction();

  const signedTx = await devnet.runtime.sign(tx);
  console.log(await devnet.runtime.submitAndListen(signedTx));
  await devnet.stop();
});

// find the fastest
const fastest = Object.entries(table).reduce(
  (acc, [key, value]) => {
    if (value < acc[1]) {
      return [key, value];
    }
    return acc;
  },
  ['', Infinity],
);

logger.info(`Fastest: ${fastest[0]}: ${fastest[1]}ms`);
console.table(table);
