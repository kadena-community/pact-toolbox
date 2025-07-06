/**
 * Lightweight Dependency Injection Container
 *
 * A fast, type-safe container for managing global state and providers
 * with minimal overhead and excellent developer experience.
 */

import type { ServiceToken } from "@pact-toolbox/types";

// Service lifecycle types
export type ServiceFactory<T> = () => T | Promise<T>;
export type ServiceProvider<T> = T | ServiceFactory<T>;

export interface ServiceOptions {
  singleton?: boolean; // Default true
  eager?: boolean; // Load immediately vs lazy
  override?: boolean; // Allow overriding existing
}

// The main container class
export class Container {
  private services = new Map<symbol, ServiceRegistration<any>>();
  private instances = new Map<symbol, any>();
  private resolving = new Set<symbol>(); // Circular dependency detection

  /**
   * Register a service provider
   */
  register<T>(token: ServiceToken<T>, provider: ServiceProvider<T>, options: ServiceOptions = {}): this {
    const { singleton = true, eager = false, override = false } = options;

    if (this.services.has(token.symbol) && !override) {
      throw new Error(`Service ${token.name} is already registered`);
    }

    const registration: ServiceRegistration<T> = {
      token,
      provider,
      singleton,
      factory: typeof provider === "function" ? provider : () => provider,
    };

    this.services.set(token.symbol, registration);

    if (eager && singleton) {
      this.resolve(token); // Eagerly instantiate
    }

    return this;
  }

  /**
   * Resolve a service
   */
  resolve<T>(token: ServiceToken<T>): T {
    const registration = this.services.get(token.symbol);
    if (!registration) {
      throw new Error(`Service ${token.name} not registered`);
    }

    // Return existing singleton instance
    if (registration.singleton && this.instances.has(token.symbol)) {
      return this.instances.get(token.symbol);
    }

    // Circular dependency check
    if (this.resolving.has(token.symbol)) {
      throw new Error(`Circular dependency detected for ${token.name}`);
    }

    try {
      this.resolving.add(token.symbol);

      const instance = registration.factory();

      if (registration.singleton) {
        this.instances.set(token.symbol, instance);
      }

      return instance;
    } finally {
      this.resolving.delete(token.symbol);
    }
  }

  /**
   * Async resolve for async factories
   */
  async resolveAsync<T>(token: ServiceToken<T>): Promise<T> {
    const registration = this.services.get(token.symbol);
    if (!registration) {
      throw new Error(`Service ${token.name} not registered`);
    }

    // Return existing singleton instance
    if (registration.singleton && this.instances.has(token.symbol)) {
      return this.instances.get(token.symbol);
    }

    // Circular dependency check
    if (this.resolving.has(token.symbol)) {
      throw new Error(`Circular dependency detected for ${token.name}`);
    }

    try {
      this.resolving.add(token.symbol);

      const instance = await registration.factory();

      if (registration.singleton) {
        this.instances.set(token.symbol, instance);
      }

      return instance;
    } finally {
      this.resolving.delete(token.symbol);
    }
  }

  /**
   * Check if service is registered
   */
  has<T>(token: ServiceToken<T>): boolean {
    return this.services.has(token.symbol);
  }

  /**
   * Clear singleton instances (useful for testing)
   */
  clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Create a child container (for scoped services)
   */
  createScope(): Container {
    const child = new Container();
    // Copy service registrations but not instances
    for (const [symbol, registration] of this.services) {
      child.services.set(symbol, registration);
    }
    return child;
  }
}

// Internal types
interface ServiceRegistration<T> {
  token: ServiceToken<T>;
  provider: ServiceProvider<T>;
  singleton: boolean;
  factory: ServiceFactory<T>;
}

// Global container instance
export const globalContainer = new Container();

// Convenience functions
export const register = globalContainer.register.bind(globalContainer);
export const resolve = globalContainer.resolve.bind(globalContainer);
export const resolveAsync = globalContainer.resolveAsync.bind(globalContainer);

// Helper for creating providers that depend on other services
export function createProvider<T>(deps: ServiceToken<any>[], factory: (...args: any[]) => T): ServiceFactory<T> {
  return () => {
    const resolvedDeps = deps.map((dep) => resolve(dep));
    return factory(...resolvedDeps);
  };
}

// Async version
export function createAsyncProvider<T>(
  deps: ServiceToken<any>[],
  factory: (...args: any[]) => Promise<T>,
): ServiceFactory<T> {
  return async () => {
    const resolvedDeps = await Promise.all(deps.map((dep) => resolveAsync(dep)));
    return factory(...resolvedDeps);
  };
}
