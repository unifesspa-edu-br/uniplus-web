import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/tools/vitest',
  test: {
    name: '@uniplus/vitest',
    watch: false,
    environment: 'node',
    include: ['*.spec.ts'],
    reporters: ['default'],
  },
});
