import { test, expect } from '@playwright/test';
import {
  resetPasswords,
  keycloakLogin,
  keycloakLogout,
  expectUserInHeader,
} from '@uniplus/shared-e2e';

const USERS = {
  admin: { username: 'admin', password: 'E2eTest!123', displayName: 'Admin Teste', roles: ['admin'] },
  gestor: { username: 'gestor', password: 'E2eTest!123', displayName: 'Gestor Teste', roles: ['gestor'] },
  candidato: { username: 'candidato', password: 'E2eTest!123', displayName: 'Candidato Teste', roles: ['candidato'] },
};

test.describe('Autenticação OIDC — Ingresso', () => {
  test.beforeAll(async () => {
    await resetPasswords([
      { username: USERS.admin.username, password: USERS.admin.password },
      { username: USERS.gestor.username, password: USERS.gestor.password },
      { username: USERS.candidato.username, password: USERS.candidato.password },
    ]);
  });

  test('redireciona para o provedor OIDC ao acessar rota protegida sem sessão', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
      timeout: 10_000,
    });
    await expect(page.locator('#kc-login')).toBeVisible();
  });

  test('admin consegue autenticar e ver dados no header', async ({ page }) => {
    const user = USERS.admin;
    await page.goto('/dashboard');
    await keycloakLogin(page, user.username, user.password);

    await expect(page).toHaveURL(/localhost:4201/);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expectUserInHeader(page, user.displayName, user.username, user.roles);
  });

  test('gestor consegue autenticar e acessar dashboard', async ({ page }) => {
    const user = USERS.gestor;
    await page.goto('/dashboard');
    await keycloakLogin(page, user.username, user.password);

    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expectUserInHeader(page, user.displayName, user.username, user.roles);
  });

  test('candidato autenticado e redirecionado para /acesso-negado', async ({ page }) => {
    const user = USERS.candidato;
    await page.goto('/dashboard');
    await keycloakLogin(page, user.username, user.password);

    await expect(page).toHaveURL(/acesso-negado/);
    await expect(page.getByRole('heading', { name: 'Acesso negado', level: 1 })).toBeVisible();
  });

  test('Sair encerra a sessão e rota protegida redireciona ao provedor OIDC', async ({ page }) => {
    const user = USERS.admin;
    await page.goto('/dashboard');
    await keycloakLogin(page, user.username, user.password);

    await expectUserInHeader(page, user.displayName, user.username, user.roles);
    await keycloakLogout(page);

    await page.goto('/dashboard');
    await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
      timeout: 10_000,
    });
    await expect(page.locator('#kc-login')).toBeVisible();
  });
});
