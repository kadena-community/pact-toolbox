import type { PactToolboxClient } from "@pact-toolbox/deployer";
import { downloadTemplate } from "giget";
import {
  existsSync,
  copyFile,
  ensureDir,
  removeDir,
  logger,
  writeFile,
  calculateFileHash,
} from "@pact-toolbox/node-utils";
import { mkdir, rm } from "node:fs/promises";
import { join } from "pathe";

import type { CommonPreludeOptions, PactDependency, PreludeDefinition } from "./types";
import { resolvePreludes } from "./resolvePrelude";
import { getBaseRepo, parseGitURI, sortPreludesNames } from "./utils";
import { convertToDownloadSpecs, generatePreludeRepl } from "./processor";
import { isPreludeCached, updatePreludeCache, removePreludeFromCache, getCacheStats } from "./cache";

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
 * Download a specific PactDependency to a given directory with checksum verification.
 *
 * @param dep - The PactDependency object to download.
 * @param preludeDir - The directory to download the dependency into.
 * @param validateChecksum - Whether to validate the checksum after download.
 */
export async function downloadPactDependency(
  dep: PactDependency,
  preludeDir: string,
  validateChecksum = true,
): Promise<void> {
  const dir = join(preludeDir, dep.group || "root");
  const localPath = join(dir, dep.name);

  // Check if file exists and has correct checksum
  if (existsSync(localPath) && dep.checksum && validateChecksum) {
    const existingHash = await calculateFileHash(localPath);
    if (existingHash === dep.checksum) {
      logger.debug(`${dep.name} already exists with correct checksum, skipping download`);
      return;
    } else {
      logger.debug(`${dep.name} checksum mismatch, re-downloading`);
    }
  }

  let uri = dep.uri;
  const { subdir, repo, provider, ref } = parseGitURI(dep.uri);
  const isSingleFile = subdir.endsWith(".pact");
  if (isSingleFile) {
    uri = `${provider}:${repo}#${ref}`;
  }

  try {
    const clonePath = join(tempDir, dep.group || "root");
    await downloadGitRepo(clonePath, uri, false);

    await ensureDir(dir);

    if (isSingleFile) {
      const _fileName = subdir.split("/").pop() ?? dep.name;
      const sourcePath = join(clonePath, subdir);
      await copyFile(sourcePath, localPath);
    } else {
      await copyFile(join(clonePath, subdir), localPath);
    }

    // Verify checksum if provided
    if (dep.checksum && validateChecksum) {
      const downloadedHash = await calculateFileHash(localPath);
      if (downloadedHash !== dep.checksum) {
        // Remove invalid file
        await removeDir(localPath);
        throw new Error(
          `Checksum verification failed for ${dep.name}. Expected: ${dep.checksum}, Got: ${downloadedHash}`,
        );
      }
      logger.debug(`✓ Checksum verified for ${dep.name}`);
    }

    logger.debug(`Downloaded ${dep.name} to ${localPath}`);
  } catch (e) {
    throw new Error(`Failed to download ${dep.name} from ${uri}: ${e}`);
  }

  if (dep.requires) {
    await Promise.all(dep.requires.map((dep) => downloadPactDependency(dep, preludeDir, validateChecksum)));
  }
}

/**
 * Download a specific PreludeDefinition and its dependencies with caching and checksum verification.
 *
 * @param prelude - The PreludeDefinition object to download.
 * @param preludesDir - The directory to download the prelude into.
 * @param client - The PactToolboxClient instance.
 * @param allPreludes - An array of all available preludes.
 * @param downloaded - A set of already downloaded prelude names.
 * @param forceDownload - Whether to force download even if cached.
 */
