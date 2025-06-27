import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPreludeCache,
  getCacheFilePath,
  getCacheStats,
  isPreludeCached,
  loadPreludeCache,
  removePreludeFromCache,
  savePreludeCache,
  updatePreludeCache,
  type PreludeCache,
  type PreludeCacheEntry,
} from "./cache";
import { calculateContentHash, calculateFileHash } from "@pact-toolbox/node-utils";

const testDir = join(process.cwd(), ".test-cache");
const testFile = join(testDir, "test.pact");

describe("Cache Management", () => {
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("Hash Calculation", () => {
    it("should calculate SHA-256 hash of file content", async () => {
      const content = "(module test GOV (defcap GOV () true))";
      await writeFile(testFile, content, "utf-8");

      const hash = await calculateFileHash(testFile);
      expect(hash).toBeTruthy();
      expect(hash).toHaveLength(64); // SHA-256 hex string length
    });

    it("should return empty string for non-existent file", async () => {
      const hash = await calculateFileHash(join(testDir, "nonexistent.pact"));
      expect(hash).toBe("");
    });

    it("should calculate consistent hash for same content", async () => {
      const content = "test content";
      const hash1 = calculateContentHash(content);
      const hash2 = calculateContentHash(content);
      expect(hash1).toBe(hash2);
    });

    it("should calculate different hashes for different content", () => {
      const hash1 = calculateContentHash("content1");
      const hash2 = calculateContentHash("content2");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Cache File Operations", () => {
    it("should get correct cache file path", () => {
      const cachePath = getCacheFilePath(testDir);
      expect(cachePath).toBe(join(testDir, ".cache.json"));
    });

    it("should return empty cache for non-existent cache file", async () => {
      const cache = await loadPreludeCache(testDir);
      expect(cache.version).toBe("1.0.0");
      expect(cache.entries).toEqual({});
    });

    it("should save and load cache correctly", async () => {
      const testCache: PreludeCache = {
        version: "1.0.0",
        entries: {
          "test-prelude": {
            name: "test-prelude",
            checksum: "test-hash",
            downloadedAt: Date.now(),
            specs: [
              {
                name: "test.pact",
                uri: "gh:test/repo/test.pact",
                checksum: "spec-hash",
                localPath: testFile,
              },
            ],
          },
        },
      };

      await savePreludeCache(testDir, testCache);
      const loadedCache = await loadPreludeCache(testDir);

      expect(loadedCache.version).toBe(testCache.version);
      expect(loadedCache.entries["test-prelude"]).toEqual(testCache.entries["test-prelude"]);
    });

    it("should clear cache when version mismatch", async () => {
      const oldCache = {
        version: "0.1.0",
        entries: { "old-prelude": {} as PreludeCacheEntry },
      };

      await writeFile(join(testDir, ".cache.json"), JSON.stringify(oldCache), "utf-8");
      const cache = await loadPreludeCache(testDir);

      expect(cache.version).toBe("1.0.0");
      expect(cache.entries).toEqual({});
    });

    it("should handle corrupted cache file gracefully", async () => {
      await writeFile(join(testDir, ".cache.json"), "invalid json", "utf-8");
      const cache = await loadPreludeCache(testDir);

      expect(cache.version).toBe("1.0.0");
      expect(cache.entries).toEqual({});
    });
  });

  describe("Cache Validation", () => {
    beforeEach(async () => {
      const content = "(module test GOV (defcap GOV () true))";
      await writeFile(testFile, content, "utf-8");
    });

    it("should return false for non-cached prelude", async () => {
      const isCached = await isPreludeCached("non-existent", undefined, testDir);
      expect(isCached).toBe(false);
    });

    it("should return false when files don't exist", async () => {
      const cache: PreludeCache = {
        version: "1.0.0",
        entries: {
          "test-prelude": {
            name: "test-prelude",
            checksum: "test-hash",
            downloadedAt: Date.now(),
            specs: [
              {
                name: "missing.pact",
                uri: "gh:test/repo/missing.pact",
                checksum: "spec-hash",
                localPath: join(testDir, "missing.pact"),
              },
            ],
          },
        },
      };

      await savePreludeCache(testDir, cache);
      const isCached = await isPreludeCached("test-prelude", undefined, testDir);
      expect(isCached).toBe(false);
    });

    it("should validate checksums when not skipping", async () => {
      const _content = "(module test GOV (defcap GOV () true))";
      const actualHash = await calculateFileHash(testFile);

      const cache: PreludeCache = {
        version: "1.0.0",
        entries: {
          "test-prelude": {
            name: "test-prelude",
            checksum: "test-hash",
            downloadedAt: Date.now(),
            specs: [
              {
                name: "test.pact",
                uri: "gh:test/repo/test.pact",
                checksum: actualHash,
                localPath: testFile,
              },
            ],
          },
        },
      };

      await savePreludeCache(testDir, cache);

      // Should pass with correct checksum
      const isValid = await isPreludeCached("test-prelude", undefined, testDir, false);
      expect(isValid).toBe(true);

      // Should fail with incorrect checksum
      // @ts-expect-error - we're testing the cache validation
      cache.entries["test-prelude"].specs[0].checksum = "wrong-hash";
      await savePreludeCache(testDir, cache);

      const isInvalid = await isPreludeCached("test-prelude", undefined, testDir, false);
      expect(isInvalid).toBe(false);
    });

    it("should skip checksum validation when requested", async () => {
      const cache: PreludeCache = {
        version: "1.0.0",
        entries: {
          "test-prelude": {
            name: "test-prelude",
            checksum: "test-hash",
            downloadedAt: Date.now(),
            specs: [
              {
                name: "test.pact",
                uri: "gh:test/repo/test.pact",
                checksum: "wrong-hash",
                localPath: testFile,
              },
            ],
          },
        },
      };

      await savePreludeCache(testDir, cache);
      const isCached = await isPreludeCached("test-prelude", undefined, testDir, true);
      expect(isCached).toBe(true);
    });

    it("should check version match when provided", async () => {
      const cache: PreludeCache = {
        version: "1.0.0",
        entries: {
          "test-prelude": {
            name: "test-prelude",
            version: "1.0.0",
            checksum: "test-hash",
            downloadedAt: Date.now(),
            specs: [
              {
                name: "test.pact",
                uri: "gh:test/repo/test.pact",
                checksum: await calculateFileHash(testFile),
                localPath: testFile,
              },
            ],
          },
        },
      };

      await savePreludeCache(testDir, cache);

      // Should match correct version
      const matchingVersion = await isPreludeCached("test-prelude", "1.0.0", testDir);
      expect(matchingVersion).toBe(true);

      // Should not match different version
      const differentVersion = await isPreludeCached("test-prelude", "2.0.0", testDir);
      expect(differentVersion).toBe(false);
    });
  });

  describe("Cache Updates", () => {
    beforeEach(async () => {
      const content = "(module test GOV (defcap GOV () true))";
      await writeFile(testFile, content, "utf-8");
    });

    it("should update cache entry with calculated checksums", async () => {
      const specs = [
        {
          name: "test.pact",
          uri: "gh:test/repo/test.pact",
          localPath: testFile,
        },
      ];

      await updatePreludeCache("test-prelude", "1.0.0", specs, testDir);

      const cache = await loadPreludeCache(testDir);
      const entry = cache.entries["test-prelude"];

      expect(entry).toBeDefined();
      expect(entry?.name).toBe("test-prelude");
      expect(entry?.version).toBe("1.0.0");
      expect(entry?.specs[0]?.checksum).toBeTruthy();
      expect(entry?.specs[0]?.checksum).toHaveLength(64);
    });

    it("should preserve existing checksums", async () => {
      const existingChecksum = "existing-hash";
      const specs = [
        {
          name: "test.pact",
          uri: "gh:test/repo/test.pact",
          checksum: existingChecksum,
          localPath: testFile,
        },
      ];

      await updatePreludeCache("test-prelude", undefined, specs, testDir);

      const cache = await loadPreludeCache(testDir);
      const entry = cache.entries["test-prelude"];

      expect(entry?.specs[0]?.checksum).toBe(existingChecksum);
    });

    it("should remove cache entry", async () => {
      await updatePreludeCache(
        "test-prelude",
        undefined,
        [
          {
            name: "test.pact",
            uri: "gh:test/repo/test.pact",
            localPath: testFile,
          },
        ],
        testDir,
      );

      let cache = await loadPreludeCache(testDir);
      expect(cache.entries["test-prelude"]).toBeDefined();

      await removePreludeFromCache("test-prelude", testDir);

      cache = await loadPreludeCache(testDir);
      expect(cache.entries["test-prelude"]).toBeUndefined();
    });

    it("should clear entire cache", async () => {
      await updatePreludeCache(
        "test-prelude-1",
        undefined,
        [
          {
            name: "test1.pact",
            uri: "gh:test/repo/test1.pact",
            localPath: testFile,
          },
        ],
        testDir,
      );

      await updatePreludeCache(
        "test-prelude-2",
        undefined,
        [
          {
            name: "test2.pact",
            uri: "gh:test/repo/test2.pact",
            localPath: testFile,
          },
        ],
        testDir,
      );

      let cache = await loadPreludeCache(testDir);
      expect(Object.keys(cache.entries)).toHaveLength(2);

      await clearPreludeCache(testDir);

      cache = await loadPreludeCache(testDir);
      expect(Object.keys(cache.entries)).toHaveLength(0);
    });
  });

  describe("Cache Statistics", () => {
    it("should return empty stats for empty cache", async () => {
      const stats = await getCacheStats(testDir);
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestEntry).toBeUndefined();
      expect(stats.newestEntry).toBeUndefined();
    });

    it("should calculate correct stats", async () => {
      const now = Date.now();
      const cache: PreludeCache = {
        version: "1.0.0",
        entries: {
          "old-prelude": {
            name: "old-prelude",
            checksum: "hash1",
            downloadedAt: now - 5 * 24 * 60 * 60 * 1000, // 5 days ago
            specs: [
              { name: "old1.pact", uri: "test", localPath: "/path1" },
              { name: "old2.pact", uri: "test", localPath: "/path2" },
            ],
          },
          "new-prelude": {
            name: "new-prelude",
            checksum: "hash2",
            downloadedAt: now - 24 * 60 * 60 * 1000, // 1 day ago
            specs: [{ name: "new1.pact", uri: "test", localPath: "/path3" }],
          },
        },
      };

      await savePreludeCache(testDir, cache);
      const stats = await getCacheStats(testDir);

      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestEntry?.name).toBe("old-prelude");
      expect(stats.oldestEntry?.age).toBe(5);
      expect(stats.newestEntry?.name).toBe("new-prelude");
      expect(stats.newestEntry?.age).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle save failures gracefully", async () => {
      const invalidDir = "/invalid/path/that/does/not/exist";
      const cache: PreludeCache = { version: "1.0.0", entries: {} };

      // Should not throw
      await expect(savePreludeCache(invalidDir, cache)).resolves.toBeUndefined();
    });

    it("should handle file hash calculation errors", async () => {
      const hash = await calculateFileHash("/invalid/file/path");
      expect(hash).toBe("");
    });
  });
});
