import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.tsx',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react'],
  target: 'es2022',
});