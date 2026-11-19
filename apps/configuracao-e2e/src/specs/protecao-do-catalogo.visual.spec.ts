import { expect, test, type Locator, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { mockManifestacoesDaFila } from '../support/listas-de-tipos-e-fatos';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
const ITEM = {
  tipo: 'TIPO_DOCUMENTO',
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO_COMPLEMENTAR',
  nome: 'Laudo médico complementar',
  classificacaoProtecao: 'INTERNO',
  finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  aprovacao: {
    situacao: 'SOLICITADA',
    solicitadaEm: '2026-11-01T12:00:00Z',
    decididaEm: null,
    classificacaoRecomendada: null,
    justificativa: null,
    aceitaEm: null,
    ciclo: 1,
    manifestadaEm: null,
    manifestacaoDesfavoravel: false,
    manifestacoesNoCiclo: 0,
  },
};
const DETALHE = {
  ...ITEM,
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg', tamanhoMaximoMb: 10 },
  atos: [],
  manifestacoesVigentes: [],
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

test.describe('Proteção de dados do catálogo — geometria da página e do detalhe', () => {
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
    await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (route) =>
      responder(route, []),
    );
    await mockManifestacoesDaFila(page);
    await page.route(
      /\/api\/configuracao\/admin\/protecao-do-catalogo\/tipos-documento\/[^/?]+$/,
      (route) => responder(route, DETALHE),
    );
    await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (route) =>
      responder(route, [ITEM]),
    );
  });

  test('drawer e diálogo fechados não ocupam espaço entre os blocos', async ({ page }) => {
    await page.goto('/protecao-do-catalogo');
    await expect(page.locator('.panel table')).toBeVisible();
    const pagina = page.locator('.cfg-page');
    const abas = page.locator('.cfg-abas');
    const painel = page.locator('.panel');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const margem = await abas.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).marginBottom),
    );
    const geoAbas = await caixa(abas);
    const geoPainel = await caixa(painel);
    const geoPagina = await caixa(pagina);
    expect(Math.abs(geoPainel.y - geoAbas.base - margem - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('detalhe tem rodapé ancorado e não transborda horizontalmente', async ({ page }) => {
    await page.goto('/protecao-do-catalogo');
    await page.getByRole('button', { name: `Ver o detalhe de ${ITEM.nome}` }).click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
    await expect(drawer.getByText('Proposta de proteção')).toBeVisible();
    await drawer.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((animacao) => animacao.finished)),
    );
    const painel = await caixa(drawer.locator('.uni-drawer__panel'));
    const rodape = await caixa(drawer.locator('.form-drawer__footer'));
    expect(Math.abs(rodape.largura - painel.largura)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(rodape.base - painel.base)).toBeLessThanOrEqual(TOLERANCIA);
    const dimensoes = await drawer.evaluate((el) => ({
      largura: el.scrollWidth,
      visivel: el.clientWidth,
    }));
    expect(dimensoes.largura).toBeLessThanOrEqual(dimensoes.visivel + TOLERANCIA);
  });
});
