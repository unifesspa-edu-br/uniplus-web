import { test, expect } from '@playwright/test';

test('deve redirecionar para o Keycloak ao acessar a raiz sem sessão', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, { timeout: 10_000 });
  await expect(page.locator('#kc-login')).toBeVisible();
});

test.skip('deve exibir dashboard após login (requer fixture Keycloak + API Ingresso)', async ({ page }) => {
  // Teste de integração completo — requer Keycloak rodando com usuário
  // de role admin/gestor + API Ingresso. Coberto futuramente em
  // auth-oidc.spec.ts + chamadas-flow.spec.ts (a implementar).
  await page.goto('/dashboard');
  await expect(page.locator('h1')).toContainText('Ingresso');
});
