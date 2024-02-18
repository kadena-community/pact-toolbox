import withPactToolbox from '@pact-toolbox/unplugin/next';

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPactToolbox({
  onReady: async () => {
    console.log('Pact Toolbox is ready');
  },
  startNetwork: true,
})(nextConfig);
