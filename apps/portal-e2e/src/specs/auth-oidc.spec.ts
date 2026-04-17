import { test, expect } from '@playwright/test';
import {
  resetPasswords,
  keycloakLogin,
  keycloakLogout,
  expectUserInHeader,
} from '../support/keycloak-login';

const USERS = {
  candidato: { username: 'candidato', password: 'E2eTest!123', displayName: 'Candidato Teste', roles: ['candidato'] },
  admin: { username: 'admin', password: 'E2eTest!123', displayName: 'Admin Teste', roles: ['admin'] },
};

test.describe('Autenticação OIDC — Portal do Candidato', () => {
  test.beforeAll(async () => {
    await resetPasswords([{ username: USERS.candidato.username, password: USERS.candidato.password }, { username: USERS.admin.username, password: USERS.admin.password }]);
  });

  test.describe('Acesso público', () => {
    test('rota /processos carrega sem autenticação', async ({ page }) => {
      await page.goto('/processos');

      // Não deve redirecionar ao Keycloak (rota pública)
      await expect(page).toHaveURL(/processos/);
      await expect(page.locator('h2')).toContainText('Processos Seletivos');
    });

    test('header não exibe user info em rota pública', async ({ page }) => {
      await page.goto('/processos');

      const logoutBtn = page.locator('button[aria-label="Sair da aplicação"]');
      await expect(logoutBtn).not.toBeVisible();
    });
  });

  test.describe('Rotas autenticadas — candidato', () => {
    test('redireciona para Keycloak ao acessar /perfil sem sessão', async ({ page }) => {
      await page.goto('/perfil');
      await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
        timeout: 10_000,
      });
      await expect(page.locator('#kc-login')).toBeVisible();
    });

    test('candidato consegue acessar o portal após login', async ({ page }) => {
      const user = USERS.candidato;
      await page.goto('/perfil');
      await keycloakLogin(page, user.username, user.password);

      await expect(page).toHaveURL(/localhost:4202/);
    });

    test('header exibe nome social do candidato (RN02)', async ({ page }) => {
      const user = USERS.candidato;
      await page.goto('/perfil');
      await keycloakLogin(page, user.username, user.password);

      // Nome social "Candidato Teste" tem prioridade sobre nome civil "Usuário Candidato"
      await expectUserInHeader(page, user.displayName, user.username, user.roles);

      const header = page.locator('header');
      // Verifica que NÃO exibe o nome civil quando há nome social
      await expect(header.getByText('Usuário Candidato')).not.toBeVisible();
    });

    test('candidato acessa /acompanhamento (authGuard sem roleGuard)', async ({ page }) => {
      const user = USERS.candidato;
      await page.goto('/acompanhamento');
      await keycloakLogin(page, user.username, user.password);

      // Portal usa apenas authGuard (sem roleGuard) — qualquer autenticado entra
      await expect(page).toHaveURL(/acompanhamento/);
    });
  });

  test.describe('Admin no Portal', () => {
    test('admin também consegue acessar o portal (sem restrição de role)', async ({ page }) => {
      const user = USERS.admin;
      await page.goto('/perfil');
      await keycloakLogin(page, user.username, user.password);

      await expect(page).toHaveURL(/localhost:4202/);
      await expectUserInHeader(page, user.displayName, user.username, user.roles);
    });
  });

  test.describe('Logout', () => {
    test('botão Sair encerra sessão e rota protegida redireciona ao Keycloak', async ({ page }) => {
      const user = USERS.candidato;
      await page.goto('/perfil');
      await keycloakLogin(page, user.username, user.password);

      await keycloakLogout(page);

      // Tentar acessar rota protegida novamente
      await page.goto('/perfil');
      await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
        timeout: 10_000,
      });
      await expect(page.locator('#kc-login')).toBeVisible();
    });
  });

  test.describe('Navegação autenticada', () => {
    test('navegação entre rotas protegidas mantém sessão', async ({ page }) => {
      const user = USERS.candidato;
      await page.goto('/perfil');
      await keycloakLogin(page, user.username, user.password);

      // Navegar para outra rota protegida
      await page.click('a[href="/acompanhamento"]');
      await expect(page).toHaveURL(/acompanhamento/);

      // Navegar para documentos
      await page.click('a[href="/documentos"]');
      await expect(page).toHaveURL(/documentos/);

      // Header continua mostrando user info
      await expectUserInHeader(page, user.displayName, user.username, user.roles);
    });
  });
});
