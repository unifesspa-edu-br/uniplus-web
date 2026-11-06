import type { Page, Route } from '@playwright/test';
import type { TipoDocumentoDto } from '@uniplus/shared-data/configuracao';

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

const PROTECAO_SEED = {
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Comprovar a identificação do candidato na inscrição.',
  protecaoAprovada: true,
} as const;

export const rgSeed: TipoDocumentoDto = {
  id: RG_ID,
  codigo: 'RG',
  nome: 'Registro Geral',
  descricao: 'Documento de identificação civil.',
  categoria: 'IDENTIFICACAO',
  formatosAceitos: 'pdf,jpg',
  tamanhoMaximoMb: 10,
  tipoEquivalente: 'CIN',
  ...PROTECAO_SEED,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const laudoSeed: TipoDocumentoDto = {
  id: LAUDO_ID,
  codigo: 'LAUDO_MEDICO',
  nome: 'Laudo médico — PcD',
  descricao: null,
  categoria: 'SAUDE',
  formatosAceitos: null,
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  ...PROTECAO_SEED,
  criadoEm: '2026-06-11T12:00:00Z',
};

export interface Capturado {
  readonly posts: unknown[];
  readonly deletedIds: string[];
}

export function novoCapturado(): Capturado {
  return { posts: [], deletedIds: [] };
}

export interface OpcoesDaCriacao {
  readonly criarStatus?: number;
  readonly criarBody?: unknown;
}

/** Problem details do conflito de código, como a API devolve (registro de erros do tipo de documento). */
export const CODIGO_DUPLICADO_PROBLEM = {
  type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_documento.codigo_ja_existe',
  title: 'Já existe um tipo de documento ativo com este código',
  detail: 'Já existe um tipo de documento vivo com o código informado.',
  status: 409,
  code: 'uniplus.configuracao.tipo_documento.codigo_ja_existe',
} as const;

export async function mockApi(
  page: Page,
  capturado: Capturado,
  lista: readonly TipoDocumentoDto[],
  opcoes: OpcoesDaCriacao = {},
): Promise<void> {
  await mockRemocao(page, capturado);
  await mockCriacao(page, capturado, opcoes);
  await mockLeitura(page, lista);
}

async function mockRemocao(page: Page, capturado: Capturado): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/tipos-documento\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const partes = route.request().url().split('/');
      capturado.deletedIds.push(partes[partes.length - 1] ?? '');
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
}

async function mockCriacao(
  page: Page,
  capturado: Capturado,
  opcoes: OpcoesDaCriacao,
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/tipos-documento(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    capturado.posts.push(route.request().postDataJSON());
    const status = opcoes.criarStatus ?? 201;
    await route.fulfill({
      status,
      contentType: status >= 400 ? 'application/problem+json' : 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(opcoes.criarBody ?? 'novo-tipo-documento-id'),
    });
  });
}

async function mockLeitura(page: Page, lista: readonly TipoDocumentoDto[]): Promise<void> {
  await page.route(/\/api\/configuracao\/tipos-documento(\?.*)?$/, (route) =>
    jsonRoute(route, lista),
  );
  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (route) =>
    jsonRoute(route, categoriasSeed),
  );
  await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (route) =>
    jsonRoute(route, []),
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
