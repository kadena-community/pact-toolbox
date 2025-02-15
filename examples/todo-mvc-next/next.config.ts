import type { NextConfig } from "next";

import withPactToolbox from "@pact-toolbox/unplugin/next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPactToolbox({})(nextConfig);
