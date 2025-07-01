/**
 * Processor for improved prelude definitions
 * Converts declarative definitions into executable deployment logic
 */

import type { DeploymentOptions, PactDeployer } from "@pact-toolbox/deployer";
import { logger } from "@pact-toolbox/node-utils";
import type { PactTransactionBuilder } from "@pact-toolbox/transaction";
import { join } from "pathe";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import type { PreludeDefinition, DeploymentGroup, FileSpec, PactDependency, KeysetTemplate } from "./types";
import { deployPactDependency } from "./deployPrelude";
import type { DeploymentCondition } from "./utils";
import type { WalletAccount } from "@pact-toolbox/types";

/**
 * Deploy a prelude definition
 */
export async function deployPrelude(
  definition: PreludeDefinition,
  deployer: PactDeployer,
  options: DeploymentOptions = {},
): Promise<void> {
  return deployImprovedPrelude(definition, deployer, options);
}

/**
 * Evaluate if a prelude should be deployed
 */
export async function shouldDeployPrelude(definition: PreludeDefinition, deployer: PactDeployer): Promise<boolean> {
  console.log(`Evaluating deployment conditions for prelude: ${definition.id}`);
  return evaluateDeploymentConditions(definition, deployer);
}

/**
 * Generate REPL script for a prelude
 */
