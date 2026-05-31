import { test as setup } from '@playwright/test';
import * as path from 'node:path';
import { setupKeycloakAuth } from '@uniplus/shared-e2e';

import { ADMIN_USER, STORAGE_STATE_PATH_ADMIN } from './fixtures/auth.fixture';

// eslint-disable-next-line no-empty-pattern -- setup project não usa fixtures Playwright; segundo arg é o testInfo
setup('autentica admin via Keycloak e persiste storageState', async ({}, testInfo) => {
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
  });
});
