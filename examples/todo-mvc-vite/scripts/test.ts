import { createScript } from "pact-toolbox";

export default createScript({
  autoStartNetwork: true,
  network: "devnet",
  run: async ({ client, args, logger }) => {
    console.log(args);
    const isDep = await client.isContractDeployed("coin");
    logger.info(`coin is deployed: ${isDep}`);
    const s = await client.deployContract("hello-world", {});
    console.log(s);
    console.log(await client.listModules());
  },
});