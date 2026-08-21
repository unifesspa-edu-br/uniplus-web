import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import * as path from 'node:path';

/**
 * Config dedicada à validação de login OIDC (PKCE) sob subpath real
 * (Story #449). Diferente de `playwright.config.ts` (app servido pelo
 * dev server do Nx, sempre na raiz), aqui o alvo é a IMAGEM DOCKER real
 * do portal (mesmo `docker/Dockerfile.portal` publicado em produção),
 * rodando com `APP_BASE_HREF=/portal/` — único jeito de exercitar de
 * verdade o nginx.conf.template parametrizado por subpath (Story #448) e
 * o redirect de logout relativo a `document.baseURI` (Story #447). O dev
 * server nunca reproduziria esses dois: serve sempre em `/`, sem CSP,
 * sem o mecanismo de rewrite de path do nginx.
 *
 * Orquestrado por `tools/e2e-docker/run.sh` (build da imagem + docker run
 * mapeando a porta 4212 + patch do runtime-config.json apontando pro
 * Keycloak local) — sem `webServer` aqui porque o ciclo de vida do
 * container é gerenciado pelo script, não pelo Playwright.
 */
const baseURL = process.env['BASE_URL'] || 'http://localhost:4212/portal/';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src/specs-subpath' }),
  outputDir: path.join(workspaceRoot, 'tmp/playwright/portal-e2e-subpath'),
  reporter: [
    ['html', { outputFolder: path.join(workspaceRoot, 'tmp/playwright/portal-e2e-subpath-report') }],
    ['line'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Certificado autoassinado só é relevante em HML real — localhost usa
    // HTTP puro (a imagem nginx não termina TLS sozinha).
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
