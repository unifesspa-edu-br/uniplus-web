import { test as base } from './base.fixture';

/**
 * Path do `storageState` autenticado como admin (relativo ao cwd onde o
 * Playwright executa — `apps/selecao-e2e/`). Persistido pelo `globalSetup`
 * e consumido pelo project `selecao-authenticated` no `playwright.config.ts`.
 *
 * Padrão #20 reforçado: o storageState contém apenas cookies de sessão do
 * Keycloak (não JWT). É isolamento por test run, NÃO pattern de produção —
 * a invariante "JWT só em memória do KeycloakService" do código de produção
 * continua valendo.
 */
export const STORAGE_STATE_PATH_ADMIN = '.playwright-auth/storage-state-admin.json';

/** Credenciais do usuário admin de teste — alinhadas ao seed do realm. */
export const ADMIN_USER = {
  username: 'admin',
  password: 'E2eTest!123',
} as const;

/**
 * Test base re-exportado sem extensões adicionais. Specs que rodam no project
 * `selecao-authenticated` (declarado em `playwright.config.ts`) já carregam o
 * `storageState` automaticamente — não precisam logar no `beforeAll`.
 *
 * Specs legadas que continuam fazendo login via UI (ex.: `auth-oidc.spec.ts`,
 * `login.spec.ts`) usam diretamente `@playwright/test` e os helpers em
 * `../support/keycloak-login`. Não há conflito — projects são independentes.
 */
export const test = base;

export { expect } from '@playwright/test';
