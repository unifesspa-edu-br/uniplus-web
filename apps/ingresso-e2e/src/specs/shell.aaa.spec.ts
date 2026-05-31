import {
  assertAaaVisualContract,
  assertReflowContract,
  assertTextSpacingResilience,
  runAxeWcagAAAApplicable,
} from '@uniplus/shared-e2e';
import { test, expect, type Page } from '@playwright/test';

type AaaTheme = 'light' | 'dark' | 'contrast';
type AaaFontMode = 'default' | 'legible';

test.describe('Ingresso — gate AAA aplicável @aaa', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await installA11yPreference(page, theme, fontMode);
  });

  test('shell autenticado /dashboard passa AAA aplicável', async ({
    page,
  }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectFontMode(page, fontMode);

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Painel em preparação')).toBeVisible();
    await expect(page.locator('.institutional-bar')).toBeVisible();
    await expect(page.locator('.gov-bar')).toHaveCount(0);

    const results = await runAxeWcagAAAApplicable(page);
    expect(results.violations).toEqual([]);
    await assertAaaVisualContract(page, { fontMode });
    await assertReflowContract(page);
    await assertTextSpacingResilience(page);
  });
});

async function installA11yPreference(
  page: Page,
  theme: AaaTheme,
  fontMode: AaaFontMode,
): Promise<void> {
  await page.addInitScript(({ theme: dsTheme, fontMode: dsFontMode }) => {
    window.localStorage.setItem(
      'uniplus.a11y',
      JSON.stringify({
        theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
        contrast: dsTheme === 'contrast',
        fontMode: dsFontMode,
      }),
    );
  }, { theme, fontMode });
}

async function expectFontMode(page: Page, fontMode: AaaFontMode): Promise<void> {
  if (fontMode === 'legible') {
    await expect(page.locator('html')).toHaveAttribute('data-font-mode', 'legible');
    return;
  }

  await expect(page.locator('html')).not.toHaveAttribute('data-font-mode', 'legible');
}

function settingsFromProjectName(projectName: string): {
  theme: AaaTheme;
  fontMode: AaaFontMode;
} {
  const parts = projectName.split('-');
  return {
    theme: parts[2] === 'dark' || parts[2] === 'contrast' ? parts[2] : 'light',
    fontMode: parts[3] === 'legible' ? 'legible' : 'default',
  };
}
