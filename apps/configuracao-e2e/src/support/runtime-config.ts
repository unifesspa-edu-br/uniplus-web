import type { Page } from '@playwright/test';

const CONFIGURACAO_E2E_RUNTIME_CONFIG = {
  apiUrl: 'http://localhost:5000',
  oidc: {
    issuerUrl: `${keycloakUrl()}/realms/unifesspa`,
    clientId: 'configuracao-web',
  },
} as const;

export async function mockConfiguracaoRuntimeConfig(page: Page): Promise<void> {
  await page.route(/\/assets\/runtime-config\.json(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONFIGURACAO_E2E_RUNTIME_CONFIG),
    });
  });
}

function keycloakUrl(): string {
  return (process.env['KEYCLOAK_URL'] || 'http://localhost:8080').replace(/\/$/u, '');
}
