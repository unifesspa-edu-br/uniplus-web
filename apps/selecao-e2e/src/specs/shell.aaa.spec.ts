import {
  assertAaaVisualContract,
  assertReflowContract,
  assertTextSpacingResilience,
  runAxeWcagAAAApplicable,
} from '@uniplus/shared-e2e';
import { test, expect, type Page } from '@playwright/test';

type AaaTheme = 'light' | 'dark' | 'contrast';
type AaaFontMode = 'default' | 'legible';

const EDITAIS = [
  {
    id: '01960000-0000-7000-0000-000000000377',
    numeroEdital: '037/2026',
    anoEdital: 2026,
    titulo: 'Processo seletivo de teste DS AAA',
    tipoProcesso: 'PSE',
    status: 'Rascunho',
    maximoOpcoesCurso: 2,
    bonusRegionalHabilitado: false,
    criadoEm: '2026-05-30T00:00:00Z',
    _links: {
      self: { href: '/api/editais/01960000-0000-7000-0000-000000000377' },
      collection: { href: '/api/editais' },
    },
  },
] as const;

test.describe('Seleção — gate AAA aplicável @aaa', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await installA11yPreference(page, theme, fontMode);

    await page.route(/\/api\/editais(\?.*)?$/, async (route, request) => {
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(EDITAIS),
      });
    });
  });

  test('shell autenticado e piloto /editais passam AAA aplicável', async ({
    page,
  }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);

    await page.goto('/editais');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectFontMode(page, fontMode);

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Identificação institucional' }),
    ).toBeVisible();
    await expect(page.locator('.institutional-bar')).toBeVisible();
    await expect(page.locator('.gov-bar')).toHaveCount(0);

    await expect(
      page.getByRole('heading', { name: 'Editais', level: 1 }),
    ).toBeVisible();
    await expect(page.locator('table[role="grid"]')).toBeVisible();
    await expect(page.getByText('Processo seletivo de teste DS AAA')).toBeVisible();

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
