import { exec } from "node:child_process";
import { promisify } from "node:util";

/**
 * Promisified version of Node.js exec function for running shell commands.
 *
 * @param command - The command to execute
 * @returns Promise with stdout and stderr output
 * @throws {Error} If the command fails with non-zero exit code
 *
 * @example
 * ```typescript
 * import { execAsync } from '@pact-toolbox/node-utils';
 *
 * try {
 *   const { stdout, stderr } = await execAsync('ls -la');
 *   console.log('Output:', stdout);
 * } catch (error) {
 *   console.error('Command failed:', error);
 * }
 * ```
 */
export const execAsync: typeof exec.__promisify__ = promisify(exec);
