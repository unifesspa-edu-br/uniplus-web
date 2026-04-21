import { test, expect } from '@playwright/test';

test('deve carregar rota pública /processos sem autenticação', async ({ page }) => {
  await page.goto('/processos');
  await expect(page).toHaveURL(/processos/);
  await expect(page.locator('h2')).toContainText('Processos Seletivos');
});

test('deve redirecionar para o Keycloak ao acessar rota protegida sem sessão', async ({ page }) => {
  await page.goto('/perfil');
  await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, { timeout: 10_000 });
  await expect(page.locator('#kc-login')).toBeVisible();
});
