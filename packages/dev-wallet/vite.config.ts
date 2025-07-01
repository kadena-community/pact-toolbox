import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    solidPlugin(),
    dts({
      rollupTypes: true,
      insertTypesEntry: true,
    }),
  ],
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'esnext',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    minify: false,
    rollupOptions: {
      external: [
        '@pact-toolbox/chainweb-client',
        '@pact-toolbox/crypto',
        '@pact-toolbox/kda',
        '@pact-toolbox/network-config',
        '@pact-toolbox/signers',
        '@pact-toolbox/types',
        '@pact-toolbox/ui-shared',
        '@pact-toolbox/utils',
        '@pact-toolbox/wallet-core',
        'solid-js',
        'solid-js/web',
        'solid-js/store',
        'goober',
        'clsx',
        'idb',
        'lit',
      ],
      output: {
        preserveModules: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.ts'],
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    deps: {
      optimizer: {
        web: {
          exclude: ['solid-js'],
        },
      },
    },
  },
});