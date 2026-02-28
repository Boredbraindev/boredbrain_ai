import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    env: {},
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
