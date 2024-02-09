import { GitInfo } from 'giget';
import Handlebars from 'handlebars';
import { PactDependency } from './types';

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

export function renderTemplate(template: string, data: any) {
  const compiled = Handlebars.compile(template);
  return compiled(data);
}
