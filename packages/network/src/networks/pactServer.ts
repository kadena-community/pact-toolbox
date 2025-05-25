import type { PactServerConfig, PactServerNetworkConfig } from "@pact-toolbox/config";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { rm } from "node:fs/promises";
import { join } from "pathe";

import { createPactServerConfig } from "@pact-toolbox/config";
import {
  getCurrentPactVersion,
  getUuid,
  isAnyPactInstalled,
  isPortTaken,
  logger,
  runBin,
  writeFile,
} from "@pact-toolbox/utils";

import type { ToolboxNetworkApi, ToolboxNetworkStartOptions } from "../types";

export function configToYamlString(config: PactServerConfig): string {
  let configString = `# This is a generated file, do not edit manually\n`;
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      configString += `${key}: [${value.join(", ")}]\n`;
    } else {
      configString += `${key}: ${value}\n`;
    }
  }
  return configString;
}

export function configToJSONString(config: PactServerConfig): string {
  return JSON.stringify(config, null, 2);
}

export async function writePactServerConfig(
  config: PactServerConfig,
  format: "yaml" | "json" = "yaml",
  id: string,
): Promise<string> {
  const toolboxDir = join(process.cwd(), ".pact-toolbox/pact");
  const configPath = join(toolboxDir, id ? `pact-server-config-${id}.${format}` : `pact-server-config.${format}`);
  if (config.persistDir) {
    config.persistDir = id ? `${config.persistDir}-${id}` : config.persistDir;
  }
  if (config.logDir) {
    config.logDir = id ? `${config.logDir}-${id}` : config.logDir;
  }
  // write config to file
  await writeFile(configPath, format === "yaml" ? configToYamlString(config) : configToJSONString(config));
  return configPath;
}

export class PactServerNetwork implements ToolboxNetworkApi {
  public id: string = getUuid();
  #child?: ChildProcessWithoutNullStreams;
  #configPath?: string;
  #serverConfig: PactServerConfig;
  #pactBin = "pact";

  constructor(networkConfig: PactServerNetworkConfig) {
    this.#serverConfig = createPactServerConfig(networkConfig?.serverConfig);
    this.#pactBin = networkConfig.pactBin || this.#pactBin;
  }

  getServicePort(): number {
    return this.#serverConfig.port || 8080;
  }

  hasOnDemandMining() {
    return false;
  }

  getMiningClientUrl() {
    return "";
  }

  getNodeServiceUrl(): string {
    return `http://localhost:${this.getServicePort()}`;
  }

  async start({
    isDetached = true,
    isStateless = false,
    conflictStrategy = "error",
  }: ToolboxNetworkStartOptions = {}): Promise<void> {
    if (await this.isRunning()) {
      if (conflictStrategy === "error") {
        throw new Error(`Pact server is already running on port ${this.#serverConfig.port}`);
      }
      return;
    }
    const isInstalled = await isAnyPactInstalled();
    if (!isInstalled) {
      throw new Error("Pact is not installed, try running `pactup install --latest`");
    }
    if (isStateless) {
      this.#serverConfig.persistDir = undefined;
    }
    this.#configPath = await writePactServerConfig(this.#serverConfig, "yaml", isStateless ? this.id : "");
    const pactVersion = await getCurrentPactVersion();
    logger.info("Using pact version", pactVersion);
    await runBin(this.#pactBin, ["-s", this.#configPath], {
      silent: isDetached,
    });
  }

  async stop(): Promise<void> {
    if (this.#child) {
      this.#child.kill();
      if (this.#configPath) {
        // remove config file
        await rm(this.#configPath, { force: true });
      }
    }
  }

  async restart(options?: ToolboxNetworkStartOptions): Promise<void> {
    await this.stop();
    await this.start(options);
  }

  async isOk(): Promise<boolean> {
    const res = await fetch(this.getNodeServiceUrl());
    if (res.ok) {
      return true;
    }
    return false;
  }

  async isRunning(): Promise<boolean> {
    return (await isPortTaken(this.#serverConfig.port || 8080)) && (await this.isOk());
  }
}