export async function generatePreludeRepl(definition: PreludeDefinition, deployer: PactDeployer): Promise<string> {
  return generateReplScript(definition, deployer);
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
 * Evaluate skip conditions for a single deployment condition
 * Returns true if deployment should be SKIPPED
 */
async function evaluateSkipConditions(condition: DeploymentCondition, deployer: PactDeployer): Promise<boolean> {
  const skipReasons: boolean[] = [];
  const operator = condition.operator || "some"; // Default to "some" (skip if ANY condition is met)

  // Check network type exclusions - skip if on these networks
  if (condition.skipOnNetworks && condition.skipOnNetworks.length > 0) {
    const networkType = deployer.getNetworkConfig().type;
    const shouldSkip = condition.skipOnNetworks.includes(networkType);
    if (shouldSkip) {
      logger.debug(`Skip reason: Network type ${networkType} is in skipOnNetworks list`);
    }
    skipReasons.push(shouldSkip);
  }

  // Check if contracts exist - skip if ALL required contracts already exist
  if (condition.requireMissingContracts && condition.requireMissingContracts.length > 0) {
    try {
      const contractChecks = await Promise.all(
        condition.requireMissingContracts.map((contract: string) => deployer.isContractDeployed(contract)),
      );
      const allContractsExist = contractChecks.every((exists) => exists);
      if (allContractsExist) {
        logger.debug(`Skip reason: All required contracts already exist`);
      }
      skipReasons.push(allContractsExist);
    } catch (error) {
      logger.debug(`Error checking contracts: ${error}`);
      skipReasons.push(false); // If we can't check, don't skip
    }
  }

  // Check if namespaces exist - skip if ALL required namespaces already exist
  if (condition.requireMissingNamespaces && condition.requireMissingNamespaces.length > 0) {
    try {
      const namespaceChecks = await Promise.all(
        condition.requireMissingNamespaces.map((ns: string) => deployer.isNamespaceDefined(ns)),
      );
      const allNamespacesExist = namespaceChecks.every((exists) => exists);
      if (allNamespacesExist) {
        logger.debug(`Skip reason: All required namespaces already exist`);
      }
      skipReasons.push(allNamespacesExist);
    } catch (error) {
      logger.debug(`Error checking namespaces: ${error}`);
      skipReasons.push(false); // If we can't check, don't skip
    }
  }

  // If no skip reasons were evaluated, default to not skipping
  if (skipReasons.length === 0) return false;

  // Apply the operator logic
  switch (operator) {
    case "every":
      // Skip only if ALL conditions say to skip
      return skipReasons.every((skip) => skip);
    case "some":
      // Skip if ANY condition says to skip (default)
      return skipReasons.some((skip) => skip);
    case "none":
      // Skip unless ALL conditions say to skip (inverse of every)
      return !skipReasons.every((skip) => skip);
    default:
      // Default to "some" behavior
      return skipReasons.some((skip) => skip);
  }
}

/**
 * Evaluate deployment conditions
 */
async function evaluateDeploymentConditions(definition: PreludeDefinition, deployer: PactDeployer): Promise<boolean> {
  const conditions = definition.deploymentConditions;
  if (!conditions) return true; // No conditions means deploy

  // Evaluate the single merged condition object with its operator
  const shouldSkip = await evaluateSkipConditions(conditions, deployer);
  if (shouldSkip) {
    const operator = conditions.operator || "some";
    logger.debug(`Skipping ${definition.id} deployment - conditions met with '${operator}' operator`);
  }
  return !shouldSkip;
}

/**
 * Deploy prelude using deployment groups
 */
async function deployImprovedPrelude(
  definition: PreludeDefinition,
  deployer: PactDeployer,
  options: DeploymentOptions = {},
): Promise<void> {
  if (definition.hooks?.beforeDeploy) {
    await definition.hooks.beforeDeploy(deployer);
  }

  try {
    const preludeDir = join(deployer.getPreludeDir(), definition.id);
    const keysets = await resolveKeysetTemplates(definition.keysetTemplates, deployer, options);

    // Create namespaces if needed
    // await createNamespaces(definition, deployer, options, keysets);

    // Deploy groups in dependency order
    const sortedGroups = topologicalSortGroups(definition.deploymentGroups);

    for (const group of sortedGroups) {
      await deployGroup(group, definition, preludeDir, deployer, {
        ...options,
        capabilities: group.capabilities,
        keysets: {
          ...options.keysets,
          ...keysets,
          ...(await resolveKeysetTemplates(group.keysetTemplates, deployer, options)),
        },
      });
    }

    if (definition.hooks?.afterDeploy) {
      await definition.hooks.afterDeploy(deployer);
    }
  } catch (error) {
    if (definition.hooks?.onError) {
      await definition.hooks.onError(deployer, error as Error);
    }
    throw error;
  }
}

/**
 * Resolve keyset templates to actual keysets
 */
async function resolveKeysetTemplates(
  keysetTemplates: KeysetTemplate[] | undefined,
  deployer: PactDeployer,
  options: DeploymentOptions = {},
): Promise<Record<string, any>> {
  const wallet = deployer.getWallet(options.wallet);
  const signer = await wallet.getAccount();
  const keysets: Record<string, any> = {};

  if (keysetTemplates) {
    for (const template of keysetTemplates) {
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
function resolveKeysByType(keysType: any, signer: WalletAccount): string[] {
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

// Namespace creation functionality removed - not currently used

/**
 * Deploy a single deployment group
 */
async function deployGroup(
  group: DeploymentGroup,
  definition: PreludeDefinition,
  preludeDir: string,
  deployer: PactDeployer,
  options: DeploymentOptions,
): Promise<void> {
  logger.debug(`Evaluating deployment group: ${group.name}`);

  // Check if group should be deployed
  if (group.shouldDeploy) {
    const shouldDeploy = await group.shouldDeploy(deployer);
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
    const dependency = convertFileToDependency(file, group, definition);

    await deployPactDependency(dependency, preludeDir, deployer, options);

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
async function generateReplScript(definition: PreludeDefinition, deployer: PactDeployer): Promise<string> {
  if (!definition.replTemplate) {
    // Generate a basic script if no template provided
    return generateBasicReplScript(definition);
  }

  const keys = deployer.getSignerKeys();
  const context = {
    publicKey: keys?.publicKey || "",
    account: keys?.account || "",
    networkId: deployer.getNetworkConfig().networkId,
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
