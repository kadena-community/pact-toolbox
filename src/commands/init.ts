import { exec } from 'child_process';
import { defineCommand } from 'citty';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { addDependency, detectPackageManager } from 'nypm';
import { join } from 'path';
import { logger } from '../logger';
import { createHelloWorld } from '../pact/helloTemplate';

function defaultConfigTemplate(contractDir: string) {
  return `{
    defaultNetwork: 'local',
    pact: {
      contractsDir: '${contractDir}',
    },
    networks: {
      local: createLocalNetworkConfig({
        serverConfig: {
          port: 9001,
        },
      }),
      devnet: createDevNetNetworkConfig({
        containerConfig: {
          image: 'kadena/devnet',
          tag: 'latest',
          name: 'devnet',
        },
      }),
    },
  }`;
}

export function generateCJSConfigTemplate(contractDir: string) {
  return `const {  createDevNetNetworkConfig, createLocalNetworkConfig, defineConfig } = require('pact-toolbox');

module.exports = defineConfig(${defaultConfigTemplate(contractDir)});`;
}

export function generateESMConfigTemplate(contractDir: string) {
  return `import { createDevNetNetworkConfig, createLocalNetworkConfig, defineConfig } from 'pact-toolbox';

export default defineConfig(${defaultConfigTemplate(contractDir)});`;
}

export function generateConfigTemplate(contractDir: string, isCJS: boolean) {
  return isCJS ? generateCJSConfigTemplate(contractDir) : generateESMConfigTemplate(contractDir);
}

// Function to add a script to package.json
async function addPackageJsonScript(packageJsonPath: string, scriptName: string, scriptCommand: string) {
  const content = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(content);
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts[scriptName] = scriptCommand;
  const updatedPackageJson = JSON.stringify(packageJson, null, 2);
  await writeFile(packageJsonPath, updatedPackageJson, 'utf8');
}

const npmScripts = {
  'pact:local': 'pact-toolbox start local',
  'pact:devnet': 'pact-toolbox start devnet',
  'pact:prelude': 'pact-toolbox prelude',
  'pact:types': 'pact-toolbox types',
};

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Init design sync config',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'path to cwd',
      default: process.cwd(),
    },
    contractsDir: {
      type: 'string',
      description: 'path to contract folder',
      default: 'pact',
    },
  },
  async run({ args }) {
    const type = await readFile(`${args.cwd}/package.json`, 'utf8').then((content) => {
      const pkgJson = JSON.parse(content);
      return pkgJson.type;
    });
    const isCJS = type !== 'module';
    const isTypescript = existsSync(`${args.cwd}/tsconfig.json`);
    const template = generateConfigTemplate(args.contractsDir, isCJS);

    const deps = ['pact-toolbox', '@kadena/client'];
    logger.start(`Installing dependencies ${deps.join(', ')} ...`);
    const packageManager = await detectPackageManager(args.cwd, {
      includeParentDirs: true,
    });
    for (const dep of deps) {
      await addDependency(dep, { cwd: args.cwd, silent: true, packageManager });
      logger.success(`Installed ${dep}`);
    }
    const configPath = isTypescript ? 'pact-toolbox.config.ts' : 'pact-toolbox.config.js';
    await writeFile(join(args.cwd, configPath), template);
    logger.success(`Config file created at ${configPath}`);
    const pkgJsonPath = join(args.cwd, 'package.json');
    try {
      for (const [scriptName, scriptCommand] of Object.entries(npmScripts)) {
        await addPackageJsonScript(pkgJsonPath, scriptName, scriptCommand);
      }
    } catch (e) {
      logger.warn(`Failed to add pact:* scripts to package.json at ${pkgJsonPath}, please add manually`);
    }
    await createHelloWorld(join(args.cwd, args.contractsDir));
    exec('npm run pact:prelude', { cwd: args.cwd });
    logger.box(`You are ready to go!`);
  },
});
