import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import type { PactToolboxClient } from "@pact-toolbox/runtime";
import { downloadTemplate } from "giget";
import { join } from "pathe";

import { logger, writeFile } from "@pact-toolbox/utils";

import type { CommonPreludeOptions, PactDependency, PactPrelude } from "./types";
import { resolvePreludes } from "./resolvePrelude";
import { getBaseRepo, parseGitURI, renderTemplate, sortPreludesNames } from "./utils";

/**
 * Group PactDependency objects by their base repository.
 *
 * @param specs - Array of PactDependency objects.
 * @returns An object where the keys are repository URLs and the values are arrays of PactDependency objects.
 */
export function groupByBaseRepo(specs: PactDependency[]): Record<string, PactDependency[]> {
  const groups: Record<string, PactDependency[]> = {};
  for (const spec of specs) {
    const repo = getBaseRepo(spec.uri);
    if (!groups[repo]) {
      groups[repo] = [];
    }
    groups[repo]?.push(spec);
  }
  return groups;
}

// Define a temporary directory path
const tempDir = join(process.cwd(), ".pact-toolbox/tmp");

/**
 * Download a Git repository to a specified destination.
 *
 * @param dest - Destination directory path.
 * @param uri - Git repository URI.
 * @param force - Whether to force download even if the destination exists.
 * @param preferOffline - Whether to prefer offline download.
 */
export async function downloadGitRepo(dest: string, uri: string, force = false, preferOffline = false): Promise<void> {
  if (!existsSync(dest) || force) {
    await downloadTemplate(uri, {
      dir: dest,
      cwd: process.cwd(),
      force: true,
      silent: false,
      preferOffline,
    });
  }
}

/**
 * Download a specific PactDependency to a given directory.
 *
 * @param dep - The PactDependency object to download.
 * @param preludeDir - The directory to download the dependency into.
 */
export async function downloadPactDependency(dep: PactDependency, preludeDir: string): Promise<void> {
  const dir = join(preludeDir, dep.group || "root");
  let uri = dep.uri;
  const { subdir, repo, provider, ref } = parseGitURI(dep.uri);
  const isSingleFile = subdir.endsWith(".pact");
  if (isSingleFile) {
    uri = `${provider}:${repo}#${ref}`;
  }

  try {
    const clonePath = join(tempDir, dep.group || "root");
    await downloadGitRepo(clonePath, uri, false);
    if (isSingleFile) {
      const fileName = subdir.split("/").pop() ?? dep.name;
      await cp(join(clonePath, fileName), join(dir, dep.name), {
        recursive: true,
      });
    }
  } catch (e) {
    throw new Error(`Failed to download ${dep.name} from ${uri}, ${e}`);
  }

  if (dep.requires) {
    await Promise.all(dep.requires.map((dep) => downloadPactDependency(dep, preludeDir)));
  }
}

/**
 * Download a specific PactPrelude and its dependencies.
 *
 * @param prelude - The PactPrelude object to download.
 * @param preludesDir - The directory to download the prelude into.
 * @param client - The PactToolboxClient instance.
 * @param allPreludes - An array of all available preludes.
 * @param downloaded - A set of already downloaded prelude names.
 */
export async function downloadPrelude(
  prelude: PactPrelude,
  preludesDir: string,
  client: PactToolboxClient,
  allPreludes: PactPrelude[] = [],
  downloaded: Set<string> = new Set(),
): Promise<void> {
  if (downloaded.has(prelude.name)) {
    return;
  }
  if (prelude.requires) {
    for (const dep of prelude.requires) {
      const found = allPreludes.find((p) => p.name === dep);
      if (!found) {
        throw new Error(`Prelude ${dep} not found`);
      }

      if (downloaded.has(dep)) {
        continue;
      }
      await downloadPrelude(found, preludesDir, client, allPreludes, downloaded);
    }
  }
  const preludeDir = join(preludesDir, prelude.name);
  const specs = Array.isArray(prelude.specs) ? prelude.specs : Object.values(prelude.specs).flat();
  const groups = groupByBaseRepo(specs);
  for (const [repo, specs] of Object.entries(groups)) {
    const clonePath = join(tempDir, prelude.name);
    await downloadGitRepo(clonePath, repo, false);
    for (const spec of specs) {
      const dir = join(preludeDir, spec.group || "root");
      const { subdir } = parseGitURI(spec.uri);
      await cp(join(clonePath, subdir), join(dir, spec.name), {
        recursive: true,
      });
    }
  }
  const installScript = await prelude.repl(client);
  await writeFile(join(preludeDir, "install.repl"), installScript);
  downloaded.add(prelude.name);
  logger.success(`Downloaded ${prelude.name} prelude`);
}

/**
 * Create a test tools file for the pact repl tests.
 */
export async function createReplTestTools(config: CommonPreludeOptions): Promise<void> {
  const { preludes, preludesDir } = await resolvePreludes(config);
  // Write accounts repl
  await mkdir(join(preludesDir, "tools"), { recursive: true });
  const accountsTemplate = (await import("./accounts.handlebars")).template;
  await writeFile(
    join(preludesDir, "tools/test-accounts.repl"),
    renderTemplate(accountsTemplate, {
      accounts: config.client.getNetworkConfig().keyPairs ?? [],
    }),
  );
  const initTemplate = (await import("./init.handlebars")).template;
  const preludeNames = sortPreludesNames(preludes);
  await writeFile(
    join(preludesDir, "init.repl"),
    renderTemplate(initTemplate, {
      preludes: preludeNames,
      gasLimit: config.client.getNetworkConfig().meta?.gasLimit || 150000,
    }),
  );
}

/**
 * Download all specified preludes based on the given configuration.
 *
 * @param config - The configuration options for downloading preludes.
 */
export async function downloadAllPreludes(config: CommonPreludeOptions): Promise<void> {
  const downloaded = new Set<string>();
  const { preludes, preludesDir } = await resolvePreludes(config);
  // Clean temp dir
  await rm(tempDir, { recursive: true, force: true });
  // Clean preludes dir
  await rm(preludesDir, { recursive: true, force: true });

  // Download preludes
  for (const prelude of preludes) {
    await downloadPrelude(prelude, preludesDir, config.client, preludes, downloaded);
  }

  // Create a test tools file for the pact repl tests
  await createReplTestTools(config);
}

/**
 * Check if a specific prelude has been downloaded.
 *
 * @param prelude - The PactPrelude object to check.
 * @param preludesDir - The directory to check for the prelude.
 * @returns A boolean indicating whether the prelude has been downloaded.
 */
export function isPreludeDownloaded(prelude: PactPrelude, preludesDir: string): boolean {
  const specs = Array.isArray(prelude.specs) ? prelude.specs : Object.values(prelude.specs).flat();
  const paths = specs.map((spec) => join(preludesDir, prelude.name, spec.group || "root", spec.name));
  return paths.every((p) => existsSync(p));
}

/**
 * Determine if any preludes need to be downloaded based on the configuration.
 *
 * @param config - The configuration options.
 * @returns A boolean indicating whether any preludes need to be downloaded.
 */
export async function shouldDownloadPreludes(config: CommonPreludeOptions): Promise<boolean> {
  const { preludes, preludesDir } = await resolvePreludes(config);
  return preludes.some((p) => !isPreludeDownloaded(p, preludesDir));
}
