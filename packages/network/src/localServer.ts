import type { PactServerConfig, PactServerNetworkConfig } from '@pact-toolbox/config';
import { runBin } from '@pact-toolbox/utils';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { ProcessWrapper } from './types';

export function configToYamlString(config: PactServerConfig) {
  let configString = `# This is a generated file, do not edit manually\n`;
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      configString += `${key}: [${value.join(', ')}]\n`;
    } else {
      configString += `${key}: ${value}\n`;
    }
  }
  return configString;
}

export function configToJSONString(config: PactServerConfig) {
  return JSON.stringify(config, null, 2);
}

export async function writePactServerConfig(config: PactServerConfig, format: 'yaml' | 'json' = 'yaml') {
  const toolboxDir = join(process.cwd(), '.pact-toolbox');
  await mkdir(toolboxDir, { recursive: true });
  const configPath = join(toolboxDir, 'pact-server-config.' + format);
  // write config to file
  await writeFile(configPath, format === 'yaml' ? configToYamlString(config) : configToJSONString(config));
  return configPath;
}

export async function startPactLocalServer(
  networkConfig: PactServerNetworkConfig,
  silent: boolean = true,
): Promise<ProcessWrapper> {
  const serverConfig = networkConfig?.serverConfig ?? {};
  // resolve preludes
  const configPath = await writePactServerConfig(serverConfig as PactServerConfig, 'yaml');
  const process = await runBin('pact', ['-s', configPath], {
    silent,
  });
  return {
    stop: async () => {
      process.kill();
    },
    id: process.pid,
  };
}
