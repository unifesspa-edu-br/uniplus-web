/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/configuracao',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  test: {
    name: 'configuracao',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    // O pool `vmThreads` (padrão do plugin Angular) acumula memória a cada arquivo. O limite padrão é
    // proporcional à memória da máquina e passa do teto de 4 GB do trabalhador: sem este valor, o
    // trabalhador morre antes de ser reciclado.
    vmMemoryLimit: '1GB',
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/configuracao',
      provider: 'v8' as const,
    },
  },
}));
