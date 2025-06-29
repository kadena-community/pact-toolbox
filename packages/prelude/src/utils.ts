import type { GitInfo } from "giget";

import type {
  PreludeDefinition,
  RepositoryConfig,
  FileSpec,
  NamespaceConfig,
  DeploymentGroup,
  KeysetTemplate,
} from "./types";

import type { PactToolboxClient } from "@pact-toolbox/runtime";

const inputRegex = /^(?<provider>[\w-.]+):(?<repo>[\w.-]+\/[\w.-]+)(?<subdir>[^#]+)?#?(?<ref>[\w./-]+)?/;
const providerShortcuts: Record<string, string> = {
  gh: "github",
  gl: "gitlab",
  bb: "bitbucket",
  sh: "sourcehut",
};

export function parseGitURI(input: string): GitInfo {
  const m = input.match(inputRegex)?.groups || {};
  const provider = m["provider"] || "github";
  return {
    provider: (providerShortcuts[provider] || provider) as GitInfo["provider"],
    repo: m["repo"] || "",
    subdir: m["subdir"] || "/",
    ref: m["ref"] ?? "main",
  };
}

export function getBaseRepo(uri: string) {
  const { provider, repo, ref } = parseGitURI(uri);
  return `${provider}:${repo}#${ref}`;
}

// Removed legacy preludeSpec function - use new file() factory instead

export function renderTemplate(template: string, data: any): string {
  // Simple template replacement for {{variable}} patterns
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(value));
  }
  return result;
}
/**
 * Topologically sort an iterable of edges.
 *
 * @param edges - The iterable object of edges to sort.
 *   An edge is represented as a 2-tuple of `[fromNode, toNode]`.
 *
 * @returns The topologically sorted array of nodes.
 *
 * #### Notes
 * If a cycle is present in the graph, the cycle will be ignored and
 * the return value will be only approximately sorted.
 *
 * #### Example
 * ```typescript *
 * let data = [
 *   ['d', 'e'],
 *   ['c', 'd'],
 *   ['a', 'b'],
 *   ['b', 'c']
 * ];
 *
 * topologicSort(data);  // ['a', 'b', 'c', 'd', 'e']
 * ```
 */
export function topologicSort<T>(edges: Iterable<[T, T]>): T[] {
  // Setup the shared sorting state.
  const sorted: T[] = [];
  const visited = new Set<T>();
  const graph = new Map<T, T[]>();

  // Add the edges to the graph.
  for (const edge of edges) {
    addEdge(edge);
  }

  // Visit each node in the graph.
  for (const [k] of graph) {
    visit(k);
  }

  // Return the sorted results.
  return sorted;

  // Add an edge to the graph.
  function addEdge(edge: [T, T]): void {
    const [fromNode, toNode] = edge;
    const children = graph.get(toNode);
    if (children) {
      children.push(fromNode);
    } else {
      graph.set(toNode, [fromNode]);
    }
  }

  // Recursively visit the node.
  function visit(node: T): void {
    if (visited.has(node)) {
      return;
    }
    visited.add(node);
    const children = graph.get(node);
    if (children) {
      for (const child of children) {
        visit(child);
      }
    }
    sorted.push(node);
  }
}

export function sortPreludesNames(preludes: PreludeDefinition[]): string[] {
  // Convert to an array of edges
  const edges: [string, string][] = [];
  for (const prelude of preludes) {
    if (!prelude?.dependencies || prelude?.dependencies?.length === 0) {
      // Ensure that nodes without dependencies are also included
      edges.push([prelude.id, prelude.id]);
    } else {
      for (const requirement of prelude.dependencies) {
        edges.push([requirement, prelude.id]);
      }
    }
  }

  // Perform the topological sort
  return topologicSort(edges);
}

export function sortPreludes(preludes: PreludeDefinition[]): PreludeDefinition[] {
  const sortedNames = sortPreludesNames(preludes);
  const sortedPreludes: PreludeDefinition[] = [];
  for (const name of sortedNames) {
    const prelude = preludes.find((p) => p.id === name);
    if (prelude) {
      sortedPreludes.push(prelude);
    }
  }
  return sortedPreludes;
}

// Factory functions for improved prelude definition system

/**
 * Factory function for creating repository configurations
 */
export function repository(
  org: string,
  repo: string,
  options?: { branch?: string; basePath?: string },
): RepositoryConfig {
  return {
    provider: "github",
    org,
    repo,
    branch: options?.branch || "main",
    basePath: options?.basePath,
  };
}

/**
 * Factory function for creating file specifications
 */
export function file(name: string, options?: { path?: string; checksum?: string; version?: string }): FileSpec {
  return {
    name,
    path: options?.path || name,
    checksum: options?.checksum,
    version: options?.version,
  };
}

/**
 * Factory function for creating namespace configurations
 */
export function namespace(name: string, keysets: string[], options?: { create?: boolean }): NamespaceConfig {
  return {
    name,
    keysets,
    create: options?.create ?? true,
  };
}

/**
 * Factory function for creating deployment groups
 */
export function deploymentGroup(
  name: string,
  files: FileSpec[],
  options?: {
    namespace?: string;
    dependsOn?: string[];
    optional?: boolean;
    shouldDeploy?: (client: PactToolboxClient) => Promise<boolean>;
  },
): DeploymentGroup {
  return {
    name,
    files,
    namespace: options?.namespace,
    dependsOn: options?.dependsOn,
    optional: options?.optional,
    shouldDeploy: options?.shouldDeploy,
  };
}

/**
 * Factory function for creating keyset templates
 */
export function keysetTemplate(
  name: string,
  keys: "admin" | "user" | "operator" | string[],
  pred: "keys-all" | "keys-any" | "keys-2" | string = "keys-all",
): KeysetTemplate {
  return { name, keys, pred };
}

/**
 * Helper class for common deployment conditions
 */
export class DeploymentConditions {
  /** Skip deployment on chainweb networks (production) */
  static skipOnChainweb(): { skipOnNetworks: "chainweb"[] } {
    return {
      skipOnNetworks: ["chainweb"],
    };
  }

  /** Only deploy if specific contracts are missing */
  static ifContractsMissing(contracts: string[]): { requireMissingContracts: string[] } {
    return {
      requireMissingContracts: contracts,
    };
  }

  /** Only deploy if specific namespaces are missing */
  static ifNamespacesMissing(namespaces: string[]): { requireMissingNamespaces: string[] } {
    return {
      requireMissingNamespaces: namespaces,
    };
  }

  /** Combine multiple conditions */
  static combine(
    ...conditions: Array<{
      skipOnNetworks?: ("chainweb" | "pact-server" | "local")[];
      requireMissingContracts?: string[];
      requireMissingNamespaces?: string[];
    }>
  ): {
    skipOnNetworks?: ("chainweb" | "pact-server" | "local")[];
    requireMissingContracts?: string[];
    requireMissingNamespaces?: string[];
  } {
    return conditions.reduce(
      (acc, condition) => ({
        skipOnNetworks: [...(acc.skipOnNetworks || []), ...(condition.skipOnNetworks || [])],
        requireMissingContracts: [...(acc.requireMissingContracts || []), ...(condition.requireMissingContracts || [])],
        requireMissingNamespaces: [
          ...(acc.requireMissingNamespaces || []),
          ...(condition.requireMissingNamespaces || []),
        ],
      }),
      {} as any,
    );
  }
}

// Export as both class and legacy object for backward compatibility
export const deploymentConditions: typeof DeploymentConditions = DeploymentConditions;
