import { createScript } from 'pact-toolbox';

export default createScript({
  autoStartNetwork: true,
  network: 'devnet',
  run: async ({ client }) => {
    const isDeployed = await client.isContractDeployed('free.hello-world');
    await client.deployContract('hello-world.pact', {
      prepareTx: {
        upgrade: isDeployed,
      },
    });
  },
});
