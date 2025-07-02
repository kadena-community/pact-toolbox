import config from '@pact-toolbox/vitest-config/node';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...config,
  test: {
    ...config.test,
  },
});