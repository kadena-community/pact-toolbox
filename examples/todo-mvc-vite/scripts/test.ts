import { createScript } from "pact-toolbox";

export default createScript({
  autoStartNetwork: true,
  run: async ({ client, args }) => {
    const isDep = await client.isContractDeployed("coin");
    const s = await client.deployContract("hello-world.pact", {});
  },
});
