/**
 * Token creation utilities for the DI container
 * These are defined in the types package to avoid circular dependencies
 */

/**
 * Type-safe service tokens using symbols for uniqueness
 */
export function createToken<T>(name: string): ServiceToken<T> {
  const symbol = Symbol(name);
  return { symbol, name } as ServiceToken<T>;
}

export interface ServiceToken<T> {
  symbol: symbol;
  name: string;
  _type?: T; // Phantom type for TypeScript inference
}