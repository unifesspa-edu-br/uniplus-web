import { expect, test, type Locator, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
const FATO = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'TRABALHA',
  nome: 'Trabalha',
  descricao: 'Se o candidato trabalha.',
  componenteExibicao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  fonteValores: null,
  formato: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:TRABALHA',
  escopo: 'CANDIDATO',
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Classificar a reserva de vagas.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  sistema: false,
  ativo: true,
  valores: [],
  regrasPadrao: [],
  aprovacao: {
    situacao: 'APROVADA',
    solicitadaEm: null,
    decididaEm: null,
    classificacaoRecomendada: null,
    justificativa: null,
    aceitaEm: null,
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

const json = (corpo: unknown) => (route: Route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(corpo),
  });

test.describe('Fatos do candidato — geometria da página e do formulário', () => {
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
    await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, json([]));
    await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, json([]));
    await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, json([]));
    await page.route(/\/api\/configuracao\/admin\/fatos-candidato(\?.*)?$/, json([FATO]));
    await page.route(/\/api\/configuracao\/admin\/fatos-candidato\/[^/?]+$/, json(FATO));
  });

  test('drawer e diálogos fechados não ocupam espaço entre os blocos', async ({ page }) => {
    await page.goto('/fatos-candidato');
    await expect(page.locator('.panel table')).toBeVisible();
    const pagina = page.locator('.cfg-page');
    const painel = page.locator('.panel');
    const geoPainel = await caixa(painel);
    const geoPagina = await caixa(pagina);
    expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('formulário de edição tem recuo, rodapé ancorado e não transborda horizontalmente', async ({
    page,
  }) => {
    await page.goto('/fatos-candidato');
    await page.getByRole('button', { name: `Editar o fato ${FATO.codigo}` }).click();
    const drawer = page.getByRole('dialog', { name: 'Fato do candidato' });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('#cfg-fato-descritivo')).toBeVisible();
    await drawer.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((animacao) => animacao.finished)),
    );
    const painel = await caixa(drawer.locator('.uni-drawer__panel'));
    const campos = await caixa(drawer.locator('.form-drawer__campos').first());
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

  test('formulário de criação não transborda horizontalmente', async ({ page }) => {
    await page.goto('/fatos-candidato');
    await page.locator('#cfg-fatos-novo').click();
    const drawer = page.getByRole('dialog', { name: 'Fato do candidato' });
    await expect(drawer.locator('#cfg-fato-criacao')).toBeVisible();
    await drawer.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((animacao) => animacao.finished)),
    );
    const painel = await caixa(drawer.locator('.uni-drawer__panel'));
    const rodape = await caixa(drawer.locator('.form-drawer__footer'));
    expect(Math.abs(rodape.base - painel.base)).toBeLessThanOrEqual(TOLERANCIA);
    const dimensoes = await drawer.evaluate((el) => ({
      largura: el.scrollWidth,
      visivel: el.clientWidth,
    }));
    expect(dimensoes.largura).toBeLessThanOrEqual(dimensoes.visivel + TOLERANCIA);
  });
});
