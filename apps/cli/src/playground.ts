import { createPactTestEnv } from "@pact-toolbox/test";
import { logger } from "@pact-toolbox/utils";

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
async function main() {
  // local
  bench("localPactServer", async () => {
    const local = await createPactTestEnv({
      network: "local",
    });
    await local.start();
    await local.client.deployContract("hello-world.pact");
    const signer = local.client.getSignerKeys();
    await local.client
      .execution('(free.hello-world.say-hello "Salama")')
      .withSigner(signer.publicKey)
      .sign()
      .submitAndListen();
    await local.stop();
  });

  // localChainweb
  // await bench('localChainweb', async () => {
  //   const localChainweb = await createPactTestEnv({
  //     network: 'localChainweb',
  //   });
  //   await localChainweb.start();
  //   await localChainweb.client.deployContract('hello-world.pact');
  //   const signer = localChainweb.client.getSigner();
  //   const tx = localChainweb.client
  //     .execution('(free.hello-world.say-hello "Salama")')
  //     .addSigner(signer.publicKey)
  //     .createTransaction();
  //   const signedTx = await localChainweb.client.sign(tx);
  //   console.log(await localChainweb.client.submitAndListen(signedTx));
  //   await localChainweb.stop();
  // });

  //  devnetOnDemand
  bench("devnetOnDemand", async () => {
    const devnetOnDemand = await createPactTestEnv({
      network: "devnetOnDemand",
    });
    await devnetOnDemand.start();
    await devnetOnDemand.client.deployContract("hello-world.pact");
    const signer = devnetOnDemand.client.getSignerKeys();
    await devnetOnDemand.client
      .execution('(free.hello-world.say-hello "Salama")')
      .withSigner(signer.publicKey)
      .sign()
      .submitAndListen();

    await devnetOnDemand.stop();
  });

  // devnet
  bench("devnet", async () => {
    const devnet = await createPactTestEnv({
      network: "devnet",
    });
    await devnet.start();
    await devnet.client.deployContract("hello-world.pact");
    const signer = devnet.client.getSignerKeys();
    await devnet.client
      .execution('(free.hello-world.say-hello "Salama")')
      .withSigner(signer.publicKey)
      .sign()
      .submitAndListen();

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
    ["", Infinity],
  );

  logger.info(`Fastest: ${fastest[0]}: ${fastest[1]}ms`);
  console.table(table);
}

main().catch(console.error);
