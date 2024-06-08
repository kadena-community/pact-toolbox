import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

import pactRspack from "@pact-toolbox/unplugin/rspack";

export default defineConfig({
  plugins: [pluginReact()],
  tools: {
    rspack: {
      plugins: [
        pactRspack({
          startNetwork: true,
          onReady: async (client) => {
            console.log("onReady");
            const isDeployed = await client.isContractDeployed("free.todos");
            await client.deployContract("todos.pact", {
              upgrade: isDeployed,
            });
          },
        }),
      ],
    },
  },
});
