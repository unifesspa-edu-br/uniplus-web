import { test, expect } from '@playwright/test';

test('deve redirecionar para o Keycloak ao acessar a raiz sem sessão', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, { timeout: 10_000 });
  await expect(page.locator('#kc-login')).toBeVisible();
});

test.skip('deve exibir listagem de editais após login (requer API)', async ({ page }) => {
  // Teste de integração completo — requer API Seleção (:5000) e usuário autenticado.
  // Coberto em profundidade pelos testes de auth-oidc.spec.ts + edital-crud.spec.ts.
  await page.goto('/editais');
  await expect(page.locator('h2')).toContainText('Editais');
});
