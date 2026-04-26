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
  webServer: {
    command: 'npx nx run poc-primeng:serve-static',
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
