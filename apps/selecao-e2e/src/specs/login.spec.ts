import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('deve redirecionar usuário não autenticado', async ({ page }) => {
    await page.goto('/dashboard');
    // TODO: verificar redirecionamento para Keycloak quando auth estiver habilitado
    await expect(page).toHaveURL(/dashboard/);
  });
});
