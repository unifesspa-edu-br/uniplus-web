import { expect, test, type Locator, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
const MODELO = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'INSCRICAO',
  nome: 'Inscrição',
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo: {
    titulo: 'Inscrição',
    etapas: [],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
    documentosExigidos: [],
  },
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

test.describe('Modelos de formulário — geometria da página e do formulário', () => {
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
    await page.route(/\/api\/configuracao\/admin\/modelos-formulario(\?.*)?$/, (route) =>
      responder(route, [MODELO]),
    );
    await page.route(/\/api\/configuracao\/tipos-processo(\?.*)?$/, (route) =>
      responder(route, []),
    );
  });

  test('drawer fechado não ocupa espaço entre os blocos', async ({ page }) => {
    await page.goto('/modelos-formulario');
    await expect(page.locator('.panel table')).toBeVisible();
    const pagina = page.locator('cfg-modelos-formulario-page');
    const cabecalho = page.locator('.page-header');
    const lista = page.locator('cfg-modelos-formulario-lista');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const geoCabecalho = await caixa(cabecalho);
    const geoLista = await caixa(lista);
    const geoPagina = await caixa(pagina);
    expect(Math.abs(geoLista.y - geoCabecalho.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoLista.base)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('a distância entre os filtros e o painel da lista é a do espaçamento da página', async ({
    page,
  }) => {
    await page.goto('/modelos-formulario');
    await expect(page.locator('.panel table')).toBeVisible();
    const lista = page.locator('cfg-modelos-formulario-lista');
    const gap = await lista.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const filtros = await caixa(lista.locator('.filter-bar'));
    const painel = await caixa(lista.locator('.panel'));
    expect(gap).toBeGreaterThan(0);
    expect(Math.abs(painel.y - filtros.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('formulário tem recuo, rodapé ancorado e não transborda horizontalmente', async ({
    page,
  }) => {
    await page.goto('/modelos-formulario');
    await page.getByRole('button', { name: 'Novo modelo' }).first().click();
    const drawer = page.getByRole('dialog', { name: 'Novo modelo de formulário' });
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
