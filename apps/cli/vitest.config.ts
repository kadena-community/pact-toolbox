import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 1000000,
    hookTimeout: 1000000,
    // ...
  },
});