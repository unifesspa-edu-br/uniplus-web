import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import * as path from 'node:path';
import { STORAGE_STATE_PATH_ADMIN } from './src/fixtures/auth.fixture';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

// webkit requer libs Ubuntu (libicudata.so.74, libxml2.so.2 etc.) — só executa em CI.
// Localmente em distros não-Debian, defina CI=true para incluir webkit.
const isCI = !!process.env['CI'];

const storageStateAdmin = path.resolve(__dirname, STORAGE_STATE_PATH_ADMIN);

/**
 * Patterns excluídos dos projects de UI login (chromium/firefox/webkit) para
 * evitar que specs especiais sejam executadas sem o setup correspondente:
 * - `*.authenticated.spec.ts` rodam apenas no project `selecao-authenticated`
 *   (com `storageState`); rodar sem o storage causa redirect ao Keycloak.
 * - `*.ds-matrix.spec.ts` roda apenas nos projects da matriz DS
 *   320/768/desktop x light/dark/contrast.
 * - `*.aaa.spec.ts` roda apenas nos projects AAA aplicável
 *   320/768/desktop x light/dark/contrast x default/legible.
 * - `auth.setup.ts` é o test do setup project — não é um spec funcional.
 *
 * Adicionar novos sufixos especiais à alternation; demais projects herdam
 * automaticamente. Reduz drift quando 3º+ sufixo surgir (ex.: `.smoke`).
 */
const EXCLUDED_FROM_UI_LOGIN_PROJECTS = /(.*\.(authenticated|ds-matrix|aaa)\.spec\.ts|auth\.setup\.ts)$/;

const DS_MATRIX_VIEWPORTS = [
  { name: '320', viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true },
  { name: '768', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false },
] as const;

const DS_MATRIX_THEMES = ['light', 'dark', 'contrast'] as const;
const DS_MATRIX_FONT_MODES = ['default', 'legible'] as const;

const DS_MATRIX_PROJECTS = DS_MATRIX_VIEWPORTS.flatMap((viewport) =>
  DS_MATRIX_THEMES.map((theme) => ({
    name: `ds-${viewport.name}-${theme}`,
    testMatch: /.*\.ds-matrix\.spec\.ts/,
    dependencies: ['auth-setup'],
    metadata: { theme, viewport: viewport.name },
    use: {
      ...devices['Desktop Chrome'],
      viewport: viewport.viewport,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      storageState: storageStateAdmin,
    },
  })),
);

const AAA_PROJECTS = DS_MATRIX_VIEWPORTS.flatMap((viewport) =>
  DS_MATRIX_THEMES.flatMap((theme) =>
    DS_MATRIX_FONT_MODES.map((fontMode) => ({
      name: `aaa-${viewport.name}-${theme}-${fontMode}`,
      testMatch: /.*\.aaa\.spec\.ts/,
      dependencies: ['auth-setup'],
      metadata: { theme, viewport: viewport.name, fontMode },
      use: {
        ...devices['Desktop Chrome'],
        viewport: viewport.viewport,
        isMobile: viewport.isMobile,
        hasTouch: viewport.hasTouch,
        storageState: storageStateAdmin,
      },
    })),
  ),
);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx nx run selecao:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    cwd: workspaceRoot,
  },
  projects: [
    /**
     * Setup project (Playwright ≥1.31) que persiste `storageState` admin via
     * Keycloak. Roda APENAS quando algum project que declara
     * `dependencies: ['auth-setup']` é selecionado — `--project=chromium`
     * sozinho não dispara este setup, preservando o invariante de não exigir
     * `KEYCLOAK_ADMIN_PASSWORD` em runs não-autenticadas. Ver F9 em
     * `~/.claude/plans/novo-plano-fechamento-milestone-b-luminous-keystone.md`.
     */
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts$/,
    },

    {
      name: 'chromium',
      testIgnore: EXCLUDED_FROM_UI_LOGIN_PROJECTS,
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      testIgnore: EXCLUDED_FROM_UI_LOGIN_PROJECTS,
      use: { ...devices['Desktop Firefox'] },
    },

    ...(isCI ? [{
      name: 'webkit',
      testIgnore: EXCLUDED_FROM_UI_LOGIN_PROJECTS,
      use: { ...devices['Desktop Safari'] },
    }] : []),

    {
      name: 'selecao-authenticated',
      testMatch: /.*\.authenticated\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: storageStateAdmin,
      },
    },

    ...DS_MATRIX_PROJECTS,
    ...AAA_PROJECTS,

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
