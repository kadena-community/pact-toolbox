import {
  compareVersions,
  execAsync,
  getInstalledPactVersion,
  logger,
  normalizeVersion,
  writeFileAtPath,
} from '@pact-toolbox/utils';
import { createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rm, symlink, unlink } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { join } from 'pathe';
import { extract } from 'tar/extract';
import { Open } from 'unzipper';

export const KADENA_ROOT_DIR = join(homedir(), '.kadena');
export const PACT_ROOT_DIR = join(KADENA_ROOT_DIR, 'pact');
export const KADENA_BIN_DIR = join(KADENA_ROOT_DIR, 'bin');
export const PACT_SYMLINK = join(KADENA_BIN_DIR, 'pact');

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
let pactReleases: Record<string, GithubRelease[]> = {};
let latestRelease: GithubRelease | undefined;

export async function findLatestRelease(nightly = false): Promise<GithubRelease> {
  if (latestRelease) {
    return latestRelease;
  }
  const pactReleases = await getPactGithubReleases(nightly ? PACT5X_REPO : PACT4X_REPO);
  latestRelease = nightly
    ? pactReleases.filter((r) => r.tag_name.includes('development')).pop() || pactReleases[0]
    : pactReleases
        .filter((r) => !r.draft && !r.prerelease)
        .sort((a, b) => compareVersions(a.tag_name, b.tag_name))
        .pop() || pactReleases[0];
  return latestRelease;
}

function isRateLimitError(data: any): data is { message: string } {
  return data.message && data.message.includes('API rate limit exceeded');
}

