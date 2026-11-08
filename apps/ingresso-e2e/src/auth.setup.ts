import { test as setup } from '@playwright/test';
import * as path from 'node:path';
import { mockPermissoesEfetivas, setupKeycloakAuth } from '@uniplus/shared-e2e';

import { ADMIN_USER, STORAGE_STATE_PATH_ADMIN } from './fixtures/auth.fixture';

setup('autentica admin via OIDC e persiste storageState', async () => {
  const testInfo = setup.info();
  const baseURL =
    testInfo.config.projects[0]?.use.baseURL ??
    process.env['BASE_URL'] ??
    'http://localhost:4201';

  await setupKeycloakAuth({
    storageStatePath: path.resolve(__dirname, '..', STORAGE_STATE_PATH_ADMIN),
    appBaseUrl: baseURL,
    username: ADMIN_USER.username,
    password: ADMIN_USER.password,
    protectedRoute: '/dashboard',
    preparePage: (page) => mockPermissoesEfetivas(page, ['selecao:processos:acompanhar']),
  });
});
