import { exec } from "child_process";
import { writeFile } from "node:fs/promises";
import { loadFile } from "magicast";
import { addVitePlugin } from "magicast/helpers";
import { addDependency, detectPackageManager } from "nypm";
import { join } from "pathe";
import {
  readPackageJSON,
  readTSConfig,
  resolvePackageJSON,
  resolveTSConfig,
  writePackageJSON,
  writeTSConfig,
} from "pkg-types";

import { logger } from "@pact-toolbox/utils";

import { createHelloWorld } from "./hello";

export function defaultConfigTemplate(contractDir: string) {
  return `{
    contractsDir: '${contractDir}',
    defaultNetwork: 'local',
    networks: {
      local: createLocalNetworkConfig(),
      devnet: createDevNetNetworkConfig(),
      devnetOnDemand: createDevNetNetworkConfig({
        containerConfig: minimalDevNetContainer,
        miningConfig: {
          batchPeriod: 0.05,
        },
      }),
      testnet: createTestNetNetworkConfig(),
      mainnet: createMainNetNetworkConfig(),
    },
  }`;
}

export function generateCJSConfigTemplate(contractDir: string) {
  return `const {
  createDevNetNetworkConfig,
  createLocalNetworkConfig,
  createMainNetNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
  minimalDevNetContainer,
} = require('pact-toolbox');

module.exports = defineConfig(${defaultConfigTemplate(contractDir)});`;
}

export function generateESMConfigTemplate(contractDir: string) {
  return `import {
  createDevNetNetworkConfig,
  createLocalNetworkConfig,
  createMainNetNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
  minimalDevNetContainer,
} from 'pact-toolbox';

export default defineConfig(${defaultConfigTemplate(contractDir)});`;
}

export function generateConfigTemplate(contractDir: string, isCJS: boolean): string {
  return isCJS ? generateCJSConfigTemplate(contractDir) : generateESMConfigTemplate(contractDir);
}

export async function updateViteConfig(): Promise<void> {
  const viteConfig = await loadFile("vite.config.ts");
  addVitePlugin(viteConfig, {
    constructor: "pactVitePlugin",
    from: "@pact-toolbox/unplugin/vite",
    options: {},
  });
}

export const NPM_SCRIPTS = {
  "pact:start": "pact-toolbox start",
  "pact:run": "pact-toolbox run",
  "pact:prelude": "pact-toolbox prelude",
  "pact:types": "pact-toolbox types",
  "pact:test": "pact-toolbox test",
};

export interface InitToolboxArgs {
  cwd: string;
  contractsDir: string;
}

async function installDeps(args: InitToolboxArgs) {
  const deps = ["@kadena/client", "@pact-toolbox/client"];
  const devDeps = ["pact-toolbox", "@pact-toolbox/unplugin"];
  logger.start(`Installing dependencies ${deps.join(", ")} ...`);
  const packageManager = await detectPackageManager(args.cwd, {
    includeParentDirs: true,
  });
  for (const dep of deps) {
    await addDependency(dep, { cwd: args.cwd, silent: true, packageManager });
    logger.success(`Installed ${dep}`);
  }
  for (const dep of devDeps) {
    await addDependency(dep, {
      cwd: args.cwd,
      dev: true,
      silent: true,
      packageManager,
    });
    logger.success(`Installed ${dep}`);
  }
}
export async function initToolbox(args: InitToolboxArgs): Promise<void> {
  await installDeps(args);
  const packageJsonPath = await resolvePackageJSON();
  const tsConfigPath = await resolveTSConfig();
  const packageJson = await readPackageJSON(packageJsonPath);
  const tsConfig = await readTSConfig(tsConfigPath);

  const isCJS = packageJson.type !== "module";
  const isTypescript = !!tsConfig;
  const template = generateConfigTemplate(args.contractsDir, isCJS);

  const configPath = isTypescript ? "pact-toolbox.config.ts" : "pact-toolbox.config.js";
  await writeFile(join(args.cwd, configPath), template);
  logger.success(`Config file created at ${configPath}`);

  // add pact:* scripts to package.json
  try {
    for (const [scriptName, scriptCommand] of Object.entries(NPM_SCRIPTS)) {
      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts[scriptName] = scriptCommand;
    }
    await writePackageJSON(packageJsonPath, packageJson);
    logger.success(`Added pact:* scripts to package.json`);
  } catch (e) {
    logger.warn(`Failed to add pact:* scripts to package.json at ${packageJsonPath}, please add manually`);
  }

  // update tsconfig.json to add ".pact-toolbox/pactjs-generated" in the types array
  try {
    if (tsConfig) {
      tsConfig.compilerOptions = tsConfig.compilerOptions || {};
      tsConfig.compilerOptions.types = tsConfig.compilerOptions.types || [];
      if (!tsConfig.compilerOptions.types.includes(".pact-toolbox/pactjs-generated")) {
        tsConfig.compilerOptions.types.push(".pact-toolbox/pactjs-generated");
      }
      await writeTSConfig(tsConfigPath, tsConfig);
      logger.success(`Added ".pact-toolbox/pactjs-generated" to the types array in tsconfig.json`);
    }
  } catch (e) {
    logger.warn(
      `Failed to add ".pact-toolbox/pactjs-generated" to the types array in tsconfig.json at ${tsConfigPath}, please add manually`,
    );
  }

  logger.start(`Creating hello world contract...`);
  await createHelloWorld(join(args.cwd, args.contractsDir));

  // fetch preludes
  logger.start(`Fetching preludes...`);
  exec("npm run pact:prelude", { cwd: args.cwd });
  logger.box(`You are ready to go!`);
}
