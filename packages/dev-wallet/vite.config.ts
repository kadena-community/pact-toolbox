import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist-browser',
    lib: {
      entry: 'src/index.ts',
      name: 'DevWallet',
      formats: ['es', 'umd']
    }
  }
});