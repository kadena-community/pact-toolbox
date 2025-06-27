import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '*.config.*',
        'coverage/**',
      ],
    },
    testTimeout: 15000, // Longer timeout for Docker tests
    setupFiles: ['./vitest.setup.ts'],
  },
});