import type { Page } from '@playwright/test';

const CAMINHO = /\/api\/autorizacao\/permissoes\/efetivas(\?.*)?$/;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

/**
 * Responde `GET /api/autorizacao/permissoes/efetivas` com as permissões informadas, no formato
 * `{ codigo, nome }` do contrato. Sem códigos, devolve a lista vazia de quem não tem nenhuma
 * concessão. Um registro posterior vence o anterior, então um teste pode trocar o que o hook
 * comum do app instalou.
 */
export async function mockPermissoesEfetivas(
  page: Page,
  codigos: readonly string[],
): Promise<void> {
  await page.route(CAMINHO, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS,
      contentType: 'application/vnd.uniplus.permissao-efetiva.v1+json',
      body: JSON.stringify(codigos.map((codigo) => ({ codigo, nome: codigo }))),
    });
  });
}

/** Faz a consulta de permissões falhar como se a rede tivesse caído. */
export async function falharPermissoesEfetivas(page: Page): Promise<void> {
  await page.route(CAMINHO, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.abort('failed'),
  );
}
