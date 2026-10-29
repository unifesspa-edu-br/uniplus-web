import { expect, test } from '@playwright/test';
import { falharPermissoesEfetivas, mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { responder } from '../support/responder';

/**
 * Cadastro do certame pelas permissões efetivas (web#1305). O Keycloak é real e a API é mockada:
 * a resposta de `GET /api/autorizacao/permissoes/efetivas` é o que distingue cada pessoa.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
  'access-control-expose-headers': 'Link',
};

test.describe('Seleção — permissões efetivas', () => {
  test.beforeEach(async ({ page }) => {
    await responder(page, /\/api\/selecao\/processos-seletivos(\?.*)?$/, [], CORS);
  });

  test('Leandro, que configura processos, abre o cadastro e vê a ação de criar', async ({
    page,
  }) => {
    await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);

    await page.goto('/processo-seletivo');

    await expect(page.getByRole('heading', { name: 'Processos Seletivos' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Novo Processo' }).first()).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Navegação principal' })
        .getByRole('link', { name: /Processo.* seletivo/i }),
    ).toBeVisible();
  });

  test('Fernanda, sem nenhuma permissão, é levada ao acesso negado sem mensagem de erro', async ({
    page,
  }) => {
    await mockPermissoesEfetivas(page, []);

    await page.goto('/processo-seletivo');

    await expect(page).toHaveURL(/\/acesso-negado$/);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('falha na consulta não deixa o cadastro do certame como permitido', async ({ page }) => {
    await falharPermissoesEfetivas(page);

    await page.goto('/processo-seletivo');

    await expect(page).toHaveURL(/\/acesso-negado$/);
  });
});
