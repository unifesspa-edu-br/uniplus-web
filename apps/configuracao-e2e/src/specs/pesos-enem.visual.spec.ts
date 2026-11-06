import { expect, test, type Locator, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
const AREAS = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
];
const GRUPOS = [{ codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' }];
const LINHA = {
  id: '01960000-0000-7000-0000-0000000000a1',
  resolucao: 'Res. 805/2024',
  grupoCurso: GRUPOS[0],
  areas: AREAS.map((area) => ({ ...area, peso: 1, corte: null })),
  baseLegal: 'Res. 805/2024 Anexo I',
  criadoEm: '2026-06-24T12:00:00Z',
};
const TOLERANCIA = 1;

async function caixa(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Elemento sem geometria visível.');
  return { y: box.y, base: box.y + box.height };
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}

test.describe('Peso por Área — geometria da página', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((theme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: theme === 'contrast' ? 'auto' : theme,
          contrast: theme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, metadataTheme(testInfo));
    const json = (corpo: unknown) => (route: Route) =>
      route.fulfill({ status: 200, headers: CORS_HEADERS, json: corpo });
    await page.route(/\/api\/configuracao\/pesos-area-enem\/areas$/, json(AREAS));
    await page.route(/\/api\/configuracao\/vocabularios\/grupos-area-enem$/, json(GRUPOS));
    await page.route(/\/api\/configuracao\/pesos-area-enem(\?.*)?$/, json([LINHA]));
  });

  test('drawer e diálogo fechados não ocupam espaço entre os blocos', async ({ page }) => {
    await page.goto('/pesos-por-area');
    const painel = page.locator('section.panel').first();
    await expect(painel).toBeVisible();
    const pagina = page.locator('.cfg-page');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const geoPainel = await caixa(painel);
    const geoPagina = await caixa(pagina);
    const aviso = await caixa(page.locator('ui-alert').first());
    expect(Math.abs(geoPainel.y - aviso.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });
});
