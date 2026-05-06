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
});
