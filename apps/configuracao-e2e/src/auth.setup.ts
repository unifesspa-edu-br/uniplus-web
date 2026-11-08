import { test as setup } from '@playwright/test';
import * as path from 'node:path';
import { setupKeycloakAuth } from '@uniplus/shared-e2e';
import { ADMIN_USER, STORAGE_STATE_PATH_ADMIN } from './fixtures/auth.fixture';
import { mockConfiguracaoRuntimeConfig } from './support/runtime-config';

setup('autentica admin da Configuração e persiste storageState', async () => {
  const testInfo = setup.info();
  const baseURL =
    testInfo.config.projects[0]?.use.baseURL ??
    process.env['BASE_URL'] ??
    'http://localhost:4203';

  await setupKeycloakAuth({
    storageStatePath: path.resolve(__dirname, '..', STORAGE_STATE_PATH_ADMIN),
    appBaseUrl: baseURL,
    username: ADMIN_USER.username,
    password: ADMIN_USER.password,
    protectedRoute: '/unidades',
    preparePage: mockConfiguracaoRuntimeConfig,
  });
});
