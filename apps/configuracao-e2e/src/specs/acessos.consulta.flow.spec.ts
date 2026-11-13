import { expect, test, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { mockApiDeAcesso, pedidoSeed } from '../support/api-de-acesso';
import { PERFIL, mockPerfis } from '../support/api-de-perfis-escritas';
import { concessaoDoPedido } from '../support/api-de-acesso/modelo';
import { PERMISSOES_DA_ISABELLA_SO_CONSULTA } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Encarregado de dados que só consulta (UNI-REQ-0372, UNI-REQ-0363, UNI-REQ-0322): abre o histórico
 * de pedidos, as concessões e os perfis, sem filas de decisão e sem ações de escrita.
 */

const CONCESSAO_ID = '01960000-0000-7000-0000-00000000dd01';

async function abrirComoIsabella(page: Page, rota: string): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  await mockPermissoesEfetivas(page, PERMISSOES_DA_ISABELLA_SO_CONSULTA);
  const pedido = pedidoSeed();
  const estado = await mockApiDeAcesso(page, [pedido]);
  estado.concessoes.push(concessaoDoPedido(pedido, CONCESSAO_ID));
  await page.goto(rota);
}

const menu = (page: Page) => page.getByRole('navigation', { name: 'Navegação principal' });

test.describe('Acessos — Encarregado de dados só consulta @flow', () => {
  test('o menu oferece as telas de leitura e nenhuma fila de decisão', async ({ page }) => {
    await abrirComoIsabella(page, '/acessos/pedidos');

    for (const tela of ['Histórico de pedidos', 'Concessões', 'Perfis de acesso']) {
      await expect(menu(page).getByRole('link', { name: tela })).toBeVisible();
    }
    for (const fila of [/^Fila/u, /^Versões na/u, /^Janelas na/u, /^Reclassificações na/u]) {
      await expect(menu(page).getByRole('link', { name: fila })).toHaveCount(0);
    }
  });

  test('abre o histórico e o detalhe do pedido sem as ações de decisão', async ({ page }) => {
    await abrirComoIsabella(page, '/acessos/historico');

    await expect(page.getByRole('heading', { name: 'Histórico de pedidos' })).toBeVisible();
    await page
      .getByRole('link', { name: /Visualizar/u })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Pedido de acesso', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Aprovar|Recusar)/u })).toHaveCount(0);
  });

  test('lista as concessões com a trilha e sem a revogação', async ({ page }) => {
    await abrirComoIsabella(page, '/acessos/concessoes');

    await expect(page.locator(`tr[data-concessao-id="${CONCESSAO_ID}"]`)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ver a trilha da concessão/u })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Revogar a concessão/u })).toHaveCount(0);
  });

  test('abre os perfis sem a criação', async ({ page }) => {
    await abrirComoIsabella(page, '/acessos/perfis');

    await expect(page.getByRole('heading', { name: 'Perfis de acesso', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo perfil' })).toHaveCount(0);
  });

  for (const fila of [
    '/acessos/fila-do-gestor',
    '/acessos/fila-da-protecao-de-dados',
    '/acessos/versoes-de-perfil/gestao-de-acessos',
    '/acessos/janelas-de-migracao/protecao-de-dados',
    '/acessos/reclassificacoes/gestao-de-acessos',
  ]) {
    test(`a fila de decisão ${fila} leva ao acesso negado`, async ({ page }) => {
      await abrirComoIsabella(page, fila);

      await expect(page).toHaveURL(/\/acesso-negado/u);
    });
  }
});

/** Ações de manutenção, decisão e contenção do perfil, que quem só consulta não vê. */
const ACOES_DO_PERFIL =
  /^(Desativar|Reativar|Suspender|Retomar|Propor nova versão|Remover|Aprovar|Recusar)/u;
const VERSAO_EM_VIGOR = '01960000-0000-7000-0000-0000000000b1';

test.describe('Acessos — Encarregado de dados só consulta o perfil @flow', () => {
  for (const [nome, rota] of [
    ['o detalhe do perfil', `/acessos/perfis/${PERFIL.id}`],
    ['a versão do perfil', `/acessos/perfis/${PERFIL.id}/versoes/${VERSAO_EM_VIGOR}`],
  ] as const) {
    test(`abre ${nome} com a trilha e sem ações de manutenção, decisão e contenção`, async ({
      page,
    }) => {
      await mockConfiguracaoRuntimeConfig(page);
      await mockPermissoesEfetivas(page, PERMISSOES_DA_ISABELLA_SO_CONSULTA);
      await mockPerfis(page, []);
      await page.goto(rota);

      await expect(page.getByRole('heading', { name: PERFIL.nome, level: 1 })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Trilha da contenção', level: 2 }),
      ).toBeVisible();
      await expect(page.getByText('Não foi possível carregar a trilha')).toHaveCount(0);
      await expect(page.getByRole('button', { name: ACOES_DO_PERFIL })).toHaveCount(0);
    });
  }
});
