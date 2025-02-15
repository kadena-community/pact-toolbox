import { rm } from "node:fs/promises";
import type { PactServerConfig, PactServerNetworkConfig } from "@pact-toolbox/config";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { join } from "pathe";

import { createPactServerConfig } from "@pact-toolbox/config";
import { getUuid, isAnyPactInstalled, isPortTaken, runBin, writeFileAtPath } from "@pact-toolbox/utils";

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
  await writeFileAtPath(configPath, format === "yaml" ? configToYamlString(config) : configToJSONString(config));
  return configPath;
}

export class PactServerNetwork implements ToolboxNetworkApi {
  public id: string = getUuid();
  private child?: ChildProcessWithoutNullStreams;
  private configPath?: string;
  private serverConfig: Required<PactServerConfig>;
  private pactBin = "pact";

  constructor(private networkConfig: PactServerNetworkConfig) {
    this.serverConfig = createPactServerConfig(this.networkConfig?.serverConfig);
    this.pactBin = this.networkConfig.pactBin || this.pactBin;
  }

  getServicePort(): number | string {
    return this.serverConfig.port;
  }

  hasOnDemandMining() {
    return false;
  }

  getOnDemandMiningUrl() {
    return "";
  }

  getServiceUrl(): string {
    return `http://localhost:${this.getServicePort()}`;
  }

  async start({
    silent = false,
    isStateless = false,
    conflict = "error",
  }: ToolboxNetworkStartOptions = {}): Promise<void> {
    if (await this.isRunning()) {
      if (conflict === "error") {
        throw new Error(`Pact server is already running on port ${this.serverConfig.port}`);
      }
      return;
    }
    const isInstalled = await isAnyPactInstalled();
    if (!isInstalled) {
      throw new Error("Pact is not installed, try running `pactup install --latest`");
    }
    this.configPath = await writePactServerConfig(this.serverConfig, "yaml", isStateless ? this.id : "");
    await runBin(this.pactBin, ["-s", this.configPath], {
      silent,
    });
  }

  async stop(): Promise<void> {
    if (this.child) {
      this.child.kill();
      if (this.configPath) {
        // remove config file
        await rm(this.configPath, { force: true });
      }
    }
  }

  async restart(options?: ToolboxNetworkStartOptions): Promise<void> {
    await this.stop();
    await this.start(options);
  }

  async isOk(): Promise<boolean> {
    const res = await fetch(this.getServiceUrl());
    if (res.ok) {
      return true;
    }
    return false;
  }

  async isRunning(): Promise<boolean> {
    return (await isPortTaken(this.serverConfig.port)) && (await this.isOk());
  }
}

export async function startPactServerNetwork(
  networkConfig: PactServerNetworkConfig,
  startOptions?: ToolboxNetworkStartOptions,
): Promise<PactServerNetwork> {
  const server = new PactServerNetwork(networkConfig);
  await server.start(startOptions);
  return server;
}
