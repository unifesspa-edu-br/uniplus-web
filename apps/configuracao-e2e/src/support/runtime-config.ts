import type { Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { TODAS_AS_PERMISSOES_DA_CONFIGURACAO } from './permissoes';

const CONFIGURACAO_E2E_RUNTIME_CONFIG = {
  apiUrl: 'http://localhost:5000',
  oidc: {
    issuerUrl: `${keycloakUrl()}/realms/unifesspa`,
    clientId: 'configuracao-web',
  },
} as const;

/**
 * Prepara a página do app: runtime-config e, como o menu e as rotas dependem das permissões
 * efetivas, a resposta de uma pessoa que tem todas. Um teste que precisa de outro perfil chama
 * `mockPermissoesEfetivas` depois.
 */
export async function mockConfiguracaoRuntimeConfig(page: Page): Promise<void> {
  await mockPermissoesEfetivas(page, TODAS_AS_PERMISSOES_DA_CONFIGURACAO);
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
