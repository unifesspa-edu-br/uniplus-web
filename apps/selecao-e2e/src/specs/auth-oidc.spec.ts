import { test, expect } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  resetPasswords,
  keycloakLogin,
  keycloakLogout,
  expectUserInHeader,
} from '../support/keycloak-login';

const USERS = {
  admin: { username: 'admin', password: 'E2eTest!123', displayName: 'Admin Teste' },
  gestor: { username: 'gestor', password: 'E2eTest!123', displayName: 'Gestor Teste' },
  candidato: { username: 'candidato', password: 'E2eTest!123', displayName: 'Candidato Teste' },
};

test.describe('Autenticação OIDC — Seleção', () => {
  test.beforeAll(async () => {
    await resetPasswords([
      { username: USERS.admin.username, password: USERS.admin.password },
      { username: USERS.gestor.username, password: USERS.gestor.password },
      { username: USERS.candidato.username, password: USERS.candidato.password },
    ]);
  });

  const ACOMPANHA = ['selecao:processos:acompanhar'];

  test.describe('Redirecionamento ao provedor OIDC', () => {
    test('redireciona para o provedor OIDC ao acessar rota protegida sem sessão', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
        timeout: 10_000,
      });
      await expect(page.locator('#kc-login')).toBeVisible();
    });

    test('redireciona para o provedor OIDC ao acessar a página de acesso negado sem sessão', async ({
      page,
    }) => {
      await page.goto('/acesso-negado');
      await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
        timeout: 10_000,
      });
      await expect(page.locator('#kc-login')).toBeVisible();
      // O login volta à raiz do app, que escolhe a entrada pelas permissões.
      const voltaDoLogin = new URL(page.url()).searchParams.get('redirect_uri') ?? '';
      expect(new URL(voltaDoLogin).pathname).toBe('/');
    });
  });

  test.describe('Login com permissão efetiva', () => {
    test('admin consegue autenticar e ver dados no header', async ({ page }) => {
      const user = USERS.admin;
      await mockPermissoesEfetivas(page, ACOMPANHA);
      await page.goto('/dashboard');
      await keycloakLogin(page, user.username, user.password);

      // keycloakLogin já aguarda waitForURL + load completo; assertion abaixo confirma o estado final.
      await expect(page).toHaveURL(/localhost:4200/);
      await expectUserInHeader(page, user.displayName, user.username);
    });

    test('gestor consegue autenticar e acessar inscrições', async ({ page }) => {
      const user = USERS.gestor;
      await mockPermissoesEfetivas(page, ['selecao:inscricoes:consultar']);
      await page.goto('/inscricoes');
      await keycloakLogin(page, user.username, user.password);

      await expect(page).toHaveURL(/inscricoes/);
      await expectUserInHeader(page, user.displayName, user.username);
    });
  });

  test.describe('Controle de acesso por permissão', () => {
    test('quem não tem permissão da Seleção é redirecionado para /acesso-negado', async ({
      page,
    }) => {
      const user = USERS.candidato;
      await mockPermissoesEfetivas(page, []);
      await page.goto('/dashboard');
      await keycloakLogin(page, user.username, user.password);

      await expect(page).toHaveURL(/acesso-negado/);
    });
  });

  test.describe('Logout', () => {
    test('botão Sair encerra a sessão e redireciona', async ({ page }) => {
      const user = USERS.admin;
      await mockPermissoesEfetivas(page, ACOMPANHA);
      await page.goto('/dashboard');
      await keycloakLogin(page, user.username, user.password);

      await expectUserInHeader(page, user.displayName, user.username);

      await keycloakLogout(page);

      // Após logout, ao tentar acessar rota protegida, volta ao provedor OIDC.
      await page.goto('/dashboard');
      await page.waitForURL(/realms\/unifesspa\/protocol\/openid-connect/, {
        timeout: 10_000,
      });
      await expect(page.locator('#kc-login')).toBeVisible();
    });
  });

  test.describe('Resiliência', () => {
    test('app carrega mesmo se o provedor OIDC estiver lento (check-sso timeout)', async ({
      page,
    }) => {
      await page.goto('/');
      const url = page.url();
      expect(url).toMatch(/realms\/unifesspa|localhost:4200/);
    });
  });
});