export async function downloadPrelude(
  prelude: PreludeDefinition,
  preludesDir: string,
  client: PactToolboxClient,
  allPreludes: PreludeDefinition[] = [],
  downloaded: Set<string> = new Set(),
  forceDownload = false,
): Promise<void> {
  if (downloaded.has(prelude.id)) {
    return;
  }

  // Extract version from prelude if available
  const preludeVersion = extractPreludeVersion(prelude);

  // Check cache first
  if (!forceDownload && (await isPreludeCached(prelude.name, preludeVersion, preludesDir))) {
    logger.debug(`${prelude.name} found in cache, skipping download`);
    downloaded.add(prelude.id);
    return;
  }

  // Download dependencies first
  if (prelude.dependencies) {
    for (const dep of prelude.dependencies) {
      const found = allPreludes.find((p) => p.id === dep);
      if (!found) {
        throw new Error(`Prelude dependency ${dep} not found`);
      }

      if (downloaded.has(dep)) {
        continue;
      }
      await downloadPrelude(found, preludesDir, client, allPreludes, downloaded, forceDownload);
    }
  }

  logger.info(`Downloading ${prelude.name} prelude...`);

  const preludeDir = join(preludesDir, prelude.id);
  const specs = convertToDownloadSpecs(prelude);

  // Prepare cache tracking
  const cacheSpecs: Array<{
    name: string;
    uri: string;
    group?: string;
    checksum?: string;
    localPath: string;
  }> = [];

  try {
    const groups = groupByBaseRepo(specs);
    for (const [repo, groupSpecs] of Object.entries(groups)) {
      const clonePath = join(tempDir, prelude.name);
      await downloadGitRepo(clonePath, repo, forceDownload);

      for (const spec of groupSpecs) {
        const dir = join(preludeDir, spec.group || "root");
        const localPath = join(dir, spec.name);
        const { subdir } = parseGitURI(spec.uri);

        await ensureDir(dir);
        await copyFile(join(clonePath, subdir), localPath);

        // Calculate checksum if not provided
        const checksum = spec.checksum || (await calculateFileHash(localPath));

        // Verify checksum if provided
        if (spec.checksum) {
          const actualHash = await calculateFileHash(localPath);
          if (actualHash !== spec.checksum) {
            throw new Error(
              `Checksum verification failed for ${spec.name}. Expected: ${spec.checksum}, Got: ${actualHash}`,
            );
          }
        }

        cacheSpecs.push({
          name: spec.name,
          uri: spec.uri,
          group: spec.group,
          checksum,
          localPath,
        });
      }
    }

    // Generate and save install script
    const installScript = await generatePreludeRepl(prelude, client);
    const installPath = join(preludeDir, "install.repl");
    await writeFile(installPath, installScript);

    // Add install script to cache tracking
    cacheSpecs.push({
      name: "install.repl",
      uri: "generated",
      checksum: await calculateFileHash(installPath),
      localPath: installPath,
    });

    // Update cache
    await updatePreludeCache(prelude.name, preludeVersion, cacheSpecs, preludesDir);

    downloaded.add(prelude.id);
    logger.success(`✓ Downloaded ${prelude.name} prelude`);
  } catch (error) {
    // Clean up on failure
    await rm(preludeDir, { recursive: true, force: true });
    await removePreludeFromCache(prelude.name, preludesDir);
    throw error;
  }
}

/**
 * Extract version information from prelude specs or metadata
 */
function extractPreludeVersion(prelude: PreludeDefinition): string | undefined {
  // Use version from prelude definition
  if (prelude.version) {
    return prelude.version;
  }

  // Try to extract from repository ref
  if (prelude.repository?.branch) {
    const { branch } = prelude.repository;
    if (branch && branch !== "main" && branch !== "master") {
      return branch;
    }
  }

  return undefined;
}

/**
 * Generate test accounts REPL script
 */
function generateTestAccountsRepl(accounts: any[]): string {
  if (!accounts || accounts.length === 0) {
    return `(print "No test accounts configured")`;
  }

  const lines = [];
  lines.push("(begin-tx)");
  lines.push("(module test-keys GOVERNANCE");
  lines.push("  (defcap GOVERNANCE () true)");

  for (const account of accounts) {
    lines.push(`  (defconst ${account.account} "${account.publicKey}")`);
  }

  lines.push(")");
  lines.push("(commit-tx)");
  lines.push("");
  lines.push("");
  lines.push("(env-data {");

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const isLast = i === accounts.length - 1;
    lines.push(`  "${account.account}": [ test-keys.${account.account} ]${isLast ? "" : ","}`);
  }

  lines.push("})");
  lines.push("(begin-tx)");
  lines.push('(namespace "free")');

  for (const account of accounts) {
    lines.push(`(define-keyset "free.${account.account}-keyset" (read-keyset "${account.account}"))`);
  }

  lines.push("(commit-tx)");
  lines.push('(print "Registered sender* keysets.")');
  lines.push("");
  lines.push("(env-data {})");
  lines.push("(begin-tx)");

  for (const account of accounts) {
    lines.push(`(coin.create-account "${account.account}" (describe-keyset "free.${account.account}-keyset"))`);
  }

  lines.push("(commit-tx)");
  lines.push('(print "Created sender* accounts.")');
  lines.push("");
  lines.push("(begin-tx)");
  lines.push("(test-capability (coin.COINBASE))");

  for (const account of accounts) {
    lines.push(`(coin.coinbase "${account.account}" (describe-keyset "free.${account.account}-keyset") 1000000.0)`);
  }

  lines.push("(commit-tx)");
  lines.push('(print "Funded sender* accounts each with 1,000,000.0 KDA.")');

  return lines.join("\n");
}

/**
 * Generate init REPL script
 */
function generateInitRepl(preludes: string[], gasLimit: number): string {
  const lines = [];

  for (const prelude of preludes) {
    lines.push(`(load "${prelude}/install.repl")`);
  }

  lines.push('(load "tools/test-accounts.repl")');
  lines.push('(env-gasmodel "table")');
  lines.push(`(env-gaslimit ${gasLimit})`);
  lines.push("(print \"Initialized gas model 'table'\")");

  return lines.join("\n");
}

/**
 * Create a test tools file for the pact repl tests.
 */
