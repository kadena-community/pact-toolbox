import {
  readFile,
  writeFile,
  existsSync,
  ensureDir,
  calculateFileHash,
  calculateContentHash,
  logger,
} from "@pact-toolbox/node-utils";

// Re-export hash functions for external use
export { calculateFileHash, calculateContentHash };
import { dirname, join } from "pathe";

export interface PreludeCacheEntry {
  name: string;
  version?: string;
  checksum: string;
  downloadedAt: number;
  specs: Array<{
    name: string;
    uri: string;
    group?: string;
    checksum?: string;
    localPath: string;
  }>;
}

export interface PreludeCache {
  version: string;
  entries: Record<string, PreludeCacheEntry>;
}

const CACHE_VERSION = "1.0.0";

/**
 * Get cache file path for preludes
 */
export function getCacheFilePath(preludesDir: string): string {
  return join(preludesDir, ".cache.json");
}

/**
 * Load prelude cache from disk
 */
export async function loadPreludeCache(preludesDir: string): Promise<PreludeCache> {
  const cacheFile = getCacheFilePath(preludesDir);

  if (!existsSync(cacheFile)) {
    return {
      version: CACHE_VERSION,
      entries: {},
    };
  }

  try {
    const content = await readFile(cacheFile);
    const cache = JSON.parse(content) as PreludeCache;

    // Validate cache version
    if (cache.version !== CACHE_VERSION) {
      logger.info(`Cache version mismatch, clearing cache (${cache.version} → ${CACHE_VERSION})`);
      return {
        version: CACHE_VERSION,
        entries: {},
      };
    }

    return cache;
  } catch (error) {
    logger.debug(`Failed to load cache: ${error}`);
    return {
      version: CACHE_VERSION,
      entries: {},
    };
  }
}

/**
 * Save prelude cache to disk
 */
export async function savePreludeCache(preludesDir: string, cache: PreludeCache): Promise<void> {
  const cacheFile = getCacheFilePath(preludesDir);

  try {
    await ensureDir(dirname(cacheFile));
    await writeFile(cacheFile, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.debug(`Failed to save cache: ${error}`);
  }
}

/**
 * Check if a prelude is cached and valid
 */
export async function isPreludeCached(
  preludeName: string,
  preludeVersion: string | undefined,
  preludesDir: string,
  skipChecksumValidation = false,
): Promise<boolean> {
  const cache = await loadPreludeCache(preludesDir);
  const entry = cache.entries[preludeName];

  if (!entry) {
    return false;
  }

  // Check version if provided
  if (preludeVersion && entry.version !== preludeVersion) {
    logger.debug(`Version mismatch for ${preludeName}: ${entry.version} !== ${preludeVersion}`);
    return false;
  }

  // Check if all files exist
  const allFilesExist = entry.specs.every((spec) => existsSync(spec.localPath));
  if (!allFilesExist) {
    logger.debug(`Missing files for ${preludeName}`);
    return false;
  }

  // Skip checksum validation if requested (for performance)
  if (skipChecksumValidation) {
    return true;
  }

  // Validate checksums
  const checksumPromises = entry.specs.map(async (spec) => {
    if (!spec.checksum) return true; // Skip if no checksum provided

    const actualHash = await calculateFileHash(spec.localPath);
    const isValid = actualHash === spec.checksum;

    if (!isValid) {
      logger.debug(`Checksum mismatch for ${spec.localPath}: ${actualHash} !== ${spec.checksum}`);
    }

    return isValid;
  });

  const checksumResults = await Promise.all(checksumPromises);
  return checksumResults.every((valid) => valid);
}

/**
 * Add or update cache entry for a prelude
 */
export async function updatePreludeCache(
  preludeName: string,
  version: string | undefined,
  specs: Array<{
    name: string;
    uri: string;
    group?: string;
    checksum?: string;
    localPath: string;
  }>,
  preludesDir: string,
): Promise<void> {
  const cache = await loadPreludeCache(preludesDir);

  // Calculate checksums for specs that don't have them
  const specsWithChecksums = await Promise.all(
    specs.map(async (spec) => ({
      ...spec,
      checksum: spec.checksum || (await calculateFileHash(spec.localPath)),
    })),
  );

  const entry: PreludeCacheEntry = {
    name: preludeName,
    version,
    checksum: calculateContentHash(JSON.stringify(specsWithChecksums)),
    downloadedAt: Date.now(),
    specs: specsWithChecksums,
  };

  cache.entries[preludeName] = entry;
  await savePreludeCache(preludesDir, cache);

  logger.debug(`Updated cache for ${preludeName}`);
}

/**
 * Remove cache entry for a prelude
 */
export async function removePreludeFromCache(preludeName: string, preludesDir: string): Promise<void> {
  const cache = await loadPreludeCache(preludesDir);
  delete cache.entries[preludeName];
  await savePreludeCache(preludesDir, cache);

  logger.debug(`Removed ${preludeName} from cache`);
}

/**
 * Clear entire prelude cache
 */
export async function clearPreludeCache(preludesDir: string): Promise<void> {
  const cache: PreludeCache = {
    version: CACHE_VERSION,
    entries: {},
  };

  await savePreludeCache(preludesDir, cache);
  logger.info("Cleared prelude cache");
}

/**
 * Get cache statistics
 */
export async function getCacheStats(preludesDir: string): Promise<{
  totalEntries: number;
  totalSize: number;
  oldestEntry?: { name: string; age: number };
  newestEntry?: { name: string; age: number };
}> {
  const cache = await loadPreludeCache(preludesDir);
  const entries = Object.values(cache.entries);

  if (entries.length === 0) {
    return { totalEntries: 0, totalSize: 0 };
  }

  const now = Date.now();
  let totalSize = 0;
  let oldest = entries[0];
  let newest = entries[0];

  for (const entry of entries) {
    // Estimate size based on number of specs (rough approximation)
    totalSize += entry.specs.length * 1024; // Assume ~1KB per file

    if (oldest && entry.downloadedAt < oldest.downloadedAt) {
      oldest = entry;
    }

    if (newest && entry.downloadedAt > newest.downloadedAt) {
      newest = entry;
    }
  }

  return {
    totalEntries: entries.length,
    totalSize,
    oldestEntry: {
      name: oldest?.name ?? "",
      age: Math.floor((now - (oldest?.downloadedAt ?? 0)) / (1000 * 60 * 60 * 24)), // days
    },
    newestEntry: {
      name: newest?.name ?? "",
      age: Math.floor((now - (newest?.downloadedAt ?? 0)) / (1000 * 60 * 60 * 24)), // days
    },
  };
}
