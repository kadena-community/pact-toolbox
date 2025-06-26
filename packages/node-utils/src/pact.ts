import { execAsync } from "./helpers";

/**
 * Regular expression for parsing Pact version strings.
 * Matches patterns like: 4.11.0, 4.11, 4.11.0-dev
 */
export const PACT_VERSION_REGEX: RegExp = /(\d+)\.(\d+)(?:\.(\d+))?(-[A-Za-z0-9]+)?/;

/**
 * Checks if Pact is installed on the system.
 * 
 * @param match - Optional string to match against the version (e.g., "4.11")
 * @returns true if Pact is installed (and optionally matches the version)
 * 
 * @example
 * ```typescript
 * // Check if any Pact is installed
 * if (await isAnyPactInstalled()) {
 *   console.log('Pact is installed');
 * }
 * 
 * // Check if Pact 4.11 is installed
 * if (await isAnyPactInstalled('4.11')) {
 *   console.log('Pact 4.11 is installed');
 * }
 * ```
 */
export async function isAnyPactInstalled(match?: string): Promise<boolean> {
  const version = await getCurrentPactVersion();
  return match ? (version?.includes(match) ?? false) : !!version;
}

/**
 * Gets the currently installed Pact version.
 * 
 * @returns The version string (e.g., "4.11.0") or undefined if Pact is not installed
 * 
 * @example
 * ```typescript
 * const version = await getCurrentPactVersion();
 * if (version) {
 *   console.log(`Pact version: ${version}`);
 * } else {
 *   console.log('Pact is not installed');
 * }
 * ```
 */
export async function getCurrentPactVersion(): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync("pact --version");
    const match = stdout.match(PACT_VERSION_REGEX);
    if (match) {
      return match[0];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Installs Pact using pactup.
 * 
 * @param version - Specific version to install (e.g., "4.11.0")
 * @param nightly - Whether to install the nightly build
 * @returns Command output with stdout and stderr
 * @throws {Error} If installation fails
 * 
 * @example
 * ```typescript
 * // Install latest stable version
 * await installPact();
 * 
 * // Install specific version
 * await installPact('4.11.0');
 * 
 * // Install nightly build
 * await installPact(undefined, true);
 * ```
 */
export async function installPact(
  version?: string,
  nightly?: boolean,
): Promise<{ stdout: string | Buffer; stderr: string | Buffer }> {
  if (nightly) {
    return execAsync("npx pactup install --nightly");
  }

  if (version) {
    return execAsync(`npx pactup install ${version}`);
  }

  return execAsync("npx pactup install --latest");
}
