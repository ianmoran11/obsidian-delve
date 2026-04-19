import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      obsidian: resolve(__dirname, 'tests/mocks/obsidian.ts'),
    },
  },
});
