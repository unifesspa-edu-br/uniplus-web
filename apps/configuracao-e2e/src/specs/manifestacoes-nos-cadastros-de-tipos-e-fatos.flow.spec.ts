import { expect, test, type Page, type Route } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { MANIFESTACAO_DESFAVORAVEL } from '../support/api-da-manifestacao';
import { mockApi } from '../support/listas-de-tipos-e-fatos';
import { PERMISSOES_DO_LEANDRO_ADMINISTRA_TIPOS_E_FATOS } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const ADMIN = '/api/configuracao/admin';
const MANIFESTACAO_SUBSTITUIDA = {
  ...MANIFESTACAO_DESFAVORAVEL,
  id: '01960000-0000-7000-0000-0000000000f0',
  parecer: 'RECOMENDA_AJUSTE',
  texto: 'Recomendo a classificação pessoal.',
  instante: '2026-11-01T10:00:00Z',
  situacao: 'SUBSTITUIDA',
};

/** Responde o histórico das manifestações na rota do cadastro e guarda o media type pedido. */
async function mockHistorico(
  page: Page,
  rota: 'tipos-documento' | 'fatos-candidato',
  respostas: readonly { status: number; corpo: unknown }[],
): Promise<string[]> {
  const pedidos: string[] = [];
  await page.route(
    new RegExp(`${ADMIN}/${rota}/[^/?]+/protecao/manifestacoes$`),
    async (route: Route) => {
      pedidos.push(route.request().headers()['accept'] ?? '');
      const { status, corpo } = respostas[Math.min(pedidos.length, respostas.length) - 1];
      await route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(corpo),
      });
    },
  );
  return pedidos;
}

/**
 * Prepara a página com a API simulada das listas e a persona que administra os cadastros. O
 * histórico de cada teste é registrado depois, para valer sobre o vazio da API das listas.
 */
async function preparar(page: Page): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  await mockApi(page, 'PENDENTE');
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO_ADMINISTRA_TIPOS_E_FATOS);
}

/** Abre o detalhe do item e devolve a seção do histórico das manifestações. */
async function abrir(page: Page, rota: string, nome: string) {
  await page.goto(rota);
  await page.getByRole('button', { name: `Ver o detalhe de ${nome}`, exact: true }).click();
  return page.getByRole('region', { name: 'Histórico das manifestações' });
}

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('Manifestações técnicas nas telas de tipos de documento e de fatos do candidato', () => {
  test('quem administra os tipos de documento lê o histórico das manifestações, sem nenhuma ação', async ({
    page,
  }) => {
    await preparar(page);
    const pedidos = await mockHistorico(page, 'tipos-documento', [
      { status: 200, corpo: [MANIFESTACAO_SUBSTITUIDA, MANIFESTACAO_DESFAVORAVEL] },
    ]);
    const secao = await abrir(page, '/tipos-documento', 'Laudo médico complementar');

    const lista = secao.getByRole('list', { name: 'Histórico das manifestações técnicas' });
    await expect(lista).toContainText('Inadequada');
    await expect(lista).toContainText('Isabella Priscila Figueiredo');
    await expect(lista).toContainText('a classificação deve ser sensível');
    await expect(lista).toContainText('Vigente');
    await expect(lista).toContainText('Substituída');
    await expect(secao.getByRole('button')).toHaveCount(0);
    await expect(secao.getByRole('textbox')).toHaveCount(0);
    expect(pedidos[0]).toBe('application/vnd.uniplus.protecao-do-catalogo-manifestacao.v1+json');
    await semViolacoes(page);
  });

  test('no fato do candidato, o registro de acesso fora do ar (503) mostra a falha sem dado e tenta de novo', async ({
    page,
  }) => {
    await preparar(page);
    const pedidos = await mockHistorico(page, 'fatos-candidato', [
      {
        status: 503,
        corpo: {
          status: 503,
          code: 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar',
          title: 'Registro de acesso indisponível',
          type: 'about:blank',
          traceId: 't',
        },
      },
      { status: 200, corpo: [MANIFESTACAO_DESFAVORAVEL] },
    ]);
    const secao = await abrir(page, '/fatos-candidato', 'Renda familiar bruta');

    await expect(secao.getByText('Não foi possível carregar as manifestações')).toBeVisible();
    await expect(secao.getByText('Isabella Priscila Figueiredo')).toHaveCount(0);
    await secao.getByRole('button', { name: /Tentar novamente/ }).click();
    await expect(secao.getByText('Isabella Priscila Figueiredo')).toBeVisible();
    expect(pedidos).toHaveLength(2);
  });

  test('no tipo de documento, a recusa 404 não oferece nova tentativa', async ({ page }) => {
    await preparar(page);
    await mockHistorico(page, 'tipos-documento', [
      {
        status: 404,
        corpo: {
          status: 404,
          code: 'uniplus.configuracao.tipo_documento.nao_encontrado',
          title: 'Tipo de documento não encontrado',
          type: 'about:blank',
          traceId: 't',
        },
      },
    ]);
    const secao = await abrir(page, '/tipos-documento', 'Laudo médico complementar');

    await expect(secao.getByText('Item não encontrado')).toBeVisible();
    await expect(secao.getByRole('button', { name: /Tentar novamente/ })).toHaveCount(0);
  });
});
