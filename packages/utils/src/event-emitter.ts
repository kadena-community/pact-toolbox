/**
 * Simple, cross-platform EventEmitter implementation
 * Compatible with both browser and Node.js environments
 */

/**
 * Default event map for when no specific event map is provided
 */
type DefaultEventMap = Record<string | symbol | number, (...args: any[]) => void>;

/**
 * Generic EventEmitter that provides type safety for events
 * @template T - Event map type where keys are event names and values are listener functions
 *
 * Usage:
 * ```typescript
 * interface MyEvents {
 *   data: (value: string) => void;
 *   error: (error: Error) => void;
 *   complete: () => void;
 * }
 *
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('data', (value) => console.log(value)); // value is typed as string
 * emitter.emit('data', 'hello'); // enforces string argument
 * ```
 */
export class EventEmitter<T = DefaultEventMap> {
  private events = new Map<keyof T, T[keyof T][]>();

  /**
   * Add a listener for the specified event
   */
  on<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this {
    const listeners = this.events.get(event) ?? [];
    listeners.push(listener);
    this.events.set(event, listeners);
    return this;
  }

  /**
   * Add a one-time listener for the specified event
   */
  once<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this {
    const onceWrapper = ((...args: T[K] extends (...args: infer P) => any ? P : never[]) => {
      this.off(event, onceWrapper as T[K] extends (...args: any[]) => any ? T[K] : never);
      (listener as any)(...args);
    }) as T[K] extends (...args: any[]) => any ? T[K] : never;

    return this.on(event, onceWrapper);
  }

  /**
   * Remove a listener for the specified event
   */
  off<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this.events.delete(event);
        }
      }
    }
    return this;
  }

  /**
   * Remove all listeners for the specified event, or all listeners if no event specified
   */
  removeAllListeners<K extends keyof T>(event?: K): this {
    if (event !== undefined) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Emit an event with the given arguments
   */
  emit<K extends keyof T>(event: K, ...args: T[K] extends (...args: infer P) => any ? P : never[]): boolean {
    const listeners = this.events.get(event);
    if (listeners && listeners.length > 0) {
      // Create a copy to avoid issues if listeners are modified during emission
      const listenersCopy = [...listeners];
      for (const listener of listenersCopy) {
        try {
          (listener as any)(...args);
        } catch (error) {
          // Don't let listener errors break other listeners
          console.error(`Error in event listener for '${String(event)}':`, error);
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Get the number of listeners for the specified event
   */
  listenerCount<K extends keyof T>(event: K): number {
    const listeners = this.events.get(event);
    return listeners?.length ?? 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): (keyof T)[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get all listeners for the specified event
   */
  listeners<K extends keyof T>(event: K): Array<T[K] extends (...args: any[]) => any ? T[K] : never> {
    const listeners = this.events.get(event);
    return listeners ? ([...listeners] as any) : [];
  }

  /**
   * Check if there are any listeners for the specified event
   */
  hasListeners<K extends keyof T>(event: K): boolean {
    return this.listenerCount(event) > 0;
  }

  /**
   * Prepend a listener to the beginning of the listeners array for the specified event
   */
  prependListener<K extends keyof T>(event: K, listener: T[K] extends (...args: any[]) => any ? T[K] : never): this {
    const listeners = this.events.get(event) ?? [];
    listeners.unshift(listener);
    this.events.set(event, listeners);
    return this;
  }

  /**
   * Add a one-time listener to the beginning of the listeners array for the specified event
   */
  prependOnceListener<K extends keyof T>(
    event: K,
    listener: T[K] extends (...args: any[]) => any ? T[K] : never,
  ): this {
    const onceWrapper = ((...args: T[K] extends (...args: infer P) => any ? P : never[]) => {
      this.off(event, onceWrapper as T[K] extends (...args: any[]) => any ? T[K] : never);
      (listener as any)(...args);
    }) as T[K] extends (...args: any[]) => any ? T[K] : never;

    return this.prependListener(event, onceWrapper);
  }
}
