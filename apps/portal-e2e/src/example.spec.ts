import { test, expect } from '@playwright/test';

test('deve carregar rota pública /processos sem autenticação', async ({ page }) => {
  await page.goto('/processos');
  await expect(page).toHaveURL(/processos/);
  await expect(page.getByRole('heading', { name: 'Processos Seletivos', level: 1 })).toBeVisible();
});

test('deve redirecionar para o provedor OIDC ao acessar rota protegida sem sessão', async ({ page }) => {
  await page.goto('/perfil');
  await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, { timeout: 10_000 });
  await expect(page.locator('#kc-login')).toBeVisible();
});