export async function getPactGithubReleases(repo = PACT4X_REPO): Promise<GithubRelease[]> {
  if (pactReleases[repo]) {
    return pactReleases[repo];
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/releases`);
  const data = (await res.json()) as GithubRelease[] | { message: string };
  if (isRateLimitError(data)) {
    throw new Error('API rate limit exceeded, please try again later');
  }
  pactReleases[repo] = data as GithubRelease[];
  return data;
}

export async function getPactLatestGithubRelease(repo = PACT4X_REPO): Promise<GithubRelease> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
  return (await res.json()) as GithubRelease;
}

export async function getPactDownloadInfo(releases: GithubRelease[], version?: string, nightly = false) {
  const release = version
    ? releases.find((r) => normalizeVersion(r.tag_name).includes(normalizeVersion(version)))
    : await findLatestRelease(nightly);
  if (!release) {
    throw new Error(`Could not find release for version ${version || 'latest'}`);
  }
  const binaryName = getBinaryName(normalizeVersion(release.tag_name), nightly).replace('.tar.gz', '');
  const asset = release.assets.find((a) => a.name.includes(binaryName));
  if (!asset) {
    throw new Error(
      `Could not find asset ${binaryName} in release ${release.tag_name}, check the ${release.html_url} for more details.`,
    );
  }
  return {
    downloadUrl: asset.browser_download_url,
    releaseVersion: normalizeVersion(release.tag_name),
  };
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
    arm64: 'pact-{{version}}-aarch64-osx.tar.gz',
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

interface ExtractTarballOptions {
  filter?: string[];
  executable?: string;
  writeMetadata?: boolean;
}
export async function extractTarball(
  tarball: string,
  dest: string,
  { executable = 'pact', filter, writeMetadata = true }: ExtractTarballOptions = {},
) {
  const isTarball = tarball.endsWith('.tar.gz');
  let version = dest.split('/').pop();
  version = version ? normalizeVersion(version) : undefined;
  const files: string[] = [];
  if (!existsSync(dest)) {
    await mkdir(dest, { recursive: true });
  }
  if (isTarball) {
    // Extract tarball
    await extract({
      file: tarball,
      cwd: dest,
      onentry: (entry) => {
        files.push(entry.path);
      },
      filter: (path) => (filter ? filter.some((f) => path.includes(f)) : true),
    });
  } else {
    // Extract zip file
    const directory = await Open.file(tarball);
    if (existsSync(dest)) {
      await rm(dest, { recursive: true });
    }
    await directory.extract({ path: dest, verbose: true });
    for (const entry of directory.files) {
      files.push(entry.path);
    }
  }
  // make it executable
  const binary = files.find((f) => f.endsWith(executable));
  if (binary) {
    await chmod(join(dest, binary), 0o755);
  }
  if (writeMetadata) {
    // write metadata file
    await writeFileAtPath(
      join(dest, 'metadata.json'),
      JSON.stringify(
        {
          version,
          binary,
          files,
        },
        null,
        2,
      ),
    );
  }
}
interface PactMetadata {
  version: string;
  binary: string;
  files: string[];
}
export async function switchPactVersion(version: string, binary?: string) {
  const versionDir = join(PACT_ROOT_DIR, version);
  const metadataPath = join(versionDir, 'metadata.json');
  if (!existsSync(metadataPath)) {
    throw new Error(`Could not find metadata for version ${version}`);
  }
  const metadata: PactMetadata = await readFile(metadataPath, 'utf-8')
    .then(JSON.parse)
    .catch(() => {
      throw new Error(`Could not find metadata for version ${version}`);
    });
  binary = binary || metadata.binary;
  const pactBinary = binary.startsWith('/') ? binary : join(versionDir, binary);
  if (!existsSync(pactBinary)) {
    throw new Error(`Could not find binary ${pactBinary}`);
  }
  if (!existsSync(KADENA_BIN_DIR)) {
    await mkdir(KADENA_BIN_DIR, { recursive: true });
  }
  if (existsSync(PACT_SYMLINK)) {
    await unlink(PACT_SYMLINK);
  }
  await symlink(pactBinary, PACT_SYMLINK, 'file');
  logger.success(`Switched to pact version ${version}`);
}

export async function listRemotePactVersions() {
  const releases = await getPactGithubReleases(PACT4X_REPO);
  const nightlyReleases = await getPactGithubReleases(PACT5X_REPO);
  return {
    [PACT4X_REPO]: releases.map((r) => ({
      version: r.tag_name,
      publishedAt: r.published_at,
      prerelease: r.prerelease || r.draft || r.tag_name.includes('development'),
    })),
    [PACT5X_REPO]: nightlyReleases.map((r) => ({
      version: r.tag_name,
      publishedAt: r.published_at,
      prerelease: r.prerelease || r.draft || r.tag_name.includes('development'),
    })),
  };
}

export function isNightlyPactVersion(version: string) {
  return version.includes('nightly') || version.includes('dev') || version.includes('5.0');
}

export async function listInstalledPactVersions() {
  const versions: {
    version: string;
    path: string;
    isActive: boolean;
  }[] = [];
  const installedVersion = await getInstalledPactVersion();
  if (!existsSync(PACT_ROOT_DIR)) {
    return versions;
  }
  for (const f of await readdir(PACT_ROOT_DIR)) {
    const areNightly = isNightlyPactVersion(f) && installedVersion && isNightlyPactVersion(installedVersion);
    const isActive = installedVersion ? normalizeVersion(f).includes(normalizeVersion(installedVersion)) : false;
    versions.push({
      version: f,
      path: join(PACT_ROOT_DIR, f),
      isActive: areNightly || isActive,
    });
  }

  return versions;
}

export async function removePactVersion(version: string) {
  const versionDir = join(PACT_ROOT_DIR, version);
  const exists = existsSync(versionDir);
  if (!exists) {
    throw new Error(`Pact version ${version} not found`);
  }
  await rm(versionDir, { recursive: true });
}

export async function checkPactVersion(version?: string, nightly = false) {
  const latestStable = await getPactLatestGithubRelease(nightly ? PACT5X_REPO : PACT4X_REPO);
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

export async function isZ3Installed() {
  return execAsync('z3 --version')
    .then(() => true)
    .catch(() => false);
}
export async function installZ3() {
  logger.start(`Installing Z3`);
  const z3Path = await downloadTarball(Z3_URL);
  await extractTarball(z3Path, KADENA_BIN_DIR, {
    executable: 'z3',
    writeMetadata: false,
    filter: ['z3'],
  });
  logger.success(`Z3 installed successfully 🎉`);
}

export async function installPact(version?: string, nightly = false) {
  const repo = nightly ? PACT5X_REPO : PACT4X_REPO;
  const releases = await getPactGithubReleases(repo);
  if (!version) {
    version = (await getPactLatestGithubRelease(repo)).tag_name;
  }
  const { downloadUrl, releaseVersion } = await getPactDownloadInfo(releases, version, nightly);
  const { isMatching, isInstalled } = await checkPactVersion(releaseVersion);
  const versionDir = join(PACT_ROOT_DIR, releaseVersion);
  if (isInstalled && isMatching) {
    logger.info(`Pact version ${releaseVersion} is already installed at ${versionDir}`);
    return;
  }
  logger.start(`Installing Pact version ${releaseVersion}`);
  const path = await downloadTarball(downloadUrl);
  await extractTarball(path, versionDir, {
    executable: 'pact',
  });

  if (!(await isZ3Installed())) {
    await installZ3();
  }
  logger.success(`Pact installed successfully 🎉`);
  if (!isInstalled) {
    await switchPactVersion(releaseVersion);
  }
  logger.box(`Make sure it's in your shell PATH \n\`export PATH="$PATH:${KADENA_BIN_DIR}"\``);
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
