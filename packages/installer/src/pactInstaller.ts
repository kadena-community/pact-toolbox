import { compareVersions, getInstalledPactVersion, logger, normalizeVersion } from '@pact-toolbox/utils';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { join } from 'pathe';
import { extract } from 'tar/extract';

const PACT_INSTALL_DIR = join(homedir(), '.local', 'bin');
// pact --version returns something like "pact version 4.0.0"
export interface GithubRelease {
  id: number;
  tag_name: string;
  body: string;
  published_at: string;
  created_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  url: string;
  user: {
    login: string;
    id: number;
    url: string;
  };
  assets: {
    name: string;
    browser_download_url: string;
  }[];
}
export interface PactReleaseInfo {
  latestStable: GithubRelease;
  latestNightly: GithubRelease;
  releases: GithubRelease[];
}

export const PACT4X_REPO = 'kadena-io/pact';
export const PACT5X_REPO = 'kadena-io/pact-5';
let pactReleases: GithubRelease[] | undefined;

export async function findLatestRelease(nightly = false): Promise<GithubRelease> {
  if (!pactReleases) {
    pactReleases = await getPactGithubReleases(nightly ? PACT5X_REPO : PACT4X_REPO);
  }
  return nightly
    ? pactReleases.filter((r) => r.tag_name.includes('development')).pop() || pactReleases[0]
    : pactReleases
        .filter((r) => !r.draft && !r.prerelease)
        .sort((a, b) => compareVersions(a.tag_name, b.tag_name))
        .pop() || pactReleases[0];
}

export async function getPactGithubReleases(repo = PACT4X_REPO): Promise<GithubRelease[]> {
  if (Array.isArray(pactReleases)) {
    return pactReleases;
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/releases`);
  const data = (await res.json()) as GithubRelease[];
  pactReleases = data;
  return data;
}

export async function getPactLatestGithubRelease(repo = PACT4X_REPO): Promise<GithubRelease> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
  return (await res.json()) as GithubRelease;
}

export async function getDownloadUrl(releases: GithubRelease[], version?: string, nightly = false) {
  const latest = await findLatestRelease(nightly);
  const release =
    !version || normalizeVersion(latest.tag_name) === version
      ? latest
      : releases.find((r) => normalizeVersion(r.tag_name).includes(version));
  if (release) {
    const binaryName = getBinaryName(normalizeVersion(release.tag_name), nightly);
    const asset = release.assets.find((a) => a.name === binaryName);
    if (asset) {
      return asset.browser_download_url;
    }
  }
  throw new Error(`Could not find release for version ${version || 'latest'}`);
}

const Z3_URL = 'https://github.com/kadena-io/pact/releases/download/v4.1/z3-4.8.10-osx.tar.gz';

export const NIGHTLY_BINARIES: Record<string, Record<string, string>> = {
  darwin: {
    x64: 'pact-binary-bundle.macos-latest.tar.gz',
    arm64: 'pact-binary-bundle.macos-m1.tar.gz',
  },
  linux: {
    x64: 'pact-binary-bundle.ubuntu-latest.tar.gz',
  },
};

export const STABLE_BINARIES: Record<string, Record<string, string>> = {
  darwin: {
    x64: 'pact-{{version}}-osx.tar.gz',
    arm64: 'pact-{{version}}-osx.tar.gz',

    // arm64: 'pact-{{version}}-aarch64-osx.tar.gz',
  },
  linux: {
    x64: 'pact-{{version}}-linux-22.04.tar.gz',
  },
};
export function getBinaryName(version: string, nightly = false) {
  const binaries = nightly ? NIGHTLY_BINARIES : STABLE_BINARIES;
  const platform = process.platform;
  const arch = process.arch;
  const binaryName = binaries[platform]?.[arch].replace('{{version}}', version);
  if (!binaryName) {
    throw new Error(`Binary not found for ${platform} ${arch}, version ${version}, make sure it's supported.`);
  }
  return binaryName;
}

export async function downloadTarball(downloadUrl: string): Promise<string> {
  try {
    const res = await fetch(downloadUrl);
    const dest = downloadUrl.split('/').pop() as string;
    const path = join(tmpdir(), dest);
    if (!res.ok) {
      throw new Error(`Failed to download ${downloadUrl}`);
    }

    // Save the file locally
    const writer = createWriteStream(path);
    if (!res.body) {
      throw new Error('Response body is undefined');
    }
    // @ts-ignore
    await finished(Readable.fromWeb(res.body).pipe(writer));
    return path;
  } catch (error) {
    throw new Error(`Failed to download ${downloadUrl}: ${(error as Error).message}`);
  }
}

