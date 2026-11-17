import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/tools/eslint',
  test: {
    name: '@uniplus/eslint',
    watch: false,
    environment: 'node',
    include: ['*.spec.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/tools/eslint',
    },
  },
});
