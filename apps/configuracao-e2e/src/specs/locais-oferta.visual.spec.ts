import { expect, test, type Locator, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

/**
 * Página de Locais de oferta com os drawers fechados: o formulário e a confirmação de remoção não podem
 * ocupar espaço nem consumir o espaçamento entre os blocos da página.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const LOCAL = {
  id: '01960000-0000-7000-0000-0000000000d1',
  tipo: 'poloEad',
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const TOLERANCIA = 1; // arredondamento de subpixel do layout.

test.describe('Locais de oferta — página com os drawers fechados', () => {
  test('os drawers fechados não ocupam espaço nem consomem o espaçamento entre os blocos', async ({
    page,
  }, testInfo) => {
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((dsTheme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, metadataTheme(testInfo));
    await page.route(/\/api\/configuracao\/locais-oferta(\?.*)?$/, async (route: Route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify([LOCAL]),
      });
    });
    await page.goto('/locais-oferta');
    await expect(page.locator('.panel table')).toBeVisible();

    const pagina = page.locator('.cfg-page');
    const geoPagina = await caixa(pagina);
    const geoCabecalho = await caixa(page.locator('.page-header'));
    const geoPainel = await caixa(page.locator('.panel'));
    const espacamento = await pagina.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).rowGap),
    );

    expect(Math.abs(geoPainel.y - geoCabecalho.base - espacamento)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });
});

async function caixa(locator: Locator): Promise<{ y: number; base: number }> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Elemento sem bounding box visível — não é possível medir a geometria.');
  }
  return { y: box.y, base: box.y + box.height };
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
