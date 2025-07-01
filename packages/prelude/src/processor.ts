/**
 * Processor for improved prelude definitions
 * Converts declarative definitions into executable deployment logic
 */

import type { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/node-utils";
import type { PactTransactionBuilder } from "@pact-toolbox/transaction";
import { join } from "pathe";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import type { PreludeDefinition, DeploymentGroup, FileSpec, PactDependency, PatchContext } from "./types";
import { deployPactDependency } from "./deployPrelude";
import { applyPatches } from "./patch-processor";

/**
 * Deploy a prelude definition
 */
export async function deployPrelude(
  definition: PreludeDefinition,
  client: PactToolboxClient,
  params: any = {},
): Promise<void> {
  return await deployImprovedPrelude(definition, client, params);
}

/**
 * Evaluate if a prelude should be deployed
 */
export async function shouldDeployPrelude(definition: PreludeDefinition, client: PactToolboxClient): Promise<boolean> {
  return await evaluateDeploymentConditions(definition, client);
}

/**
 * Generate REPL script for a prelude
 */
export async function generatePreludeRepl(definition: PreludeDefinition, client: PactToolboxClient): Promise<string> {
  return await generateReplScript(definition, client);
}

/**
 * Convert file spec to internal dependency format for download system
 */
export function convertFileToDependency(
  file: FileSpec,
  group: DeploymentGroup,
  definition: PreludeDefinition,
): PactDependency {
  const { repository } = definition;
  const uri = buildRepositoryURI(repository, file.path || file.name);

  return {
    name: file.name,
    uri,
    group: group.namespace || group.name,
    checksum: file.checksum,
    version: file.version,
  };
}

/**
 * Convert prelude definition to dependency list for download system
 */
export function convertToDownloadSpecs(definition: PreludeDefinition): PactDependency[] {
  const specs: PactDependency[] = [];

  for (const group of definition.deploymentGroups) {
    for (const file of group.files) {
      specs.push(convertFileToDependency(file, group, definition));
    }
  }

  return specs;
}

/**
 * Build repository URI from config and file path
 */
function buildRepositoryURI(repository: any, filePath: string): string {
  const { provider, org, repo, branch = "main", basePath } = repository;
  const fullPath = basePath ? `${basePath}/${filePath}` : filePath;

  const providerMap = {
    github: "gh",
    gitlab: "gl",
    bitbucket: "bb",
  };

  const prefix = providerMap[provider as keyof typeof providerMap] || "gh";
  return `${prefix}:${org}/${repo}/${fullPath}#${branch}`;
}

/**
 * Evaluate deployment conditions
 */
async function evaluateDeploymentConditions(
  definition: PreludeDefinition,
  client: PactToolboxClient,
): Promise<boolean> {
  const conditions = definition.deploymentConditions;
  if (!conditions) {
    logger.debug(`No deployment conditions for ${definition.id}, proceeding with deployment`);
    return true;
  }

  logger.debug(`Evaluating deployment conditions for ${definition.id}`);

  // Check network type exclusions
  if (conditions.skipOnNetworks) {
    const networkType = client.getNetworkConfig().type;
    logger.debug(`Checking network type: ${networkType} against skip list: ${conditions.skipOnNetworks.join(", ")}`);
    if (conditions.skipOnNetworks.includes(networkType as any)) {
      logger.info(`Skipping ${definition.id} deployment on ${networkType} network`);
      return false;
    }
  }

  // Check missing contracts requirement
  if (conditions.requireMissingContracts) {
    logger.debug(`Checking if required contracts are missing: ${conditions.requireMissingContracts.join(", ")}`);
    try {
      const contractChecks = await Promise.all(
        conditions.requireMissingContracts.map(async (contract) => {
          const exists = await client.isContractDeployed(contract);
          logger.debug(`Contract ${contract} exists: ${exists}`);
          return exists;
        }),
      );

      const allContractsExist = contractChecks.every((exists) => exists);
      if (allContractsExist) {
        logger.info(`Skipping ${definition.id} deployment - all required contracts exist`);
        return false;
      }
      logger.debug(`Some required contracts are missing, proceeding with deployment`);
    } catch (error) {
      logger.warn(`Error checking contracts for ${definition.id}: ${error}`);
      // If we can't check, assume we need to deploy
    }
  }

  // Check missing namespaces requirement
  if (conditions.requireMissingNamespaces) {
    logger.debug(`Checking if required namespaces are missing: ${conditions.requireMissingNamespaces.join(", ")}`);
    try {
      const namespaceChecks = await Promise.all(
        conditions.requireMissingNamespaces.map(async (ns) => {
          const exists = await client.isNamespaceDefined(ns);
          logger.debug(`Namespace ${ns} exists: ${exists}`);
          return exists;
        }),
      );

      const allNamespacesExist = namespaceChecks.every((exists) => exists);
      if (allNamespacesExist) {
        logger.info(`Skipping ${definition.id} deployment - all required namespaces exist`);
        return false;
      }
      logger.debug(`Some required namespaces are missing, proceeding with deployment`);
    } catch (error) {
      logger.warn(`Error checking namespaces for ${definition.id}: ${error}`);
      // If we can't check, assume we need to deploy
    }
  }

  logger.debug(`Deployment conditions satisfied for ${definition.id}`);

  return true;
}

/**
 * Deploy prelude using deployment groups
 */
async function deployImprovedPrelude(
  definition: PreludeDefinition,
  client: PactToolboxClient,
  params: any = {},
): Promise<void> {
  if (definition.hooks?.beforeDeploy) {
    await definition.hooks.beforeDeploy(client);
  }

  try {
    const preludeDir = join(client.getPreludeDir(), definition.id);
    const keysets = await resolveKeysets(definition, client, params);

    // Create namespaces if needed
    await createNamespaces(definition, client, params, keysets);

    // Deploy groups in dependency order
    const sortedGroups = topologicalSortGroups(definition.deploymentGroups);

    for (const group of sortedGroups) {
      await deployGroup(group, definition, preludeDir, client, params, keysets);
    }

    if (definition.hooks?.afterDeploy) {
      await definition.hooks.afterDeploy(client);
    }
  } catch (error) {
    if (definition.hooks?.onError) {
      await definition.hooks.onError(client, error as Error);
    }
    throw error;
  }
}

/**
 * Resolve keyset templates to actual keysets
 */
async function resolveKeysets(
  definition: PreludeDefinition,
  client: PactToolboxClient,
  params: any,
): Promise<Record<string, any>> {
  const wallet = client.getWallet(params.wallet);
  const signer = await wallet.getAccount();
  const keysets: Record<string, any> = {};

  if (definition.keysetTemplates) {
    for (const template of definition.keysetTemplates) {
      const keys = resolveKeysByType(template.keys, signer);
      keysets[template.name] = {
        keys,
        pred: template.pred,
      };
    }
  }

  return keysets;
}

/**
 * Resolve keys based on type
 */
function resolveKeysByType(keysType: any, signer: any): string[] {
  if (Array.isArray(keysType)) {
    return keysType;
  }

  switch (keysType) {
    case "admin":
    case "user":
    case "operator":
      return [signer.publicKey];
    default:
      return [signer.publicKey];
  }
}

/**
 * Create namespaces as needed
 */
async function createNamespaces(
  definition: PreludeDefinition,
  client: PactToolboxClient,
  _params: any,
  _keysets: Record<string, any>,
): Promise<void> {
  if (!definition.namespaces) {
    logger.debug(`No namespaces defined for ${definition.id}`);
    return;
  }

  logger.info(`Verifying namespaces for ${definition.id}...`);
  for (const nsConfig of definition.namespaces) {
    if (nsConfig.create === false) {
      logger.debug(`Skipping namespace ${nsConfig.name} - creation disabled`);
      continue;
    }

    try {
      const exists = await client.isNamespaceDefined(nsConfig.name);
      if (exists) {
        logger.success(`✓ Namespace ${nsConfig.name} is available`);
      } else {
        logger.warn(`⚠ Namespace ${nsConfig.name} not found - should be created by contract deployment`);
        // Don't throw error here - the namespace should be created by the ns.pact file
        // when the deployment groups are processed
      }
    } catch (error) {
      logger.debug(`Error checking namespace ${nsConfig.name}: ${error}`);
      // Don't throw error for namespace checks - they might not exist yet
    }
  }
}

/**
 * Get memory-patched code for a file during deployment
 * Only applies patches if the file is configured for memory mode
 */
async function getMemoryPatchedCode(
  file: FileSpec,
  group: DeploymentGroup,
  definition: PreludeDefinition,
  preludeDir: string,
  client: PactToolboxClient,
): Promise<string | null> {
  if (!file.patches || file.patches.length === 0) {
    return null;
  }

  // Determine patch mode: group setting > prelude default > default to memory
  const patchMode = group.patchMode || definition.defaultPatchMode || "memory";

  // Skip if patches were already applied to disk
  if (patchMode === "disk") {
    return null;
  }

  const filePath = join(preludeDir, group.namespace || group.name || "root", file.name);

  if (!existsSync(filePath)) {
    logger.warn(`File ${filePath} not found, cannot apply patches`);
    return null;
  }

  // Read the file (may already be patched if disk mode was used)
  const originalCode = await readFile(filePath, "utf-8");

  // Create patch context
  const context: PatchContext = {
    client,
    file,
    group,
    prelude: definition,
  };

  // Apply patches
  const patchedCode = await applyPatches(originalCode, context);

  if (patchedCode !== originalCode) {
    logger.info(`Applied ${file.patches.length} patches to ${file.name} (in-memory)`);
    logger.debug(`Patches applied to ${file.name}: ${file.patches.map((p) => p.description || "unnamed").join(", ")}`);
    return patchedCode;
  }

  return null;
}

/**
 * Deploy a single deployment group
 */
async function deployGroup(
  group: DeploymentGroup,
  definition: PreludeDefinition,
  preludeDir: string,
  client: PactToolboxClient,
  params: any,
  keysets: Record<string, any>,
): Promise<void> {
  logger.debug(`Evaluating deployment group: ${group.name}`);

  // Check if group should be deployed
  if (group.shouldDeploy) {
    const shouldDeploy = await group.shouldDeploy(client);
    if (!shouldDeploy) {
      logger.info(`Skipping deployment group: ${group.name} - conditions not met`);
      return;
    }
  }

  if (group.optional) {
    logger.info(`Deploying optional group: ${group.name}`);
  } else {
    logger.info(`Deploying group: ${group.name}`);
  }

  logger.debug(`Group ${group.name} has ${group.files.length} files to deploy`);

  for (const file of group.files) {
    // Check if memory patches need to be applied
    const patchedCode = await getMemoryPatchedCode(file, group, definition, preludeDir, client);

    // Create patch context
    const context: PatchContext = {
      client,
      file,
      group,
      prelude: definition,
    };

    // Create the base transaction builder
    const baseBuilder = async (tx: PactTransactionBuilder<any, any>) => {
      // Add keysets
      if (keysets && Object.keys(keysets).length > 0) {
        for (const [name, keyset] of Object.entries(keysets)) {
          tx.withKeyset(name, keyset);
        }
      }

      // Apply custom deployment builder if specified
      if (file.deploymentBuilder) {
        return await file.deploymentBuilder(tx, context);
      }

      return tx;
    };

    if (patchedCode) {
      // Deploy using patched code directly (memory mode)
      await client.deployCode(patchedCode, {
        ...params,
        builder: baseBuilder,
        wallet: client.getWallet(params.wallet),
      });
    } else {
      // Deploy normally using file path (no patches or disk mode)
      const dependency = convertFileToDependency(file, group, definition);
      await deployPactDependency(dependency, preludeDir, client, {
        ...params,
        builder: baseBuilder,
        wallet: client.getWallet(params.wallet),
      });
    }

    logger.info(`  ✓ Deployed file: ${file.name}`);
  }
}

/**
 * Topological sort of deployment groups based on dependencies
 */
function topologicalSortGroups(groups: DeploymentGroup[]): DeploymentGroup[] {
  const sorted: DeploymentGroup[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (group: DeploymentGroup) => {
    if (visiting.has(group.name)) {
      throw new Error(`Circular dependency detected involving ${group.name}`);
    }

    if (visited.has(group.name)) {
      return;
    }

    visiting.add(group.name);

    // Visit dependencies first
    if (group.dependsOn) {
      for (const depName of group.dependsOn) {
        const depGroup = groups.find((g) => g.name === depName);
        if (depGroup) {
          visit(depGroup);
        }
      }
    }

    visiting.delete(group.name);
    visited.add(group.name);
    sorted.push(group);
  };

  for (const group of groups) {
    visit(group);
  }

  return sorted;
}

/**
 * Generate REPL script from template
 */
async function generateReplScript(definition: PreludeDefinition, client: PactToolboxClient): Promise<string> {
  if (!definition.replTemplate) {
    // Generate a basic script if no template provided
    return generateBasicReplScript(definition);
  }

  const keys = client.getSignerKeys();
  const context = {
    publicKey: keys.publicKey,
    account: keys.account,
    networkId: client.getNetworkConfig().networkId,
  };

  // Simple template replacement (could use handlebars for more complex templating)
  let script = definition.replTemplate;
  for (const [key, value] of Object.entries(context)) {
    script = script.replace(new RegExp(`{{${key}}}`, "g"), String(value));
  }

  return script;
}

/**
 * Generate basic REPL script if no template is provided
 */
function generateBasicReplScript(definition: PreludeDefinition): string {
  const lines = [`; ${definition.name} - ${definition.description}`, ""];

  for (const group of definition.deploymentGroups) {
    lines.push(`; ${group.name} group`);
    for (const file of group.files) {
      const path = group.namespace ? `${group.namespace}/${file.name}` : file.name;
      lines.push(`(load "${path}")`);
    }
    lines.push("");
  }

  lines.push(`(print "${definition.name} loaded successfully")`);

  return lines.join("\n");
}
