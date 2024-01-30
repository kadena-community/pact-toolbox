import { GitInfo } from 'giget';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { PactDependency } from '../config';
const inputRegex = /^(?<provider>[\w-.]+):(?<repo>[\w.-]+\/[\w.-]+)(?<subdir>[^#]+)?#?(?<ref>[\w./-]+)?/;
const providerShortcuts: Record<string, string> = {
  gh: 'github',
  gl: 'gitlab',
  bb: 'bitbucket',
  sh: 'sourcehut',
};

export function parseGitURI(input: string): GitInfo {
  const m = input.match(inputRegex)?.groups || {};
  const provider = m.provider || 'github';
  return {
    provider: (providerShortcuts[provider] || provider) as GitInfo['provider'],
    repo: m.repo,
    subdir: m.subdir || '/',
    ref: m.ref ?? 'main',
  };
}

export function preludeSpec(
  name: string,
  uri: string,
  group: string = 'root',
  requires: PactDependency[] = [],
): PactDependency {
  return {
    name,
    uri,
    requires,
    group,
  };
}

export const execAsync = promisify(exec);
