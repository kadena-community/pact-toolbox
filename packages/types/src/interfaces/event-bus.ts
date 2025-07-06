/**
 * Event handler function type
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Event subscription interface
 */
export interface IEventSubscription {
  /**
   * Unsubscribe from the event
   */
  unsubscribe(): void;
}

/**
 * Event bus interface for pub/sub communication
 */
export interface IEventBus {
  /**
   * Subscribe to an event
   * @param event - The event name
   * @param handler - The event handler
   */
  on<T = any>(event: string, handler: EventHandler<T>): IEventSubscription;
  
  /**
   * Subscribe to an event once
   * @param event - The event name
   * @param handler - The event handler
   */
  once<T = any>(event: string, handler: EventHandler<T>): IEventSubscription;
  
  /**
   * Unsubscribe from an event
   * @param event - The event name
   * @param handler - The event handler
   */
  off<T = any>(event: string, handler: EventHandler<T>): void;
  
  /**
   * Emit an event
   * @param event - The event name
   * @param data - The event data
   */
  emit<T = any>(event: string, data?: T): void;
  
  /**
   * Clear all event listeners
   */
  clear(): void;
}

/**
 * Typed event bus interface with event type mapping
 */
export interface ITypedEventBus<TEvents extends Record<string, any>> {
  /**
   * Subscribe to a typed event
   */
  on<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): IEventSubscription;
  
  /**
   * Subscribe to a typed event once
   */
  once<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): IEventSubscription;
  
  /**
   * Unsubscribe from a typed event
   */
  off<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): void;
  
  /**
   * Emit a typed event
   */
  emit<K extends keyof TEvents>(event: K, data?: TEvents[K]): void;
  
  /**
   * Clear all event listeners
   */
  clear(): void;
}