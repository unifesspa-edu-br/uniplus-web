import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  PERFIL_SENSIVEL_ID,
  UNIDADE_ID,
  mockApiDeAcesso,
  pedidoSeed,
} from '../support/api-de-acesso';
import {
  PERMISSOES_DA_BETINA_PROTECAO_DE_DADOS,
  PERMISSOES_DO_DIOGO,
  PERMISSOES_DO_LEANDRO,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Administração de acesso (web#1306): pedido com dupla aprovação, filas, concessões e revogação.
 * Convenção do repo: runtime-config e API mockados por `page.route`; autenticação real
 * (Keycloak) via projeto `fluxo-chromium`. A pessoa de cada passo é a que as permissões
 * efetivas mockadas descrevem.
 */

const PEDIDO_ID = '01960000-0000-7000-0000-00000000cc01';

test.describe('Configuração — administração de acesso @flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('Fernanda, sem nenhuma concessão, pede acesso pelo acesso negado e cancela o pedido', async ({
    page,
  }) => {
    const estado = await mockApiDeAcesso(page);
    await mockPermissoesEfetivas(page, []);

    await page.goto('/');
    await expect(page).toHaveURL(/\/acesso-negado$/);
    await page.getByRole('link', { name: 'Pedir acesso' }).click();
    await expect(page).toHaveURL(/\/acessos\/pedidos\/novo$/);

    await page.getByLabel('Perfil de acesso').selectOption(PERFIL_SENSIVEL_ID);
    await page.getByLabel('Unidade').selectOption(UNIDADE_ID);
    await page.getByLabel('Justificativa').fill('Analiso os documentos do processo seletivo.');
    await page.getByRole('button', { name: 'Enviar pedido' }).click();

    await expect(page).toHaveURL(/\/acessos\/pedidos\/[0-9a-f-]+$/);
    expect(estado.criacoes).toEqual([
      {
        beneficiarioEmail: null,
        perfilId: PERFIL_SENSIVEL_ID,
        unidadeId: UNIDADE_ID,
        justificativa: 'Analiso os documentos do processo seletivo.',
      },
    ]);
    await expect(page.getByText('Aguardando o gestor de acessos').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Cancelar o pedido' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar pedido' }).click();
    await expect(page).toHaveURL(/\/acessos\/pedidos$/);
    await expect(page.getByRole('table').getByText('Cancelado')).toBeVisible();
  });

  test('o pedido de perfil com dado sensível passa pelo gestor e pela proteção de dados, gera a concessão e ela é revogada', async ({
    page,
  }) => {
    const estado = await mockApiDeAcesso(page, [pedidoSeed()]);

    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);
    await page.goto('/acessos/fila-do-gestor');
    await expect(
      page.getByRole('heading', { name: 'Fila do gestor de acessos', level: 1 }),
    ).toBeVisible();
    await page.getByRole('link', { name: /Visualizar o pedido de Analista de documentos/ }).click();
    await expect(page).toHaveURL(new RegExp(`/acessos/pedidos/${PEDIDO_ID}(\\?.*)?$`));
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByText('Aguardando a proteção de dados').first()).toBeVisible();

    await mockPermissoesEfetivas(page, PERMISSOES_DA_BETINA_PROTECAO_DE_DADOS);
    await page.goto('/acessos/fila-da-protecao-de-dados');
    await page.getByRole('link', { name: /Visualizar o pedido de Analista de documentos/ }).click();
    await page.getByRole('button', { name: 'Aprovar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByText('Aprovado').first()).toBeVisible();
    expect(estado.concessoes).toHaveLength(1);

    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);
    await page.goto('/acessos/concessoes');
    const linha = page.getByRole('row', { name: /Analista de documentos/ });
    await expect(linha.getByText('Ativa')).toBeVisible();
    await expect(linha.getByText('CEPS')).toBeVisible();

    await page
      .getByRole('button', { name: 'Revogar a concessão de Analista de documentos' })
      .click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByRole('button', { name: 'Revogar concessão' })).toBeDisabled();
    await dialogo.getByLabel('E-mail do beneficiário').fill('betina.teste@unifesspa.edu.br');
    await dialogo.getByLabel('Motivo').fill('Deixou a função na unidade.');
    await page.getByRole('dialog').getByRole('button', { name: 'Revogar concessão' }).click();

    await expect(page.getByText('Nenhuma concessão corresponde a este filtro.')).toBeVisible();
    expect(estado.revogacoes).toEqual([
      { motivo: 'Deixou a função na unidade.', confirmacaoEmail: 'betina.teste@unifesspa.edu.br' },
    ]);
  });

  test('o gestor recusa o pedido com motivo e a recusa fica registrada', async ({ page }) => {
    const estado = await mockApiDeAcesso(page, [pedidoSeed()]);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);

    await page.goto(`/acessos/pedidos/${PEDIDO_ID}`);
    await page.getByRole('button', { name: 'Recusar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Recusar pedido' }).click();
    await expect(page.getByText('Informe o motivo, em até 500 caracteres.')).toBeVisible();

    await page.getByRole('dialog').getByLabel('Motivo').fill('Não há necessidade funcional.');
    await page.getByRole('dialog').getByRole('button', { name: 'Recusar pedido' }).click();

    await expect(page.getByText('Recusado').first()).toBeVisible();
    expect(estado.recusas).toEqual([{ motivo: 'Não há necessidade funcional.' }]);

    await page.getByRole('link', { name: 'Histórico de pedidos' }).click();
    await expect(page).toHaveURL(/\/acessos\/historico$/);
    await page.getByLabel('Situação').selectOption('recusado');
    await page.getByRole('link', { name: /Visualizar o pedido de Analista de documentos/ }).click();
    await expect(page).toHaveURL(new RegExp(`/acessos/pedidos/${PEDIDO_ID}(\\?.*)?$`));
    await page.getByRole('link', { name: 'Voltar ao histórico de pedidos' }).click();
    await expect(page).toHaveURL(/\/acessos\/historico$/);
  });

  test('Leandro não vê filas, concessões nem perfis, e é levado ao acesso negado ao abri-las', async ({
    page,
  }) => {
    await mockApiDeAcesso(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);

    await page.goto('/campi');
    const menu = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(menu.getByRole('link', { name: 'Meus pedidos' })).toBeVisible();
    for (const nome of [
      'Fila do gestor',
      'Fila da proteção de dados',
      'Histórico de pedidos',
      'Concessões',
      'Perfis de acesso',
    ]) {
      await expect(menu.getByRole('link', { name: nome })).toHaveCount(0);
    }

    await page.goto('/acessos/concessoes');
    await expect(page).toHaveURL(/\/acesso-negado$/);
  });

  test('as telas de acesso não têm violação de acessibilidade', async ({ page }) => {
    await mockApiDeAcesso(page, [pedidoSeed()]);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);

    for (const rota of [
      '/acessos/pedidos',
      '/acessos/pedidos/novo',
      `/acessos/pedidos/${PEDIDO_ID}`,
      '/acessos/fila-do-gestor',
      '/acessos/historico',
      '/acessos/concessoes',
      '/acessos/perfis',
    ]) {
      await page.goto(rota);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const { violations } = await runAxeWcagAA(page);
      expect(violations, `${rota}: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
    }
  });
});
