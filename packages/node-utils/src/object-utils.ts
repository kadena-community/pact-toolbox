/**
 * Object manipulation utilities
 * Centralized to ensure consistent versions across the monorepo
 */

/**
 * Re-exports from defu for deep object merging.
 * 
 * - `defu`: Default/base function for deep merging objects
 * - `defuFn`: Allows custom merge functions for specific keys
 * - `defuArrayFn`: Special handling for array merging
 * - `createDefu`: Create a custom defu instance with specific options
 * 
 * @example
 * ```typescript
 * import { defu } from '@pact-toolbox/node-utils';
 * 
 * const defaults = {
 *   server: { port: 3000, host: 'localhost' },
 *   features: { auth: true, logging: true }
 * };
 * 
 * const userConfig = {
 *   server: { port: 8080 },
 *   features: { logging: false }
 * };
 * 
 * const config = defu(userConfig, defaults);
 * // Result: {
 * //   server: { port: 8080, host: 'localhost' },
 * //   features: { auth: true, logging: false }
 * // }
 * ```
 */
export { defu, defuFn, defuArrayFn, createDefu } from "defu";