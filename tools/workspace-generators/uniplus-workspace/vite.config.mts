import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../../node_modules/.vite/tools/workspace-generators/uniplus-workspace',
  test: {
    name: '@uniplus/workspace',
    watch: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../../coverage/tools/workspace-generators/uniplus-workspace',
    },
  },
});
