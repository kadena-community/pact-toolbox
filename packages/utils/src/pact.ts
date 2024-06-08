import { execAsync } from "./helpers";

export const PACT_VERSION_REGEX = /(\d+)\.(\d+)(?:\.(\d+))?(-[A-Za-z0-9]+)?/;

export async function isAnyPactInstalled(match?: string) {
  const version = await getCurrentPactVersion();
  return match ? version?.includes(match) : !!version;
}

export async function getCurrentPactVersion() {
  try {
    const { stdout } = await execAsync("pact --version");
    const match = stdout.match(PACT_VERSION_REGEX);
    if (match) {
      return match[0];
    }
  } catch (error) {
    return undefined;
  }
}

export async function installPact(version?: string, nightly?: boolean) {
  if (nightly) {
    return execAsync("npx pactup install --nightly");
  }

  if (version) {
    return execAsync(`npx pactup install ${version}`);
  }

  return execAsync("npx pactup install --latest");
}
