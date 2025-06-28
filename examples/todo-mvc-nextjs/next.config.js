import withPactToolbox from "@pact-toolbox/unplugin/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable experimental features if needed
  experimental: {
    // turbo: true, // Enable Turbopack if needed
  },
};

export default withPactToolbox()(nextConfig);