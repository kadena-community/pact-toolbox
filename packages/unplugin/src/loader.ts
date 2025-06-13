import type { PactToolboxConfigObj } from "@pact-toolbox/config";

import { getNetworkConfig, isLocalNetwork, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger, writeFile } from "@pact-toolbox/utils";

import { createPactToJSTransformer } from "./transform";
import { prettyPrintError } from "./api";

const cache = {
  resolvedConfig: undefined as PactToolboxConfigObj | undefined,
  client: undefined as PactToolboxClient | undefined,
};
const transformPactToJS = createPactToJSTransformer({
  debug: process.env.DEBUG === "true" || process.env.DEBUG === "1" || process.env.NODE_ENV === "development",
});

async function transformAndDeploy(id: string, src: string) {
  if (!cache.resolvedConfig) {
    cache.resolvedConfig = await resolveConfig();
  }

  if (!cache.client) {
    cache.client = new PactToolboxClient(cache.resolvedConfig);
  }

  const { code, types, modules } = await transformPactToJS(src);
  try {
    const client = cache.client;
    const isDeployed =
      modules.length > 0
        ? (await Promise.all(modules.map((m) => client?.isContractDeployed(m.path)))).every(Boolean)
        : false;
    await writeFile(`${id}.d.ts`, types);
    // TODO: Deploy only in dev mode
    const networkConfig = getNetworkConfig(cache.resolvedConfig);
    if (isLocalNetwork(networkConfig)) {
      logger.start(`[pactLoader] Deploying contract ${id} to ${networkConfig.name}`);
      await client.deployCode(src, {
        build: {
          upgrade: isDeployed,
          init: !isDeployed,
        },
      });
      logger.success(`[pactLoader] Successfully deployed contract ${id} to ${networkConfig.name}`);
    }
    return code;
  } catch (error) {
    prettyPrintError(`[pactLoader] Failed to deploy contract ${id}`, error);
    return code;
  }
}

export function pactLoader(this: any, contents: string): void {
  this.cacheable && this.cacheable();
  const callback = this.async();
  const id = this.resourcePath.replace(this.rootContext, "");
  transformAndDeploy(id, contents)
    .then((code) => {
      callback(null, code);
    })
    .catch(callback);
}

export default pactLoader;
