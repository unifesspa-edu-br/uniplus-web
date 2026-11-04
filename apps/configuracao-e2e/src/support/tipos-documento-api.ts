import type { Page, Route } from '@playwright/test';

/** API mockada do cadastro de Tipo de Documento, compartilhada pelos specs da tela. */
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

/**
 * Catálogo de categorias servido pelo endpoint `GET
 * /api/configuracao/categorias-documento`. Espelha o seed do backend — as dez
 * categorias na ordem de exibição — porque é dele que a tela deriva as opções do
 * `select`, os chips de filtro e o rótulo da coluna. Mockar só as três usadas
 * pelos casos daria uma tela que não existe em nenhum ambiente.
 */
export const categoriasSeed = [
  { codigo: 'IDENTIFICACAO', nome: 'Identificação' },
  { codigo: 'ESCOLARIDADE', nome: 'Escolaridade' },
  { codigo: 'TITULACAO_EXPERIENCIA', nome: 'Titulação e experiência' },
  { codigo: 'RENDA', nome: 'Renda' },
  { codigo: 'RESIDENCIA', nome: 'Residência' },
  { codigo: 'RACA_ETNIA', nome: 'Raça/etnia' },
  { codigo: 'SAUDE', nome: 'Saúde' },
  { codigo: 'DOCUMENTO_PROCESSUAL', nome: 'Documento processual' },
  { codigo: 'PRODUCAO_AVALIATIVA', nome: 'Produção avaliativa' },
  { codigo: 'OUTROS', nome: 'Outros' },
].map((categoria, indice) => ({
  id: `01990000-0000-7000-0000-0000000000${(indice + 1).toString(16).padStart(2, '0')}`,
  codigo: categoria.codigo,
  nome: categoria.nome,
  descricao: null,
  ordem: indice + 1,
  criadoEm: '2026-08-30T12:00:00Z',
}));

const RG_ID = '01960000-0000-7000-0000-0000000000d1';
const LAUDO_ID = '01960000-0000-7000-0000-0000000000d2';

export const rgSeed = {
  id: RG_ID,
  codigo: 'RG',
  nome: 'Registro Geral',
  descricao: 'Documento de identificação civil.',
  categoria: 'IDENTIFICACAO',
  formatosAceitos: 'pdf,jpg',
  tamanhoMaximoMb: 10,
  tipoEquivalente: 'CIN',
  criadoEm: '2026-06-10T12:00:00Z',
};

export const laudoSeed = {
  id: LAUDO_ID,
  codigo: 'LAUDO_MEDICO',
  nome: 'Laudo médico — PcD',
  descricao: null,
  categoria: 'SAUDE',
  formatosAceitos: null,
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  criadoEm: '2026-06-11T12:00:00Z',
};

export interface Capturado {
  readonly posts: unknown[];
  readonly deletedIds: string[];
}

export function novoCapturado(): Capturado {
  return { posts: [], deletedIds: [] };
}

export async function mockApi(
  page: Page,
  capturado: Capturado,
  lista: readonly unknown[],
  opcoes: { readonly criarStatus?: number; readonly criarBody?: unknown } = {},
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/tipos-documento\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const partes = route.request().url().split('/');
      capturado.deletedIds.push(partes[partes.length - 1] ?? '');
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/admin\/tipos-documento(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      const status = opcoes.criarStatus ?? 201;
      await route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(opcoes.criarBody ?? 'novo-tipo-documento-id'),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/tipos-documento(\?.*)?$/, (route) =>
    jsonRoute(route, lista),
  );
  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (route) =>
    jsonRoute(route, categoriasSeed),
  );
}

async function jsonRoute(route: Route, body: unknown, status = 200): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}
