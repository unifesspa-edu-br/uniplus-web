import type { Page, Route } from '@playwright/test';

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  'access-control-expose-headers': 'etag',
};

export const problema = (status: number, code: string, title: string) => ({
  type: 'about:blank',
  title,
  status,
  code,
});

export const ERRO_INTERNO = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
export const CATALOGO_DESATUALIZADO = problema(
  503,
  'uniplus.autorizacao.catalogo.desatualizado',
  'Catalog out of date',
);
export const MENSAGEM_DO_CATALOGO_DESATUALIZADO =
  'O sistema está sendo atualizado. Tente novamente em instantes.';

export interface Resposta {
  readonly status: number;
  readonly corpo?: unknown;
}

export async function responder(route: Route, resposta: Resposta): Promise<void> {
  const { status, corpo } = resposta;
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    ...(corpo === undefined
      ? {}
      : {
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(corpo),
        }),
  });
}

export interface Chamada {
  readonly metodo: string;
  readonly caminho: string;
  readonly consulta: string;
  readonly corpo: unknown;
  readonly chave: string | undefined;
}

/**
 * Atende uma rota da API respondendo ao preflight e registrando cada chamada. `resposta` recebe
 * a chamada e o número dela (a partir de 1, só entre as que não são preflight).
 */
export async function mockRota(
  page: Page,
  padrao: RegExp,
  resposta: (chamada: Chamada, numero: number) => Resposta,
): Promise<Chamada[]> {
  const chamadas: Chamada[] = [];
  await page.route(padrao, async (route) => {
    const requisicao = route.request();
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const url = new URL(requisicao.url());
    const chamada: Chamada = {
      metodo: requisicao.method(),
      caminho: url.pathname,
      consulta: url.search,
      corpo: requisicao.postData() === null ? null : requisicao.postDataJSON(),
      chave: requisicao.headers()['idempotency-key'],
    };
    chamadas.push(chamada);
    await responder(route, resposta(chamada, chamadas.length));
  });
  return chamadas;
}

/** O cadastro de unidades que nomeia o escopo das concessões. */
export async function mockUnidades(page: Page): Promise<void> {
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS_HEADERS })
      : route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          json: [{ id: UNIDADE_CEPS, nome: 'Centro de Seleção', sigla: 'CEPS' }],
        }),
  );
}

export const UNIDADE_CEPS = '01960000-0000-7000-0000-00000000aa01';
