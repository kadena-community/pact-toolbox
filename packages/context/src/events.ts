import { EventEmitter } from '@pact-toolbox/utils';
import type { ContextEventMap } from './types';

// Create a typed event emitter using the existing EventEmitter from utils
export const eventBus = new EventEmitter<ContextEventMap>();

// Export convenience methods
export const emit = eventBus.emit.bind(eventBus);
export const on = eventBus.on.bind(eventBus);
export const off = eventBus.off.bind(eventBus);

// Helper to create typed event listeners
export function createEventListener<K extends keyof ContextEventMap>(
  event: K,
  handler: ContextEventMap[K]
) {
  eventBus.on(event, handler as any);
  return () => eventBus.off(event, handler as any);
}