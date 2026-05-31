import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4202';

// webkit requer libs Ubuntu (libicudata.so.74, libxml2.so.2 etc.) — só executa em CI.
// Localmente em distros não-Debian, defina CI=true para incluir webkit.
const isCI = !!process.env['CI'];

const EXCLUDED_FROM_DEFAULT_PROJECTS = /.*\.aaa\.spec\.ts$/;

const AAA_VIEWPORTS = [
  { name: '320', viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true },
  { name: '768', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false },
] as const;

const AAA_THEMES = ['light', 'dark', 'contrast'] as const;
const AAA_FONT_MODES = ['default', 'legible'] as const;

const AAA_PROJECTS = AAA_VIEWPORTS.flatMap((viewport) =>
  AAA_THEMES.flatMap((theme) =>
    AAA_FONT_MODES.map((fontMode) => ({
      name: `aaa-${viewport.name}-${theme}-${fontMode}`,
      testMatch: /.*\.aaa\.spec\.ts/,
      metadata: { theme, viewport: viewport.name, fontMode },
      use: {
        ...devices['Desktop Chrome'],
        viewport: viewport.viewport,
        isMobile: viewport.isMobile,
        hasTouch: viewport.hasTouch,
      },
    })),
  ),
);

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx nx run portal:serve',
    url: 'http://localhost:4202',
    reuseExistingServer: true,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: EXCLUDED_FROM_DEFAULT_PROJECTS,
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      testIgnore: EXCLUDED_FROM_DEFAULT_PROJECTS,
      use: { ...devices['Desktop Firefox'] },
    },

    ...(isCI ? [{
      name: 'webkit',
      testIgnore: EXCLUDED_FROM_DEFAULT_PROJECTS,
      use: { ...devices['Desktop Safari'] },
    }] : []),

    ...AAA_PROJECTS,
  ],
});
