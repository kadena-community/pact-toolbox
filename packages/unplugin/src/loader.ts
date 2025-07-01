import type { PactToolboxConfigObj } from "@pact-toolbox/config";

import { getDefaultNetworkConfig, isLocalNetwork, resolveConfig } from "@pact-toolbox/config";
import { PactDeployer } from "@pact-toolbox/deployer";
import { logger, writeFile } from "@pact-toolbox/node-utils";

import { createPactToJSTransformer } from "./transform";
import { prettyPrintError } from "./plugin/utils";

const cache = {
  resolvedConfig: undefined as PactToolboxConfigObj | undefined,
  deployer: undefined as PactDeployer | undefined,
};
const transformPactToJS = createPactToJSTransformer({
  debug: process.env["DEBUG"] === "true" || process.env["DEBUG"] === "1" || process.env.NODE_ENV === "development",
});

async function transformAndDeploy(id: string, src: string) {
  if (!cache.resolvedConfig) {
    cache.resolvedConfig = await resolveConfig();
  }

  if (!cache.deployer) {
    cache.deployer = new PactDeployer(cache.resolvedConfig);
  }

  const { code, types, modules, sourceMap } = await transformPactToJS(src, id);
  try {
    const deployer = cache.deployer;
    const isDeployed =
      modules.length > 0
        ? (await Promise.all(modules.map((m) => deployer?.isContractDeployed(m.path)))).every(Boolean)
        : false;
    await writeFile(`${id}.d.ts`, types);
    // TODO: Deploy only in dev mode
    const networkConfig = getDefaultNetworkConfig(cache.resolvedConfig);
    if (isLocalNetwork(networkConfig)) {
      logger.info(`[pactLoader] Deploying contract ${id} to ${networkConfig.name}`);
      // Extract contract name from module path
      const contractName = modules[0]?.path || id;
      // Use the deploy method from PactDeployer with custom data
      await deployer.deploy(contractName, {
        skipIfAlreadyDeployed: isDeployed,
        data: {
          upgrade: isDeployed,
          init: !isDeployed,
        },
      });
      logger.success(`[pactLoader] Successfully deployed contract ${id} to ${networkConfig.name}`);
    }
    return { code, sourceMap };
  } catch (error) {
    prettyPrintError(`[pactLoader] Failed to deploy contract ${id}`, error);
    return { code, sourceMap };
  }
}

export function pactLoader(this: any, contents: string): void {
  this.cacheable && this.cacheable();
  const callback = this.async();
  const id = this.resourcePath.replace(this.rootContext, "");
  transformAndDeploy(id, contents)
    .then((result) => {
      // Webpack loader callback: callback(error, source, sourceMap, meta)
      callback(null, result.code, result.sourceMap ? JSON.parse(result.sourceMap) : null);
    })
    .catch(callback);
}

export default pactLoader;
