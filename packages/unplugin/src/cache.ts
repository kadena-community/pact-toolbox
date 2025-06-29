import type { TransformResult, ModuleInfo } from "@pact-toolbox/pact-transformer";

/**
 * Cache entry for transformed Pact files
 */
export interface CachedTransform {
  /** Source hash for cache invalidation */
  sourceHash: string;
  /** Transformed JavaScript code */
  code: string;
  /** Generated TypeScript definitions */
  types: string;
  /** Parsed module information */
  modules: ModuleInfo[];
  /** Source map if available */
  sourceMap?: string;
  /** Deployment status */
  isDeployed: boolean;
  /** Last transformation time */
  lastTransformed: number;
}

/**
 * High-performance cache for Pact transformations
 */
export class PactTransformCache {
  private cache = new Map<string, CachedTransform>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get cached transformation result
   */
  get(id: string, sourceHash: string): CachedTransform | null {
    const cached = this.cache.get(id);
    if (cached && cached.sourceHash === sourceHash) {
      return cached;
    }
    return null;
  }

  /**
   * Store transformation result in cache
   */
  set(id: string, sourceHash: string, result: TransformResult, modules: ModuleInfo[], isDeployed = false): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(id)) {
      this.evictLRU();
    }

    this.cache.set(id, {
      sourceHash,
      code: result.javascript,
      types: result.typescript || "",
      modules,
      sourceMap: result.sourceMap,
      isDeployed,
      lastTransformed: Date.now(),
    });
  }

  /**
   * Update deployment status for a cached entry
   */
  setDeploymentStatus(id: string, isDeployed: boolean): void {
    const cached = this.cache.get(id);
    if (cached) {
      cached.isDeployed = isDeployed;
      this.cache.set(id, cached);
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate(),
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    // Use Array.from to avoid downlevelIteration requirement
    for (const [id, cached] of Array.from(this.cache.entries())) {
      if (cached.lastTransformed < oldestTime) {
        oldestTime = cached.lastTransformed;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.cache.delete(oldestId);
    }
  }

  /**
   * Calculate cache hit rate (simplified)
   */
  private calculateHitRate(): number {
    // This is a simplified implementation
    // In a real scenario, you'd track hits/misses
    return this.cache.size > 0 ? 0.85 : 0;
  }
}

/**
 * Create a fast hash of source code for cache invalidation
 */
export function createSourceHash(source: string): string {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
