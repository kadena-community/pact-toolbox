import type { PactToolboxConfigObj } from "@pact-toolbox/config";

import { getNetworkConfig, isLocalNetwork, resolveConfig } from "@pact-toolbox/config";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { writeFileAtPath } from "@pact-toolbox/utils";

import { createPactToJSTransformer } from "./transformer/pactToJS";

const cache = {
  resolvedConfig: undefined as PactToolboxConfigObj | undefined,
  client: undefined as PactToolboxClient | undefined,
};
const transformPactToJS = createPactToJSTransformer();

async function transformAndDeploy(id: string, src: string) {
  if (!cache.resolvedConfig) {
    cache.resolvedConfig = await resolveConfig();
  }

  if (!cache.client) {
    cache.client = new PactToolboxClient(cache.resolvedConfig);
  }

  const { code, types, modules } = transformPactToJS(src);
  try {
    const client = cache.client;
    const isDeployed =
      modules.length > 0
        ? (await Promise.all(modules.map((m) => client?.isContractDeployed(m.path)))).every(Boolean)
        : false;
    await writeFileAtPath(`${id}.d.ts`, types);
    // TODO: Deploy only in dev mode
    if (isLocalNetwork(getNetworkConfig(cache.resolvedConfig))) {
      client.deployCode(src, {
        build: {
          upgrade: isDeployed,
          init: !isDeployed,
        },
      });
    }
    return code;
  } catch (error) {
    console.error(`Failed to deploy contract ${id}:`, error);
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
