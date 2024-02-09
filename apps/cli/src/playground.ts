import { setupPactTestEnv } from '@pact-toolbox/test';
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
  const local = await setupPactTestEnv('local');
  await local.client.deployContract('hello-world.pact');
  const signer = local.client.getSigner();
  const tx = local.client
    .execution('(free.hello-world.say-hello "Salama")')
    .addSigner(signer.publicKey)
    .createTransaction();
  const signedTx = await local.client.sign(tx);
  console.log(await local.client.submitAndListen(signedTx));
  await local.stop();
});

// localChainweb
await bench('localChainwebOnDemand', async () => {
  const localChainweb = await setupPactTestEnv('localChainweb');
  await localChainweb.client.deployContract('hello-world.pact');
  const signer = localChainweb.client.getSigner();
  const tx = localChainweb.client
    .execution('(free.hello-world.say-hello "Salama")')
    .addSigner(signer.publicKey)
    .createTransaction();
  const signedTx = await localChainweb.client.sign(tx);
  console.log(await localChainweb.client.submitAndListen(signedTx));
  await localChainweb.stop();
});

// // devnetOnDemand
// await bench('devnetOnDemand', async () => {
//   const devnetOnDemand = await setupPactTestEnv('devnetOnDemand');
//   // await devnetOnDemand.client.mineBlocks(1);
//   // await delay(100);
//   await devnetOnDemand.client.deployContract('hello-world.pact');
//   const signer = devnetOnDemand.client.getSigner();
//   const tx = devnetOnDemand.client
//     .execution('(free.hello-world.say-hello "Salama")')
//     .addSigner(signer.publicKey)
//     .createTransaction();
//   const signedTx = await devnetOnDemand.client.sign(tx);
//   console.log(await devnetOnDemand.client.submitAndListen(signedTx));
//   await devnetOnDemand.stop();
// });

// // devnet
// await bench('devnet', async () => {
//   const devnet = await setupPactTestEnv('devnet');
//   // await delay(7000);
//   await devnet.client.deployContract('hello-world.pact');
//   const signer = devnet.client.getSigner();
//   const tx = devnet.client
//     .execution('(free.hello-world.say-hello "Salama")')
//     .addSigner(signer.publicKey)
//     .createTransaction();

//   const signedTx = await devnet.client.sign(tx);
//   console.log(await devnet.client.submitAndListen(signedTx));
//   await devnet.stop();
// });

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
