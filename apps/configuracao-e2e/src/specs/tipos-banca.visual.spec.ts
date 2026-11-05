import { expect, test, type Locator, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
const BANCA = {
  id: '01960000-0000-7000-0000-0000000000b2',
  codigo: 'BANCA_ENTREVISTA',
  nome: 'Banca de Entrevista',
  faseTipica: 'Avaliação',
  descricao: null,
  criadoEm: '2026-06-10T12:00:00Z',
};
const TOLERANCIA = 1;

async function caixa(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Elemento sem geometria visível.');
  return {
    x: box.x,
    y: box.y,
    direita: box.x + box.width,
    base: box.y + box.height,
    largura: box.width,
  };
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}

test.describe('Tipos de banca — geometria da página e do formulário', () => {
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
    const responder = async (route: Route, body: unknown) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(body),
      });
    };
    await page.route(/\/api\/configuracao\/tipos-banca(\?.*)?$/, (route) =>
      responder(route, [BANCA]),
    );
    await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (route) =>
      responder(route, []),
    );
  });

  test('drawer fechado não ocupa espaço entre os blocos', async ({ page }) => {
    await page.goto('/tipos-banca');
    await expect(page.locator('.panel table')).toBeVisible();
    const pagina = page.locator('.cfg-page');
    const aviso = page.locator('ui-alert').first();
    const painel = page.locator('.panel');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const geoAviso = await caixa(aviso);
    const geoPainel = await caixa(painel);
    const geoPagina = await caixa(pagina);
    expect(Math.abs(geoPainel.y - geoAviso.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('formulário tem recuo, rodapé ancorado e não transborda horizontalmente', async ({
    page,
  }) => {
    await page.goto('/tipos-banca');
    await page.getByRole('button', { name: `Editar tipo de banca ${BANCA.codigo}` }).click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de tipo de banca' });
    await expect(drawer).toBeVisible();
    await drawer.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((animacao) => animacao.finished)),
    );
    const painel = await caixa(drawer.locator('.uni-drawer__panel'));
    const campos = await caixa(drawer.locator('.form-drawer__campos'));
    const rodape = await caixa(drawer.locator('.form-drawer__footer'));
    expect(Math.abs(campos.x - painel.x - 20)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(painel.direita - campos.direita - 20)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(rodape.largura - painel.largura)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(rodape.base - painel.base)).toBeLessThanOrEqual(TOLERANCIA);
    const dimensoes = await drawer.evaluate((el) => ({
      largura: el.scrollWidth,
      visivel: el.clientWidth,
    }));
    expect(dimensoes.largura).toBeLessThanOrEqual(dimensoes.visivel + TOLERANCIA);
  });
});
