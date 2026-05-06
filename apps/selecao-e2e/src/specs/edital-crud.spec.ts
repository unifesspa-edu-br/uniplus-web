import { test, expect } from '@playwright/test';
import { keycloakLogin, resetPasswords } from '../support/keycloak-login';

const ADMIN = { username: 'admin', password: 'E2eTest!123' };

test.describe('Editais — CRUD', () => {
  test.beforeAll(async () => {
    await resetPasswords([ADMIN]);
  });

  test('deve exibir a listagem de editais após login como admin', async ({ page }) => {
    await page.goto('/editais');
    await keycloakLogin(page, ADMIN.username, ADMIN.password);
    await expect(page.locator('h2')).toContainText('Editais');
    // EditaisListPage (F6) sempre renderiza um <table role="grid">; quando o
    // backend devolve lista vazia, a mensagem "Nenhum edital cadastrado." cai
    // no tbody. Quando há itens, as linhas aparecem em <tbody tr>.
    await expect(page.locator('table[role="grid"]')).toBeVisible();
  });

  test('deve permitir navegar até /editais/novo e renderizar o form de criação (F7)', async ({
    page,
  }) => {
    await page.goto('/editais');
    await keycloakLogin(page, ADMIN.username, ADMIN.password);

    await page.getByRole('link', { name: 'Novo edital' }).click();

    await expect(page).toHaveURL(/\/editais\/novo$/);
    await expect(page.locator('h2')).toContainText('Novo edital');
    await expect(page.locator('#numeroEdital')).toBeVisible();
    await expect(page.locator('#anoEdital')).toBeVisible();
    await expect(page.locator('#titulo')).toBeVisible();
    await expect(page.locator('#tipoProcesso')).toBeVisible();
    await expect(page.locator('#maximoOpcoesCurso')).toBeVisible();
    // Submit fica disabled enquanto form invalid + nenhum campo preenchido.
    await expect(page.getByRole('button', { name: 'Criar edital' })).toBeDisabled();
  });
});
