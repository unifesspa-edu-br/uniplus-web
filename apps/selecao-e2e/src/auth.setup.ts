import { test as setup } from '@playwright/test';
import * as path from 'node:path';
import { setupKeycloakAuth } from '@uniplus/shared-e2e';

import { ADMIN_USER, STORAGE_STATE_PATH_ADMIN } from './fixtures/auth.fixture';

/**
 * Setup project (Playwright ≥1.31): roda **apenas** quando o project
 * `selecao-authenticated` é selecionado (via `dependencies` no
 * `playwright.config.ts`). Specs filtradas que não envolvem o autenticado
 * (ex.: `--project=chromium`) NÃO disparam este setup — preserva o invariante
 * de que `KEYCLOAK_ADMIN_PASSWORD` só é exigido quando há test autenticado
 * na rodada.
 */
// eslint-disable-next-line no-empty-pattern -- setup project não usa fixtures Playwright; segundo arg é o testInfo
setup('autentica admin via Keycloak e persiste storageState', async ({}, testInfo) => {
  const baseURL =
    testInfo.config.projects[0]?.use.baseURL ??
    process.env['BASE_URL'] ??
    'http://localhost:4200';

  await setupKeycloakAuth({
    storageStatePath: path.resolve(__dirname, '..', STORAGE_STATE_PATH_ADMIN),
    appBaseUrl: baseURL,
    username: ADMIN_USER.username,
    password: ADMIN_USER.password,
    protectedRoute: '/dashboard',
  });
});
