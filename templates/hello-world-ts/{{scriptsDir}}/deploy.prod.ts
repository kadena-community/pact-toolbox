import { createScript, getSignerFromEnv, isValidateSigner } from 'pact-toolbox';

export default createScript({
  run: async ({ client, args, logger }) => {
    const isDeployed = await client.isContractDeployed('free.hello-world');
    const signer = getSignerFromEnv(args);
    if (!isValidateSigner(signer)) {
      throw new Error('Invalid signer');
    }
    await client.deployContract('hello-world.pact', {
      signer,
      prepareTx: {
        upgrade: isDeployed,
      },
    });
  },
});
