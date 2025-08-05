import type { EventHandler, IEventBus, IEventSubscription } from "@pact-toolbox/types";
import type { Disposable } from "./lifecycle";
import { toDisposable } from "./lifecycle";

/**
 * Simple event subscription implementation
 */
class EventSubscription implements IEventSubscription, Disposable {
  private disposed = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly event: string,
    private readonly handler: EventHandler
  ) {}

  unsubscribe(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.eventBus.off(this.event, this.handler);
    }
  }

  dispose(): void {
    this.unsubscribe();
  }
}

/**
 * Event bus implementation for pub/sub communication
 */
export class EventBus implements IEventBus, Disposable {
  private readonly listeners = new Map<string, Set<EventHandler>>();
  private readonly subscriptions = new WeakMap<EventHandler, Set<EventSubscription>>();
  private disposed = false;

  on<T = any>(event: string, handler: EventHandler<T>): IEventSubscription {
    if (this.disposed) {
      throw new Error("Cannot add listener to disposed EventBus");
    }
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    
    const subscription = new EventSubscription(this, event, handler);
    
    // Track subscription for cleanup
    if (!this.subscriptions.has(handler)) {
      this.subscriptions.set(handler, new Set());
    }
    this.subscriptions.get(handler)!.add(subscription);
    
    return subscription;
  }

  once<T = any>(event: string, handler: EventHandler<T>): IEventSubscription {
    const wrappedHandler: EventHandler<T> = (data) => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    return this.on(event, wrappedHandler);
  }

  off<T = any>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T = any>(event: string, data?: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      // Create a copy to avoid issues if handlers modify the set
      const handlersCopy = Array.from(handlers);
      for (const handler of handlersCopy) {
        try {
          const result = handler(data);
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error(`Event handler error for "${event}":`, error);
            });
          }
        } catch (error) {
          console.error(`Event handler error for "${event}":`, error);
        }
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of listeners for a specific event
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get all registered events
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Dispose the event bus and clean up all listeners
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    
    this.disposed = true;
    this.clear();
  }

  /**
   * Check if the event bus has been disposed
   */
  get isDisposed(): boolean {
    return this.disposed;
  }
}

/**
 * Create a typed event bus
 */
export function createTypedEventBus<TEvents extends Record<string, any>>(): IEventBus {
  return new EventBus();
}