import { open, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Page, expect, request as playwrightRequest } from '@playwright/test';

const KEYCLOAK_BASE = process.env['KEYCLOAK_URL'] || 'http://localhost:8080';
const KEYCLOAK_REALM = 'unifesspa';
const KEYCLOAK_ADMIN_USER = process.env['KEYCLOAK_ADMIN'] || 'admin';
const RESET_LOCK_PATH = path.join(tmpdir(), 'uniplus-keycloak-reset.lock');
const RESET_LOCK_TIMEOUT_MS = 60_000;
const RESET_LOCK_STALE_MS = 60_000;
const RESET_PASSWORD_MAX_ATTEMPTS = 8;

/**
 * Reseta as senhas de múltiplos usuários para valores conhecidos e
 * não-temporários via Keycloak Admin API. Usa uma única sessão de
 * admin token e APIRequestContext para evitar problemas de conexão
 * ao criar/destruir contextos por usuário.
 */
export async function resetPasswords(
  users: Array<{ username: string; password: string }>,
): Promise<void> {
  await withResetLock(async () => {
    const api = await playwrightRequest.newContext({ baseURL: KEYCLOAK_BASE });

    try {
      // 1. Obter admin token (uma vez)
      const tokenResp = await api.post('/realms/master/protocol/openid-connect/token', {
        form: {
          grant_type: 'password',
          client_id: 'admin-cli',
          username: KEYCLOAK_ADMIN_USER,
          password: keycloakAdminPassword(),
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
        const userId = found[0].id as string;

        await clearBruteForceFailures(api, authHeader, userId);

        let lastStatus = 0;
        for (let attempt = 0; attempt < RESET_PASSWORD_MAX_ATTEMPTS; attempt++) {
          if (attempt > 0) await delay(250 * attempt);

          const resetResp = await api.put(
            `/admin/realms/${KEYCLOAK_REALM}/users/${userId}/reset-password`,
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
          throw new Error(
            `Falha ao resetar senha de '${username}' após ${RESET_PASSWORD_MAX_ATTEMPTS} tentativas (500 — provável StaleStateException no Keycloak)`,
          );
        }
        await clearBruteForceFailures(api, authHeader, userId);
      }
    } finally {
      await api.dispose();
    }
  });
}

function keycloakAdminPassword(): string {
  const val = process.env['KEYCLOAK_ADMIN_PASSWORD'];
  if (!val) {
    throw new Error('KEYCLOAK_ADMIN_PASSWORD não definido — configure a variável de ambiente antes de rodar os testes E2E autenticados.');
  }
  return val;
}

async function clearBruteForceFailures(
  api: Awaited<ReturnType<typeof playwrightRequest.newContext>>,
  authHeader: { Authorization: string },
  userId: string,
): Promise<void> {
  const response = await api.delete(
    `/admin/realms/${KEYCLOAK_REALM}/attack-detection/brute-force/users/${userId}`,
    { headers: authHeader },
  );

  if (response.ok() || response.status() === 404) {
    return;
  }

  const body = await response.text();
  throw new Error(`Falha ao limpar brute-force do usuário '${userId}': ${response.status()} ${body}`);
}

/** Pattern default de redirect pós-login — apps locais em `localhost:<porta>`. */
const DEFAULT_REDIRECT_PATTERN = /localhost:\d{4}/;

/**
 * Realiza login via UI do Keycloak.
 *
 * Espera que a página já tenha sido redirecionada ao Keycloak
 * (ex.: após navegar para rota protegida por authGuard).
 *
 * `expectRedirectTo` controla o pattern de URL esperada após o submit do
 * login. Default `/localhost:\d{4}/` cobre dev local; passe um pattern
 * customizado para staging/prod (ex.: `/staging\.uniplus\.unifesspa\.edu\.br/`).
 */
export async function keycloakLogin(
  page: Page,
  username: string,
  password: string,
  options: { readonly expectRedirectTo?: RegExp } = {},
): Promise<void> {
  const expectRedirectTo = options.expectRedirectTo ?? DEFAULT_REDIRECT_PATTERN;

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
  await page.waitForURL(expectRedirectTo, { timeout: 10_000 });
  // networkidle é tolerado neste helper porque o fluxo OIDC tem múltiplas
  // requisições paralelas (Keycloak + tokens + perfil do usuário). Esperas
  // determinísticas alternativas (p.ex., aguardar elemento específico) ficam
  // frágeis aqui porque o helper é genérico — quem chama pode estar testando
  // qualquer rota da app. A regra `playwright/no-networkidle` não está
  // habilitada no lint config de `shared-e2e` (lib), apenas nos apps E2E.
  await page.waitForLoadState('networkidle');
}

/**
 * Realiza logout clicando no botão "Sair" do header.
 */
export async function keycloakLogout(page: Page): Promise<void> {
  const logoutBtn = await openAccountMenu(page);
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
  const trigger = userInfo.getByRole('button', {
    name: new RegExp(`^Abrir menu da conta de ${escapeRegExp(expectedName)}$`),
  });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

async function openAccountMenu(page: Page) {
  const trigger = page.getByRole('button', { name: /^Abrir menu da conta de / });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const logoutBtn = page.getByRole('menuitem', { name: 'Sair' });
  await expect(logoutBtn).toBeVisible();
  return logoutBtn;
}

async function withResetLock<T>(action: () => Promise<T>): Promise<T> {
  const handle = await acquireResetLock();
  try {
    return await action();
  } finally {
    await handle.close();
    await unlink(RESET_LOCK_PATH).catch(() => undefined);
  }
}

async function acquireResetLock() {
  const deadline = Date.now() + RESET_LOCK_TIMEOUT_MS;

  while (true) {
    try {
      return await open(RESET_LOCK_PATH, 'wx');
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') {
        throw error;
      }
      await removeStaleResetLock();
      if (Date.now() >= deadline) {
        throw new Error(`Timeout aguardando lock de reset de senhas do Keycloak: ${RESET_LOCK_PATH}`);
      }
      await delay(250);
    }
  }
}

async function removeStaleResetLock(): Promise<void> {
  try {
    const info = await stat(RESET_LOCK_PATH);
    if (Date.now() - info.mtimeMs > RESET_LOCK_STALE_MS) {
      await unlink(RESET_LOCK_PATH);
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
