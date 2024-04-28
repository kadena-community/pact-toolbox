import { homedir } from 'node:os';
import { join } from 'pathe';

export const KADENA_ROOT_DIR = join(homedir(), '.kadena');
export const PACT_ROOT_DIR = join(KADENA_ROOT_DIR, 'pact');
export const KADENA_BIN_DIR = join(KADENA_ROOT_DIR, 'bin');
export const PACT_SYMLINK = join(KADENA_BIN_DIR, 'pact');

export const PACT4X_REPO = 'kadena-io/pact';
export const PACT5X_REPO = 'kadena-io/pact-5';

export const Z3_URL = 'https://github.com/kadena-io/pact/releases/download/v4.1/z3-4.8.10-osx.tar.gz';

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
