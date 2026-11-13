import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // The browser entry: component, composables, plugin. Safe to import on the server.
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    target: 'es2019',
    external: ['vue'],
  },
  {
    // The server entry (identity verification).
    entry: { server: 'src/server.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    target: 'es2020',
  },
]);
