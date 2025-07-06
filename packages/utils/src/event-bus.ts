import type { EventHandler, IEventBus, IEventSubscription } from "@pact-toolbox/types";

/**
 * Simple event subscription implementation
 */
class EventSubscription implements IEventSubscription {
  constructor(
    private readonly eventBus: EventBus,
    private readonly event: string,
    private readonly handler: EventHandler
  ) {}

  unsubscribe(): void {
    this.eventBus.off(this.event, this.handler);
  }
}

/**
 * Event bus implementation for pub/sub communication
 */
export class EventBus implements IEventBus {
  private readonly listeners = new Map<string, Set<EventHandler>>();

  on<T = any>(event: string, handler: EventHandler<T>): IEventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return new EventSubscription(this, event, handler);
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
}

/**
 * Create a typed event bus
 */
export function createTypedEventBus<TEvents extends Record<string, any>>(): IEventBus {
  return new EventBus();
}