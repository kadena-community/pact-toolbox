/**
 * Lifecycle management utilities for proper resource cleanup
 */

export interface Disposable {
  dispose(): void | Promise<void>;
}

export interface AsyncDisposable {
  disposeAsync(): Promise<void>;
}

/**
 * Track disposables and ensure cleanup
 */
export class DisposableStore implements Disposable {
  private readonly disposables = new Set<Disposable | AsyncDisposable>();
  private disposed = false;

  /**
   * Add a disposable to the store
   */
  add<T extends Disposable | AsyncDisposable>(disposable: T): T {
    if (this.disposed) {
      throw new Error("Cannot add to disposed store");
    }
    this.disposables.add(disposable);
    return disposable;
  }

  /**
   * Create a disposable from a cleanup function
   */
  addDisposer(fn: () => void | Promise<void>): Disposable {
    const disposable: Disposable = {
      dispose: fn,
    };
    return this.add(disposable);
  }

  /**
   * Remove a disposable from the store
   */
  delete(disposable: Disposable | AsyncDisposable): boolean {
    return this.disposables.delete(disposable);
  }

  /**
   * Clear and dispose all resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    const errors: Error[] = [];

    // Dispose in reverse order (LIFO)
    const disposables = Array.from(this.disposables).reverse();
    this.disposables.clear();

    for (const disposable of disposables) {
      try {
        if ("disposeAsync" in disposable) {
          await disposable.disposeAsync();
        } else {
          const result = disposable.dispose();
          if (result instanceof Promise) {
            await result;
          }
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Errors during disposal");
    }
  }

  /**
   * Check if the store has been disposed
   */
  get isDisposed(): boolean {
    return this.disposed;
  }
}

/**
 * Create a disposable from a value and cleanup function
 */
export function toDisposable(fn: () => void | Promise<void>): Disposable {
  return {
    dispose: fn,
  };
}

/**
 * Combine multiple disposables into one
 */
export function combinedDisposable(...disposables: (Disposable | AsyncDisposable)[]): Disposable {
  const store = new DisposableStore();
  for (const disposable of disposables) {
    store.add(disposable);
  }
  return store;
}

/**
 * Reference counting for shared resources
 */
export class RefCountedDisposable implements Disposable {
  private refCount = 1;
  private disposed = false;

  constructor(private readonly disposable: Disposable) {}

  acquire(): Disposable {
    if (this.disposed) {
      throw new Error("Cannot acquire disposed resource");
    }
    this.refCount++;

    let disposed = false;
    return toDisposable(() => {
      if (!disposed) {
        disposed = true;
        this.release();
      }
    });
  }

  private release(): void {
    if (--this.refCount === 0 && !this.disposed) {
      this.disposed = true;
      this.disposable.dispose();
    }
  }

  dispose(): void {
    this.release();
  }
}

/**
 * Timeout-based disposable
 */
export class TimeoutDisposable implements Disposable {
  private timeout?: NodeJS.Timeout;

  constructor(fn: () => void, delay: number) {
    this.timeout = setTimeout(fn, delay);
  }

  dispose(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}

/**
 * Interval-based disposable
 */
export class IntervalDisposable implements Disposable {
  private interval?: NodeJS.Timeout;

  constructor(fn: () => void, delay: number) {
    this.interval = setInterval(fn, delay);
  }

  dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}

/**
 * Managed event listener that auto-cleans up
 */
export class ManagedEventListener implements Disposable {
  constructor(
    private readonly target: EventTarget,
    private readonly event: string,
    private readonly handler: EventListener,
    private readonly options?: AddEventListenerOptions,
  ) {
    target.addEventListener(event, handler, options);
  }

  dispose(): void {
    this.target.removeEventListener(this.event, this.handler, this.options);
  }
}

/**
 * Create a managed event listener
 */
export function addDisposableListener(
  target: EventTarget,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions,
): Disposable {
  return new ManagedEventListener(target, event, handler, options);
}

/**
 * Weak reference store for preventing memory leaks
 */
export class WeakRefStore<T extends object> {
  private readonly refs = new Map<string, WeakRef<T>>();
  private readonly registry = new FinalizationRegistry<string>((key) => {
    this.refs.delete(key);
  });

  set(key: string, value: T): void {
    const ref = new WeakRef(value);
    this.refs.set(key, ref);
    this.registry.register(value, key);
  }

  get(key: string): T | undefined {
    const ref = this.refs.get(key);
    if (!ref) return undefined;

    const value = ref.deref();
    if (!value) {
      this.refs.delete(key);
      return undefined;
    }

    return value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.refs.delete(key);
  }

  clear(): void {
    this.refs.clear();
  }
}
