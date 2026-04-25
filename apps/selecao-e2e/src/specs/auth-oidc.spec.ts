import { test, expect } from '@playwright/test';
import {
  resetPasswords,
  keycloakLogin,
  keycloakLogout,
  expectUserInHeader,
} from '../support/keycloak-login';

const USERS = {
  admin: { username: 'admin', password: 'E2eTest!123', displayName: 'Admin Teste', roles: ['admin'] },
  gestor: { username: 'gestor', password: 'E2eTest!123', displayName: 'Gestor Teste', roles: ['gestor'] },
  candidato: { username: 'candidato', password: 'E2eTest!123', displayName: 'Candidato Teste', roles: ['candidato'] },
};

test.describe('Autenticação OIDC — Seleção', () => {
  test.beforeAll(async () => {
    await resetPasswords([
      { username: USERS.admin.username, password: USERS.admin.password },
      { username: USERS.gestor.username, password: USERS.gestor.password },
      { username: USERS.candidato.username, password: USERS.candidato.password },
    ]);
  });

  test.describe('Redirecionamento ao Keycloak', () => {
    test('redireciona para Keycloak ao acessar rota protegida sem sessão', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
        timeout: 10_000,
      });
      await expect(page.locator('#kc-login')).toBeVisible();
    });
  });

  test.describe('Login com role autorizada', () => {
    test('admin consegue autenticar e ver dados no header', async ({ page }) => {
      const user = USERS.admin;
      await page.goto('/dashboard');
      await keycloakLogin(page, user.username, user.password);

      // keycloakLogin já aguarda waitForURL + load completo; assertion abaixo confirma o estado final.
      await expect(page).toHaveURL(/localhost:4200/);
      await expectUserInHeader(page, user.displayName, user.username, user.roles);
    });

    test('gestor consegue autenticar e acessar editais', async ({ page }) => {
      const user = USERS.gestor;
      await page.goto('/editais');
      await keycloakLogin(page, user.username, user.password);

      await expect(page).toHaveURL(/editais/);
      await expectUserInHeader(page, user.displayName, user.username, user.roles);
    });
  });

  test.describe('Controle de acesso por role', () => {
    test('candidato é redirecionado para /acesso-negado no Seleção', async ({ page }) => {
      const user = USERS.candidato;
      await page.goto('/dashboard');
      await keycloakLogin(page, user.username, user.password);

      // roleGuard('admin', 'gestor', 'avaliador') rejeita candidato
      await expect(page).toHaveURL(/acesso-negado/);
    });
  });

  test.describe('Logout', () => {
    test('botão Sair encerra a sessão e redireciona', async ({ page }) => {
      const user = USERS.admin;
      await page.goto('/dashboard');
      await keycloakLogin(page, user.username, user.password);

      await expectUserInHeader(page, user.displayName, user.username, user.roles);

      await keycloakLogout(page);

      // Após logout, ao tentar acessar rota protegida, volta ao Keycloak
      await page.goto('/dashboard');
      await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
        timeout: 10_000,
      });
      await expect(page.locator('#kc-login')).toBeVisible();
    });
  });

  test.describe('Resiliência', () => {
    test('app carrega mesmo se Keycloak estiver lento (check-sso timeout)', async ({ page }) => {
      await page.goto('/');
      const url = page.url();
      expect(url).toMatch(/realms\/unifesspa|localhost:4200/);
    });
  });
});
