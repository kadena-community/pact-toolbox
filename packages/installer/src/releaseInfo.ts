import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { join } from 'pathe';
import { NIGHTLY_BINARIES, PACT4X_REPO, PACT5X_REPO, STABLE_BINARIES } from './constants';
import { PactInstallCommonOptions } from './types';
import { compareVersions, normalizeVersion } from './utils';

export interface GithubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  type: 'User' | 'Organization' | 'Bot';
  site_admin: boolean;
}

export interface GithubReleaseAsset {
  url: string;
  id: number;
  node_id: string;
  name: string;
  label: string | null;
  content_type: 'application/zip' | 'application/gzip';
  state: 'uploaded';
  size: number;
  uploader: GithubUser;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
}

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
  user: GithubUser;
  assets: GithubReleaseAsset[];
}

export interface PactReleaseInfo {
  latestStable: GithubRelease;
  latestNightly: GithubRelease;
  releases: GithubRelease[];
}

let pactReleases: Record<string, GithubRelease[]> = {};
let latestRelease: GithubRelease | undefined;

export async function getLatestPactReleaseInfo(nightly = false): Promise<GithubRelease> {
  if (latestRelease) {
    return latestRelease;
  }
  const pactReleases = await fetchPactGithubReleases(nightly ? PACT5X_REPO : PACT4X_REPO);
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

export async function fetchPactGithubReleases(repo = PACT4X_REPO): Promise<GithubRelease[]> {
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

export async function fetchLatestPactGithubRelease(repo = PACT4X_REPO): Promise<GithubRelease> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
  return (await res.json()) as GithubRelease;
}

export interface PactRemoteAssetInfo {
  downloadUrl: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}
export async function getPactRemoteAssetInfo(
  releases: GithubRelease[],
  version?: string,
  nightly = false,
): Promise<PactRemoteAssetInfo> {
  const release = version
    ? releases.find((r) => normalizeVersion(r.tag_name).includes(normalizeVersion(version)))
    : await getLatestPactReleaseInfo(nightly);
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
    version: normalizeVersion(release.tag_name),
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
  };
}

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
    await finished(Readable.fromWeb(res.body).pipe(writer));
    return path;
  } catch (error) {
    throw new Error(`Failed to download ${downloadUrl}: ${(error as Error).message}`);
  }
}

export async function findPactRelease({ version, nightly }: Required<PactInstallCommonOptions>) {
  version = normalizeVersion(version);
  const releases = await fetchPactGithubReleases(nightly ? PACT5X_REPO : PACT4X_REPO);
  const release = releases.find((r) => normalizeVersion(r.tag_name).includes(version));
  if (!release) {
    throw new Error(`Pact version ${version} not found`);
  }
  return release;
}
