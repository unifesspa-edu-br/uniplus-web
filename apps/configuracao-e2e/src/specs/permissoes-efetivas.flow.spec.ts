import { expect, test, type Page } from '@playwright/test';
import { falharPermissoesEfetivas, mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DA_BETINA, PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Menu, rotas e ações pelas permissões efetivas (web#1305). Convenção do repo: runtime-config e
 * API mockados por `page.route`; autenticação real (Keycloak) via projeto `fluxo-chromium`. A
 * resposta de `GET /api/autorizacao/permissoes/efetivas` é o que distingue cada pessoa.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
  'access-control-expose-headers': 'link',
};

async function mockListas(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/tipos-processo(\?.*)?$/, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS_HEADERS })
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: '[]',
        }),
  );
}

function menu(page: Page) {
  return page.getByRole('navigation', { name: 'Navegação principal' });
}

test.describe('Configuração — permissões efetivas @flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockListas(page);
  });

  test('Leandro vê no menu só o que mantém e as ações aparecem habilitadas', async ({ page }) => {
    await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);

    await page.goto('/tipos-processo');

    await expect(menu(page).getByRole('link', { name: 'Campus' })).toBeVisible();
    await expect(menu(page).getByRole('link', { name: 'Unidade' })).toBeVisible();
    await expect(menu(page).getByRole('link', { name: 'Tipo de Processo' })).toBeVisible();
    await expect(menu(page).getByRole('link', { name: 'Curso', exact: true })).toHaveCount(0);
    const novo = page.getByRole('button', { name: 'Novo tipo de processo' }).first();
    await expect(novo).toBeVisible();
    await expect(novo).toBeEnabled();
  });

  test('Betina consulta tipos de processo, mas não vê as ações de manter nem as outras telas', async ({
    page,
  }) => {
    await mockPermissoesEfetivas(page, PERMISSOES_DA_BETINA);

    await page.goto('/tipos-processo');

    await expect(page.getByRole('heading', { name: 'Tipos de processo', level: 2 })).toBeVisible();
    await expect(menu(page).getByRole('link', { name: 'Tipo de Processo' })).toBeVisible();
    await expect(menu(page).getByRole('link', { name: 'Campus' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Novo tipo de processo' })).toHaveCount(0);
  });

  test('Betina é levada ao acesso negado ao abrir uma tela que não tem', async ({ page }) => {
    await mockPermissoesEfetivas(page, PERMISSOES_DA_BETINA);

    await page.goto('/campi');

    await expect(page).toHaveURL(/\/acesso-negado$/);
  });

  test('Fernanda, sem nenhuma permissão, não vê área administrativa nem mensagem de erro', async ({
    page,
  }) => {
    await mockPermissoesEfetivas(page, []);

    await page.goto('/');

    await expect(page).toHaveURL(/\/acesso-negado$/);
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('falha na consulta não deixa nenhuma área administrativa como permitida', async ({
    page,
  }) => {
    await falharPermissoesEfetivas(page);

    await page.goto('/campi');

    await expect(page).toHaveURL(/\/acesso-negado$/);
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);
  });
});
