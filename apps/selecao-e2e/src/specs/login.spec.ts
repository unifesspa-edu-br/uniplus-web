import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('deve redirecionar usuário não autenticado para o provedor OIDC', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, { timeout: 10_000 });
    await expect(page.locator('#kc-login')).toBeVisible();
  });
});
