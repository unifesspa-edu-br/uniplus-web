import { expect, test, type Locator, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
const RECURSO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: 'Leitura de provas por ledor',
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

test.describe('Recursos de acessibilidade — geometria da página e do formulário', () => {
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
    await page.route(
      /\/api\/configuracao\/recursos-acessibilidade(\?.*)?$/,
      async (route: Route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: CORS_HEADERS });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify([RECURSO]),
        });
      },
    );
  });

  test('os drawers fechados não ocupam espaço nem consomem o espaçamento entre os blocos', async ({
    page,
  }) => {
    await page.goto('/recursos-acessibilidade');
    await expect(page.locator('.panel table')).toBeVisible();
    const pagina = page.locator('.cfg-page');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const geoCabecalho = await caixa(page.locator('.page-header'));
    const geoPainel = await caixa(page.locator('.panel'));
    const geoPagina = await caixa(pagina);
    expect(Math.abs(geoPainel.y - geoCabecalho.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('formulário tem recuo, rodapé ancorado e não transborda horizontalmente', async ({
    page,
  }) => {
    await page.goto('/recursos-acessibilidade');
    await page
      .getByRole('button', { name: `Editar recurso de acessibilidade ${RECURSO.codigo}` })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Formulário do recurso de acessibilidade' });
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
