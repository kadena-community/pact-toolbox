export { compareVersions, getCurrentPactVersion, isAnyPactInstalled, normalizeVersion } from '@pact-toolbox/utils';

export function isNightlyPactVersion(version: string) {
  return version.includes('nightly') || version.includes('dev') || version.includes('5.0');
}
