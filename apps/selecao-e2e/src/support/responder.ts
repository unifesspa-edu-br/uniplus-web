import type { Page, Route } from '@playwright/test';

/**
 * Responde à rota com JSON 200 e atende o preflight CORS. O corpo pode ser uma função: ela é lida
 * a cada requisição, para o spec que muda o dado entre uma consulta e outra.
 */
export async function responder(
  page: Page,
  rota: RegExp,
  corpo: unknown,
  cabecalhos: Record<string, string>,
): Promise<void> {
  await page.route(rota, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cabecalhos });
      return;
    }
    await responderCom(route, typeof corpo === 'function' ? corpo() : corpo, cabecalhos);
  });
}

/** Um recurso da API (sem o prefixo `/api/`) e o corpo com que o cenário o responde. */
export type CatalogoMockado = readonly [recurso: string, corpo: unknown];

/** Responde cada recurso da tabela, com ou sem query string, e atende o preflight CORS. */
export async function responderCatalogos(
  page: Page,
  catalogos: readonly CatalogoMockado[],
  cabecalhos: Record<string, string>,
): Promise<void> {
  for (const [recurso, corpo] of catalogos) {
    await responder(page, new RegExp(`/api/${recurso}(\\?.*)?$`), corpo, cabecalhos);
  }
}

/**
 * Responde o catálogo de regras filtrado por `tipo`: cada tipo devolve a própria lista, e o que o
 * cenário não declara volta vazio — devolver a mesma lista para qualquer tipo mascararia um
 * filtro quebrado.
 */
export async function responderRegrasDoCatalogo(
  page: Page,
  regrasPorTipo: Record<string, readonly unknown[]>,
  cabecalhos: Record<string, string>,
): Promise<void> {
  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cabecalhos });
      return;
    }
    const tipo = new URL(route.request().url()).searchParams.get('tipo') ?? '';
    await responderCom(route, regrasPorTipo[tipo] ?? [], cabecalhos);
  });
}

export async function responderCom(
  route: Route,
  corpo: unknown,
  cabecalhos: Record<string, string>,
): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: cabecalhos,
    body: JSON.stringify(corpo),
  });
}
