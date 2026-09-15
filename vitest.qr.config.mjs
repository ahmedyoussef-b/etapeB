import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve('src') } },
  oxc: false,
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['qr-component.test.tsx'],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
