import { Page, expect, request as playwrightRequest, APIRequestContext } from '@playwright/test';

const KEYCLOAK_BASE = process.env['KEYCLOAK_URL'] || 'http://localhost:8080';
const KEYCLOAK_REALM = 'unifesspa';
const KEYCLOAK_ADMIN_USER = process.env['KEYCLOAK_ADMIN'] || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env['KEYCLOAK_ADMIN_PASSWORD'] || 'admin';

/**
 * Reseta as senhas de múltiplos usuários para valores conhecidos e
 * não-temporários via Keycloak Admin API. Usa uma única sessão de
 * admin token e APIRequestContext para evitar problemas de conexão
 * ao criar/destruir contextos por usuário.
 */
export async function resetPasswords(
  users: Array<{ username: string; password: string }>,
): Promise<void> {
  const api = await playwrightRequest.newContext({ baseURL: KEYCLOAK_BASE });

  try {
    // 1. Obter admin token (uma vez)
    const tokenResp = await api.post('/realms/master/protocol/openid-connect/token', {
      form: {
        grant_type: 'password',
        client_id: 'admin-cli',
        username: KEYCLOAK_ADMIN_USER,
        password: KEYCLOAK_ADMIN_PASSWORD,
      },
    });
    const tokenData = await tokenResp.json();
    const adminToken = tokenData.access_token;
    if (!adminToken) throw new Error(`Falha ao obter admin token: ${JSON.stringify(tokenData)}`);

    const authHeader = { Authorization: `Bearer ${adminToken}` };

    // 2. Reset cada usuário sequencialmente (com retry para StaleStateException do Hibernate)
    for (const { username, password } of users) {
      const usersResp = await api.get(
        `/admin/realms/${KEYCLOAK_REALM}/users?username=${username}&exact=true`,
        { headers: authHeader },
      );
      const found = await usersResp.json();
      if (!found.length) throw new Error(`Usuário '${username}' não encontrado no realm ${KEYCLOAK_REALM}`);

      let lastStatus = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500));

        const resetResp = await api.put(
          `/admin/realms/${KEYCLOAK_REALM}/users/${found[0].id}/reset-password`,
          {
            headers: { ...authHeader, 'Content-Type': 'application/json' },
            data: JSON.stringify({ type: 'password', value: password, temporary: false }),
          },
        );
        lastStatus = resetResp.status();
        if (resetResp.ok()) break;
        if (lastStatus !== 500) {
          const body = await resetResp.text();
          throw new Error(`Falha ao resetar senha de '${username}': ${lastStatus} ${body}`);
        }
      }
      if (lastStatus === 500) {
        throw new Error(`Falha ao resetar senha de '${username}' após 3 tentativas (500 — provável StaleStateException no Keycloak)`);
      }
    }
  } finally {
    await api.dispose();
  }
}

/**
 * Realiza login via UI do Keycloak.
 *
 * Espera que a página já tenha sido redirecionada ao Keycloak
 * (ex.: após navegar para rota protegida por authGuard).
 */
export async function keycloakLogin(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  // Aguardar o formulário de login do Keycloak
  await page.waitForSelector('#kc-login', { timeout: 10_000 });

  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('#kc-login');

  // Se a senha era temporária, o Keycloak mostra formulário de troca.
  const updateForm = page.locator('#kc-passwd-update-form');
  if (await updateForm.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.fill('#password-new', password);
    await page.fill('#password-confirm', password);
    await page.click('[type="submit"]');
  }

  // Aguardar redirect de volta à aplicação + carregamento completo
  await page.waitForURL(/localhost:\d{4}/, { timeout: 10_000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Realiza logout clicando no botão "Sair" do header.
 */
export async function keycloakLogout(page: Page): Promise<void> {
  const logoutBtn = page.locator('button[aria-label="Sair da aplicação"]');
  await expect(logoutBtn).toBeVisible();
  await logoutBtn.click();
  await page.waitForURL(/localhost:\d{4}/, { timeout: 10_000 });
}

/**
 * Verifica que o header exibe as informações do usuário autenticado.
 */
export async function expectUserInHeader(
  page: Page,
  expectedName: string,
  expectedUsername: string,
  _expectedRoles: string[],
): Promise<void> {
  // Verificar presença do componente de user info no DOM (sem scoping ao <header>,
  // porque Angular custom elements podem criar fronteiras inesperadas para locators)
  const userInfo = page.locator('auth-user-header-info');
  await expect(userInfo.getByText(expectedName)).toBeVisible({ timeout: 5_000 });
  await expect(userInfo.getByText(`@${expectedUsername}`)).toBeVisible();
  await expect(page.locator('button[aria-label="Sair da aplicação"]')).toBeVisible();
}
