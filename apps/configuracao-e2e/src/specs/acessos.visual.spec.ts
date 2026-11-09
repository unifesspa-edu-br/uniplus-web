import { expect, test, type Locator, type Route, type TestInfo } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { mockApiDeAcesso, pedidoSeed } from '../support/api-de-acesso';
import { PERMISSOES_DO_DIOGO } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
const PERFIL = {
  id: '01960000-0000-7000-0000-0000000000a1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  temVersaoVigente: true,
  temVersaoPendente: false,
};
const CONCESSAO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  beneficiario: { emissor: 'unifesspa', sub: 'sub-betina-0002-ficticia' },
  perfil: { id: PERFIL.id, nome: PERFIL.nome },
  versao: 1,
  escopo: { tipo: 'instituicao', unidadeId: null },
  origem: { tipo: 'pedido', id: '01960000-0000-7000-0000-00000000cc01' },
  concedidaEm: '2026-10-28T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  motivoRevogacao: null,
  ativa: true,
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

test.describe('Acessos — geometria da página e do formulário', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);
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
    await page.route(/\/api\/autorizacao\/perfis(\?.*)?$/, (route) => responder(route, [PERFIL]));
    await page.route(/\/api\/autorizacao\/permissoes(\?.*)?$/, (route) => responder(route, []));
    await page.route(/\/api\/autorizacao\/concessoes(\?.*)?$/, (route) =>
      responder(route, [CONCESSAO]),
    );
    await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) => responder(route, []));
  });

  for (const rota of ['/acessos/perfis', '/acessos/concessoes']) {
    test(`${rota}: sobreposição fechada não ocupa espaço entre os blocos`, async ({ page }) => {
      await page.goto(rota);
      await expect(page.locator('.panel table')).toBeVisible();
      const pagina = page.locator('.cfg-page');
      const cabecalho = page.locator('.page-header');
      const painel = page.locator('.panel');
      const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
      const geoCabecalho = await caixa(cabecalho);
      const geoPainel = await caixa(painel);
      const geoPagina = await caixa(pagina);
      expect(Math.abs(geoPainel.y - geoCabecalho.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
      expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
    });
  }

  test('/acessos/pedidos/:id: sobreposições fechadas não ocupam espaço entre os blocos', async ({
    page,
  }) => {
    const pedido = pedidoSeed();
    await mockApiDeAcesso(page, [pedido]);
    await page.goto(`/acessos/pedidos/${pedido.id}`);
    await expect(page.getByRole('heading', { name: 'Resumo', level: 2 })).toBeVisible();
    await expect(page.getByText('Carregando o pedido…')).toHaveCount(0);
    const pagina = page.locator('.cfg-page');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const geoCabecalho = await caixa(page.locator('.page-header'));
    const geoPrimeiro = await caixa(page.locator('.cfg-page .panel').first());
    const geoUltimo = await caixa(page.locator('.cfg-page .panel').last());
    const geoPagina = await caixa(pagina);
    expect(Math.abs(geoPrimeiro.y - geoCabecalho.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoUltimo.base)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('formulário de perfil tem recuo, rodapé ancorado e não transborda horizontalmente', async ({
    page,
  }) => {
    await page.goto('/acessos/perfis');
    await page.getByRole('button', { name: 'Novo perfil' }).click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de perfil de acesso' });
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
