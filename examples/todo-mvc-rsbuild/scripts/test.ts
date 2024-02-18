import { createScript } from 'pact-toolbox';

export default createScript({
  autoStartNetwork: true,
  run: async ({ runtime, coin, args }) => {
    console.log('Running script', args);
    const s = await coin.accountExists('sender00');
    console.log('From script', s);
  },
});
