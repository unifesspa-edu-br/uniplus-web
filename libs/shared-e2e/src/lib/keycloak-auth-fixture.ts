import { chromium, expect, type FullConfig } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { keycloakLogin, resetPasswords } from './keycloak-login';

/**
 * Configuração do setup de autenticação E2E reutilizável.
 *
 * **Padrão #20 reforçado:** Playwright `storageState` armazena cookies +
 * localStorage do *browser context de teste apenas* — é isolamento por test
 * run, NÃO pattern de produção. O invariante "JWT nunca em localStorage" do
 * `uniplus-web` continua valendo no código de produção; o storageState aqui
 * persiste apenas as cookies de sessão do Keycloak (que rebuildam a sessão
 * SPA via silent-SSO no carregamento da página).
 */
export interface KeycloakAuthSetupOptions {
  /** Path absoluto do arquivo `storageState-*.json` a ser produzido. */
  readonly storageStatePath: string;
  /** Base URL da app sob teste — usado para iniciar o flow OIDC. */
  readonly appBaseUrl: string;
  /** Usuário de teste (já existente no realm; password resetado por este setup). */
  readonly username: string;
  /** Senha de teste — resetada via Admin API antes do login. */
  readonly password: string;
  /** Rota interna que dispara `authGuard` (default `/dashboard`). */
  readonly protectedRoute?: string;
  /** Quando true, faz reset da senha via Admin API antes de logar. Default true. */
  readonly resetPasswordBeforeLogin?: boolean;
}

/**
 * Setup helper invocado de `globalSetup` no `playwright.config.ts`.
 *
 * Executa, uma única vez por test run:
 * 1. Reset da senha do usuário (idempotente — Admin API).
 * 2. Login via UI numa aba headless.
 * 3. Persiste `storageState` no disco para os tests reusarem.
 *
 * Tests subsequentes que declaram `storageState: '<path>'` no playwright
 * project pulam o login via UI — abrem direto na app autenticada.
 */
export async function setupKeycloakAuth(options: KeycloakAuthSetupOptions): Promise<void> {
  const protectedRoute = options.protectedRoute ?? '/dashboard';

  if (options.resetPasswordBeforeLogin !== false) {
    await resetPasswords([{ username: options.username, password: options.password }]);
  }

  fs.mkdirSync(path.dirname(options.storageStatePath), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${options.appBaseUrl}${protectedRoute}`);
    await keycloakLogin(page, options.username, options.password);
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(options.appBaseUrl)}.*`), {
      timeout: 15_000,
    });
    await context.storageState({ path: options.storageStatePath });
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Variante de `setupKeycloakAuth` que recebe o `FullConfig` do Playwright
 * (assinatura padrão de `globalSetup`) e extrai `appBaseUrl` do project
 * options. Útil quando o globalSetup é definido como string-path no config.
 */
export function createGlobalSetup(
  options: Omit<KeycloakAuthSetupOptions, 'appBaseUrl'> & { appBaseUrl?: string },
): (config: FullConfig) => Promise<void> {
  return async (config: FullConfig) => {
    const baseURL =
      options.appBaseUrl ??
      config.projects[0]?.use.baseURL ??
      'http://localhost:4200';

    await setupKeycloakAuth({ ...options, appBaseUrl: baseURL });
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
