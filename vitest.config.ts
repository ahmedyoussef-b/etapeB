import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    environment: process.env.VITEST_ENV || 'node',
    environmentOptions: {
      'node': {
        globalObject: 'globalThis',
      },
    },
    setupFiles: ['./vitest.setup.ts'],
  },
});
