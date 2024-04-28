import { logger } from '@pact-toolbox/utils';
import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'pathe';

export function getShellProfile(shell: string) {
  if (shell.includes('zsh')) {
    return join(homedir(), '.zshrc');
  }

  if (shell.includes('bash')) {
    return join(homedir(), '.bashrc');
  }

  if (shell.includes('fish')) {
    return join(homedir(), '.config/fish/config.fish');
  }

  return null;
}

export function getShellProfileScript() {
  return `
# Pact Toolbox
export PATH="$PATH:$HOME/.kadena/bin"
`;
}

export function isKadenaBinInPath() {
  const path = process.env.PATH;
  if (!path) {
    return false;
  }
  return path.includes('.kadena/bin');
}
export async function updateShellProfileScript() {
  if (isKadenaBinInPath()) {
    return;
  }
  const shell = process.env.SHELL;
  if (!shell) {
    throw new Error('SHELL environment variable is not set');
  }
  const profile = getShellProfile(shell);
  const script = getShellProfileScript();
  if (!profile) {
    throw new Error('Shell profile not found');
  }
  if (!script) {
    throw new Error('Shell profile script not found');
  }
  if (profile.includes(script)) {
    return;
  }
  await appendFile(profile, script);
  logger.box(`Shell profile updated. Please restart your shell to apply changes.\n or run \n\`. ${profile}\``);
}