export async function extractTarball(tarball: string, dest: string, executable = 'pact', filter?: string[]) {
  const files: string[] = [];
  await mkdir(dest, { recursive: true });
  // Extract the file
  await extract({
    file: tarball,
    cwd: dest,
    onentry: (entry) => {
      files.push(entry.path);
    },
    filter: (path) => (filter ? filter.some((f) => path.includes(f)) : true),
  });
  // make it executable
  const filename = files.find((f) => f.endsWith(executable));
  if (filename) {
    await chmod(join(dest, filename), 0o755);
  }
}
export async function checkPactVersion(version?: string) {
  const latestStable = await getPactLatestGithubRelease();
  const latestVersion = latestStable.tag_name;
  if (!version) {
    version = latestVersion;
  }
  const installedVersion = await getInstalledPactVersion();
  const info = {
    isInstalled: false,
    isMatching: false,
    isOlder: false,
    isNewer: false,
    installedVersion,
    latestVersion,
  };

  if (!installedVersion) {
    return info;
  }

  if (!version) {
    return {
      ...info,
      isInstalled: true,
    };
  }

  const comparison = compareVersions(version, installedVersion);
  if (comparison === 0) {
    return {
      ...info,
      isInstalled: true,
      isMatching: true,
    };
  }

  if (comparison === 1) {
    return {
      ...info,
      isInstalled: true,
      isOlder: true,
    };
  }

  return {
    ...info,
    isInstalled: true,
    isNewer: true,
  };
}

export async function lookupPactVersion(version: string) {
  version = normalizeVersion(version);
  const releases = await getPactGithubReleases();
  const release = releases.find((r) => normalizeVersion(r.tag_name).includes(version));
  if (!release) {
    throw new Error(`Pact version ${version} not found`);
  }
  return release;
}

export async function installPact(version?: string, nightly = false) {
  const releases = await getPactGithubReleases(nightly ? PACT5X_REPO : PACT4X_REPO);
  const downloadUrl = await getDownloadUrl(releases, version, nightly);
  const { isMatching, isInstalled } = await checkPactVersion(version);
  if (isInstalled && isMatching) {
    logger.info(`Pact version ${version} is already installed at ${PACT_INSTALL_DIR}/pact`);
    return;
  }

  logger.start(`Installing Pact version ${version}`);
  const path = await downloadTarball(downloadUrl);
  await extractTarball(path, PACT_INSTALL_DIR);
  logger.success(`Pact installed successfully 🎉`);
  logger.start(`Installing Z3`);
  const z3Path = await downloadTarball(Z3_URL);
  await extractTarball(z3Path, PACT_INSTALL_DIR);
  logger.success(`Z3 installed successfully 🎉`);
  logger.box(`Make sure it's in your shell PATH \n\`export PATH="$PATH:${PACT_INSTALL_DIR}"\``);
}

export async function isPactUpToDate() {
  const latestRelease = await findLatestRelease();
  const { isInstalled, isMatching } = await checkPactVersion(latestRelease.tag_name);
  return isInstalled && isMatching;
}

export async function upgradePact() {
  const { isInstalled, isMatching, isNewer, installedVersion, latestVersion } = await checkPactVersion();

  if (isInstalled && isMatching) {
    logger.info(`Pact is already up to date at version ${installedVersion}`);
    return;
  }

  if (isNewer) {
    logger.info(`Pact version ${installedVersion} is newer than ${latestVersion}`);
    return;
  }

  if (!isInstalled) {
    logger.start(`Pact is not installed, Installing version ${latestVersion}`);
  } else {
    logger.start(`Upgrading Pact from ${installedVersion} to ${latestVersion}`);
  }
  await installPact(latestVersion);
  logger.box(`Pact upgraded successfully 🎉`);
}

export async function versionCheckMiddleware() {
  const { isInstalled, isMatching, isNewer, installedVersion, latestVersion } = await checkPactVersion();

  if (!isInstalled) {
    logger.error(`Pact is not installed, please install it first using \`pact-toolbox pact install\``);
    process.exit(1);
  }

  if (!isMatching) {
    logger.info(
      `Pact version ${latestVersion} is released, please upgrade using \`pact-toolbox pact upgrade\` or \`pact-toolbox pact install ${latestVersion}\``,
    );
  }

  if (isNewer) {
    logger.warn(`Pact version ${installedVersion} is newer than latest released version ${latestVersion}!`);
  }
}
