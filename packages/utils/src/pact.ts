import { execAsync } from './helpers';

export const PACT_VERSION_REGEX = /(\d+)\.(\d+)(?:\.(\d+))?(-[A-Za-z0-9]+)?/;

export function normalizeVersion(version: string) {
  if (version.match(/^v\d+\.\d+\.\d+$/)) {
    return version.slice(1);
  }
  return version;
}

export async function isPactInstalled(match?: string) {
  const version = await getInstalledPactVersion();
  return match ? version?.includes(match) : !!version;
}

export async function getInstalledPactVersion() {
  try {
    const { stdout } = await execAsync('pact --version');
    const match = stdout.match(PACT_VERSION_REGEX);
    if (match) {
      return match[0];
    }
  } catch (error) {
    return undefined;
  }
}

export function compareVersions(version1: string, version2: string) {
  version1 = normalizeVersion(version1).replace('v', '');
  version2 = normalizeVersion(version2).replace('v', '');

  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);

  // Pad the shorter array with zeros
  while (parts1.length < parts2.length) parts1.push(0);
  while (parts2.length < parts1.length) parts2.push(0);

  for (let i = 0; i < parts1.length; i++) {
    if (parts1[i] > parts2[i]) return 1; // version1 is greater
    if (parts1[i] < parts2[i]) return -1; // version2 is greater
  }

  return 0; // versions are equal
}
