import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { test, expect } from '@playwright/test';

type DsTheme = 'light' | 'dark' | 'contrast';

const EDITAIS = [
  {
    id: '01960000-0000-7000-0000-000000000377',
    numeroEdital: '037/2026',
    anoEdital: 2026,
    titulo: 'Processo seletivo de teste DS',
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

test.describe('Shell Uni+ DS — matriz responsiva e tema', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const theme = themeFromProjectName(testInfo.project.name);
    await page.addInitScript((dsTheme: DsTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, theme);

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

  test('shell e piloto /editais respeitam institucional-bar, tema e WCAG A/AA', async ({
    page,
  }, testInfo) => {
    const theme = themeFromProjectName(testInfo.project.name);

    await page.goto('/editais');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
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
    await expect(page.getByText('Processo seletivo de teste DS')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Mapa do site' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Acessibilidade' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Privacidade' })).toHaveCount(0);

    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);

    const results = await runAxeWcagAA(page);
    expect(results.violations).toEqual([]);
  });
});

function themeFromProjectName(projectName: string): DsTheme {
  if (projectName.endsWith('-contrast')) return 'contrast';
  if (projectName.endsWith('-dark')) return 'dark';
  return 'light';
}
