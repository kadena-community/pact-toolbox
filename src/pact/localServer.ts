import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PactToolboxClient } from '../client';
import { PactConfig, PactServerConfig } from '../config';
import { logger } from '../logger';
import { deployPreludes } from './deployPrelude';

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
  config: PactConfig = {},
  logStdout: boolean = true,
  client?: PactToolboxClient,
): Promise<ChildProcessWithoutNullStreams> {
  // resolve preludes
  const configPath = await writePactServerConfig(config.server as PactServerConfig, 'yaml');
  // a long running process
  const pactProcess = spawn('pact', ['-s', configPath], {
    cwd: process.cwd(),
    env: process.env,
  });
  return new Promise((resolve, reject) => {
    pactProcess.on('error', (err) => {
      reject(err);
    });

    pactProcess.stdout.on('data', (data) => {
      const str = data.toString();
      if (logStdout) console.log(str);
      if (str.includes('[api] starting on port')) {
        if (config.deployPreludes && client) {
          logger.start('Deploying preludes');
          deployPreludes(config, client).then(() => resolve(pactProcess));
          logger.success('Deployed preludes');
        } else {
          resolve(pactProcess);
        }
      }
    });

    pactProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    pactProcess.on('close', (code) => {
      console.log(`Pact: process exited with code ${code}`);
    });

    pactProcess.on('exit', (code) => {
      console.log(`Pact: process exited with code ${code}`);
    });

    process.on('SIGINT', () => {
      pactProcess.kill('SIGINT');
      process.exit(0);
    });
  });
}
