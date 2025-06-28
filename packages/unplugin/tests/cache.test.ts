import { describe, it, expect, beforeEach, vi } from "vitest";
import { PactTransformCache, createSourceHash } from "../src/cache";

describe("PactTransformCache", () => {
  let cache: PactTransformCache;

  beforeEach(() => {
    cache = new PactTransformCache(3); // Small cache for testing
  });

  describe("createSourceHash", () => {
    it("should create consistent hashes for the same content", () => {
      const content = "(module test GOVERNANCE (defcap GOVERNANCE () true))";
      const hash1 = createSourceHash(content);
      const hash2 = createSourceHash(content);

      expect(hash1).toBe(hash2);
    });

    it("should create different hashes for different content", () => {
      const content1 = "(module test GOVERNANCE (defcap GOVERNANCE () true))";
      const content2 = "(module test2 GOVERNANCE (defcap GOVERNANCE () true))";
      const hash1 = createSourceHash(content1);
      const hash2 = createSourceHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty content", () => {
      const hash = createSourceHash("");
      expect(hash).toBe("0");
    });
  });

  describe("cache operations", () => {
    it("should store and retrieve cached transformations", () => {
      const id = "test.pact";
      const sourceHash = "hash123";
      const result = { javascript: "code", typescript: "types" };
      const modules = [
        {
          name: "test",
          namespace: undefined,
          governance: "GOVERNANCE",
          doc: undefined,
          functionCount: 0,
          schemaCount: 0,
          capabilityCount: 0,
          constantCount: 0,
        },
      ];

      cache.set(id, sourceHash, result, modules, false);
      const cached = cache.get(id, sourceHash);

      expect(cached).not.toBeNull();
      expect(cached!.code).toBe("code");
      expect(cached!.types).toBe("types");
      expect(cached!.modules).toEqual(modules);
      expect(cached!.isDeployed).toBe(false);
    });

    it("should return null for cache miss", () => {
      const cached = cache.get("nonexistent.pact", "hash123");
      expect(cached).toBeNull();
    });

    it("should return null for outdated source hash", () => {
      const id = "test.pact";
      const result = { javascript: "code", typescript: "types" };
      const modules: any[] = [];

      cache.set(id, "oldhash", result, modules, false);
      const cached = cache.get(id, "newhash");

      expect(cached).toBeNull();
    });

    it("should update deployment status", () => {
      const id = "test.pact";
      const sourceHash = "hash123";
      const result = { javascript: "code", typescript: "types" };
      const modules: any[] = [];

      cache.set(id, sourceHash, result, modules, false);
      cache.setDeploymentStatus(id, true);

      const cached = cache.get(id, sourceHash);
      expect(cached!.isDeployed).toBe(true);
    });

    it("should not update deployment status for non-existent entries", () => {
      // Should not throw
      expect(() => cache.setDeploymentStatus("nonexistent.pact", true)).not.toThrow();
    });

    it("should clear all cache entries", () => {
      cache.set("test1.pact", "hash1", { javascript: "code1", typescript: "types1" }, [], false);
      cache.set("test2.pact", "hash2", { javascript: "code2", typescript: "types2" }, [], false);

      expect(cache.getStats().size).toBe(2);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get("test1.pact", "hash1")).toBeNull();
      expect(cache.get("test2.pact", "hash2")).toBeNull();
    });

    it("should evict LRU entries when cache is full", () => {
      const now = Date.now();

      // Fill cache to capacity
      cache.set("test1.pact", "hash1", { javascript: "code1", typescript: "types1" }, [], false);

      // Wait a bit to ensure different timestamps
      const laterTime = now + 1000;
      vi.useFakeTimers();
      vi.setSystemTime(laterTime);

      cache.set("test2.pact", "hash2", { javascript: "code2", typescript: "types2" }, [], false);
      cache.set("test3.pact", "hash3", { javascript: "code3", typescript: "types3" }, [], false);

      // Access test2 to make it more recently used
      cache.get("test2.pact", "hash2");

      // Add one more, should evict test1 (least recently used)
      cache.set("test4.pact", "hash4", { javascript: "code4", typescript: "types4" }, [], false);

      expect(cache.get("test1.pact", "hash1")).toBeNull(); // Evicted
      expect(cache.get("test2.pact", "hash2")).not.toBeNull();
      expect(cache.get("test3.pact", "hash3")).not.toBeNull();
      expect(cache.get("test4.pact", "hash4")).not.toBeNull();

      vi.useRealTimers();
    });

    it("should handle source maps in cache", () => {
      const id = "test.pact";
      const sourceHash = "hash123";
      const result = {
        javascript: "code",
        typescript: "types",
        sourceMap: "//# sourceMappingURL=test.pact.map",
      };
      const modules: any[] = [];

      cache.set(id, sourceHash, result, modules, false);
      const cached = cache.get(id, sourceHash);

      expect(cached!.sourceMap).toBe("//# sourceMappingURL=test.pact.map");
    });
  });

  describe("cache statistics", () => {
    it("should report cache statistics", () => {
      cache.set("test1.pact", "hash1", { javascript: "code1", typescript: "types1" }, [], false);
      cache.set("test2.pact", "hash2", { javascript: "code2", typescript: "types2" }, [], false);

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    it("should report zero hit rate for empty cache", () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });
});
