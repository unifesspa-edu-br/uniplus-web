import type { FullConfig } from '@playwright/test';
import * as path from 'node:path';
import { setupKeycloakAuth } from '@uniplus/shared-e2e';

import { ADMIN_USER, STORAGE_STATE_PATH_ADMIN } from './fixtures/auth.fixture';

/**
 * `globalSetup` Playwright — executa uma vez por test run, antes de qualquer
 * spec rodar. Reseta a senha do admin no Keycloak e persiste o `storageState`
 * autenticado em disco. Specs que declaram o `selecao-authenticated` project
 * (ver `playwright.config.ts`) reusam esse state e pulam o login UI.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use.baseURL ??
    process.env['BASE_URL'] ??
    'http://localhost:4200';

  await setupKeycloakAuth({
    storageStatePath: path.resolve(__dirname, '..', STORAGE_STATE_PATH_ADMIN),
    appBaseUrl: baseURL,
    username: ADMIN_USER.username,
    password: ADMIN_USER.password,
    protectedRoute: '/dashboard',
  });
}