export async function createReplTestTools(config: CommonPreludeOptions): Promise<void> {
  const { preludes, preludesDir } = await resolvePreludes(config);
  // Write accounts repl
  await mkdir(join(preludesDir, "tools"), { recursive: true });
  const accounts = config.client.getNetworkConfig().keyPairs ?? [];
  const accountsRepl = generateTestAccountsRepl(accounts);
  await writeFile(join(preludesDir, "tools/test-accounts.repl"), accountsRepl);

  // Write init repl
  const preludeNames = sortPreludesNames(preludes);
  const gasLimit = config.client.getNetworkConfig().meta?.gasLimit || 150000;
  const initRepl = generateInitRepl(preludeNames, gasLimit);
  await writeFile(join(preludesDir, "init.repl"), initRepl);
}

/**
 * Download all specified preludes based on the given configuration.
 *
 * @param config - The configuration options for downloading preludes.
 * @param options - Additional download options.
 */
export async function downloadAllPreludes(
  config: CommonPreludeOptions,
  options: {
    forceDownload?: boolean;
    cleanCache?: boolean;
    validateChecksums?: boolean;
  } = {},
): Promise<void> {
  const { forceDownload = false, cleanCache = false, validateChecksums = true } = options;

  const downloaded = new Set<string>();
  const { preludes, preludesDir } = await resolvePreludes(config);

  // Show cache stats before operation
  const initialStats = await getCacheStats(preludesDir);
  if (initialStats.totalEntries > 0) {
    logger.info(
      `Cache contains ${initialStats.totalEntries} preludes (≈${Math.round(initialStats.totalSize / 1024)}KB)`,
    );
  }

  // Clean temp dir
  await rm(tempDir, { recursive: true, force: true });

  // Clean preludes dir if force download or clean cache
  if (forceDownload || cleanCache) {
    logger.info(forceDownload ? "Force download mode: cleaning all preludes" : "Cleaning cache");
    await rm(preludesDir, { recursive: true, force: true });
  }

  // Download preludes
  let skippedCount = 0;
  for (const prelude of preludes) {
    const wasAlreadyDownloaded =
      downloaded.has(prelude.name) ||
      (!forceDownload &&
        (await isPreludeCached(prelude.name, extractPreludeVersion(prelude), preludesDir, !validateChecksums)));

    await downloadPrelude(prelude, preludesDir, config.client, preludes, downloaded, forceDownload);

    if (wasAlreadyDownloaded && !forceDownload) {
      skippedCount++;
    }
  }

  // Report results
  const finalStats = await getCacheStats(preludesDir);
  logger.info(`Downloaded ${preludes.length - skippedCount} preludes, skipped ${skippedCount} cached`);
  logger.info(`Cache now contains ${finalStats.totalEntries} preludes (≈${Math.round(finalStats.totalSize / 1024)}KB)`);

  // Create a test tools file for the pact repl tests
  await createReplTestTools(config);
}

/**
 * Check if a specific prelude has been downloaded and is valid.
 *
 * @param prelude - The PreludeDefinition object to check.
 * @param preludesDir - The directory to check for the prelude.
 * @param validateChecksums - Whether to validate checksums.
 * @returns A boolean indicating whether the prelude has been downloaded and is valid.
 */
export async function isPreludeDownloaded(
  prelude: PreludeDefinition,
  preludesDir: string,
  validateChecksums = false,
): Promise<boolean> {
  const preludeVersion = prelude.version;

  // Use cache-aware checking first
  if (await isPreludeCached(prelude.name, preludeVersion, preludesDir, !validateChecksums)) {
    return true;
  }

  // Convert to download specs and check existence
  const specs = convertToDownloadSpecs(prelude);
  const paths = specs.map((spec) => join(preludesDir, prelude.id, spec.group || "root", spec.name));
  const allExist = paths.every((p) => existsSync(p));

  if (!allExist) {
    return false;
  }

  // Validate checksums if requested
  if (validateChecksums) {
    for (const spec of specs) {
      if (spec.checksum) {
        const path = join(preludesDir, prelude.id, spec.group || "root", spec.name);
        const actualHash = await calculateFileHash(path);
        if (actualHash !== spec.checksum) {
          logger.debug(`Checksum mismatch for ${spec.name}: ${actualHash} !== ${spec.checksum}`);
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Determine if any preludes need to be downloaded based on the configuration.
 *
 * @param config - The configuration options.
 * @param validateChecksums - Whether to validate checksums when checking.
 * @returns A boolean indicating whether any preludes need to be downloaded.
 */
export async function shouldDownloadPreludes(
  config: CommonPreludeOptions,
  validateChecksums = false,
): Promise<boolean> {
  const { preludes, preludesDir } = await resolvePreludes(config);

  const downloadStatus = await Promise.all(preludes.map((p) => isPreludeDownloaded(p, preludesDir, validateChecksums)));

  return downloadStatus.some((downloaded) => !downloaded);
}
