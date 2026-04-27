import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4230';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  // Limita paralelismo e adiciona retries para mitigar
  // `page.screenshot: Protocol error (Page.captureScreenshot)` sob carga
  // (Chromium crashando em dev machine com workers paralelos + screenshots
  // fullPage). Ver #123 para detalhes.
  workers: process.env['CI'] ? 1 : 2,
  retries: process.env['CI'] ? 2 : 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'pt-BR',
    timezoneId: 'America/Belem',
  },
  // Antes usava `npx nx run poc-primeng:serve-static`, que delega ao
  // `@nx/web:file-server`. Esse executor registra o mesmo handler em
  // `exit` e `SIGTERM` para fazer `unlinkSync('404.html')` no shutdown
  // (ver node_modules/@nx/web/src/executors/file-server/file-server.impl.js
  // linhas 195–202) — o segundo disparo do handler crasha com ENOENT.
  // Substituir pelo `http-server` direto evita o bug e mantém o mesmo
  // comportamento de SPA fallback via `--proxy ?`. Ver #131.
  webServer: {
    command:
      'npx nx run poc-primeng:build && npx http-server dist/apps/poc-primeng/browser -p 4230 -s -c-1 --cors --proxy "http://localhost:4230?"',
    url: 'http://localhost:4230',
    reuseExistingServer: true,
    cwd: workspaceRoot,
    timeout: 180000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
