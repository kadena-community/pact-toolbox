/**
 * Processor for improved prelude definitions
 * Converts declarative definitions into executable deployment logic
 */

import type { PactToolboxClient } from "@pact-toolbox/deployer";
import { logger } from "@pact-toolbox/node-utils";
import { join } from "pathe";

import type { PreludeDefinition, DeploymentGroup, FileSpec, PactDependency } from "./types";
import { deployPactDependency } from "./deployPrelude";

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
  if (!conditions) return true;

  // Check network type exclusions
  if (conditions.skipOnNetworks) {
    const networkType = client.getNetworkConfig().type;
    if (conditions.skipOnNetworks.includes(networkType as any)) {
      logger.debug(`Skipping ${definition.id} deployment on ${networkType} network`);
      return false;
    }
  }

  // Check missing contracts requirement
  if (conditions.requireMissingContracts) {
    try {
      const contractChecks = await Promise.all(
        conditions.requireMissingContracts.map((contract) => client.isContractDeployed(contract)),
      );

      const allContractsExist = contractChecks.every((exists) => exists);
      if (allContractsExist) {
        logger.debug(`Skipping ${definition.id} deployment - all required contracts exist`);
        return false;
      }
    } catch (error) {
      logger.debug(`Error checking contracts: ${error}`);
      // If we can't check, assume we need to deploy
    }
  }

  // Check missing namespaces requirement
  if (conditions.requireMissingNamespaces) {
    try {
      const namespaceChecks = await Promise.all(
        conditions.requireMissingNamespaces.map((ns) => client.isNamespaceDefined(ns)),
      );

      const allNamespacesExist = namespaceChecks.every((exists) => exists);
      if (allNamespacesExist) {
        logger.debug(`Skipping ${definition.id} deployment - all required namespaces exist`);
        return false;
      }
    } catch (error) {
      logger.debug(`Error checking namespaces: ${error}`);
      // If we can't check, assume we need to deploy
    }
  }

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
  if (!definition.namespaces) return;

  for (const nsConfig of definition.namespaces) {
    if (nsConfig.create === false) continue;

    try {
      const exists = await client.isNamespaceDefined(nsConfig.name);
      if (!exists) {
        logger.info(`Creating namespace: ${nsConfig.name}`);
        // Namespace creation logic would go here
        // This would depend on how the client handles namespace creation
      }
    } catch (error) {
      logger.debug(`Error checking namespace ${nsConfig.name}: ${error}`);
    }
  }
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
  // Check if group should be deployed
  if (group.shouldDeploy) {
    const shouldDeploy = await group.shouldDeploy(client);
    if (!shouldDeploy) {
      logger.debug(`Skipping deployment group: ${group.name}`);
      return;
    }
  }

  if (group.optional) {
    logger.info(`Deploying optional group: ${group.name}`);
  } else {
    logger.info(`Deploying group: ${group.name}`);
  }

  for (const file of group.files) {
    const dependency = convertFileToDependency(file, group, definition);

    await deployPactDependency(dependency, preludeDir, client, {
      ...params,
      builder: {
        namespace: group.namespace,
        keysets,
      },
      wallet: client.getWallet(params.wallet),
    });

    logger.debug(`✓ Deployed ${file.name}`);
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
