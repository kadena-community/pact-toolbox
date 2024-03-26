import { createScript } from 'pact-toolbox';

export default createScript({
  autoStartNetwork: true,
  run: async ({ runtime, args }) => {
    const isDep = await runtime.isContractDeployed('coin');
    const s = await runtime.deployContract('hello-world.pact', {});
  },
});
