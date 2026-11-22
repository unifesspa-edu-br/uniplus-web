import type { Page, Route } from '@playwright/test';
import {
  mockarVocabularioDeTiposDeDecisao,
  TIPOS_DE_DECISAO,
} from './api-do-vocabulario-de-tipos-de-decisao';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const PAPEIS_DE_BANCA = [
  { codigo: 'AVALIA_O_MERITO', rotulo: 'Avalia o mérito' },
  { codigo: 'JULGA_A_PRIMEIRA_INSTANCIA', rotulo: 'Julga o recurso em 1ª instância' },
  { codigo: 'IMPORTA_AS_NOTAS_DO_INEP', rotulo: 'Importa as notas do INEP' },
  { codigo: 'IMPORTA_CANDIDATOS', rotulo: 'Importa candidatos' },
  { codigo: 'JULGA_A_SEGUNDA_INSTANCIA', rotulo: 'Julga o recurso em 2ª instância' },
] as const;

const AVALIA_O_MERITO = PAPEIS_DE_BANCA[0];
const [, GABARITO_DA_PROVA] = TIPOS_DE_DECISAO;

/** O tipo de banca de entrevista, sem marca alguma. */
export const TIPO_ENTREVISTA = {
  id: '01960000-0000-7000-0000-0000000000b2',
  codigo: { codigo: 'BANCA_ENTREVISTA', rotulo: 'BANCA_ENTREVISTA' },
  nome: 'Banca de entrevista',
  faseTipica: 'Avaliação',
  descricao: null,
  papel: AVALIA_O_MERITO,
  exigeDuasOuMaisBancas: false,
  encerraRecursoNaPrimeiraInstancia: false,
  tiposDeDecisaoJulgados: [],
  criadoEm: '2026-06-10T12:00:00Z',
} as const;

/** A heteroidentificação exige duas ou mais bancas e encerra o recurso na 1ª instância. */
export const TIPO_HETEROIDENTIFICACAO = {
  ...TIPO_ENTREVISTA,
  id: '01960000-0000-7000-0000-0000000000b3',
  codigo: { codigo: 'BANCA_HETEROIDENTIFICACAO', rotulo: 'BANCA_HETEROIDENTIFICACAO' },
  nome: 'Banca de heteroidentificação',
  exigeDuasOuMaisBancas: true,
  encerraRecursoNaPrimeiraInstancia: true,
  tiposDeDecisaoJulgados: [GABARITO_DA_PROVA],
} as const;

/** O que a tela enviou na edição e, se houver, a recusa que o servidor simulado devolve. */
export interface EscritasDosTiposDeBanca {
  readonly envios: { readonly id: string; readonly corpo: Record<string, unknown> }[];
  recusa: object | null;
}

const idDaRota = (route: Route): string => route.request().url().split('/').pop() ?? '';

async function recusarEdicao(route: Route, recusa: object): Promise<void> {
  await route.fulfill({
    status: 422,
    headers: CORS_HEADERS,
    contentType: 'application/problem+json',
    body: JSON.stringify(recusa),
  });
}

async function receberEdicao(route: Route, escritas: EscritasDosTiposDeBanca): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  escritas.envios.push({ id: idDaRota(route), corpo: route.request().postDataJSON() });
  if (escritas.recusa !== null) await recusarEdicao(route, escritas.recusa);
  else await route.fulfill({ status: 204, headers: CORS_HEADERS });
}

async function mockarVocabularios(page: Page): Promise<void> {
  await mockarVocabularioDeTiposDeDecisao(page);
  await page.route(/\/api\/configuracao\/vocabularios\/papeis-de-banca$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: PAPEIS_DE_BANCA }),
  );
}

async function mockarListas(page: Page, tipos: readonly object[]): Promise<void> {
  await page.route(/\/api\/configuracao\/tipos-banca(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: tipos }),
  );
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] }),
  );
}

/** Serve a lista, os vocabulários e a edição dos tipos de banca; devolve o que a tela enviar. */
export async function mockarTiposDeBanca(
  page: Page,
  tipos: readonly object[],
): Promise<EscritasDosTiposDeBanca> {
  const escritas: EscritasDosTiposDeBanca = { envios: [], recusa: null };
  await mockarVocabularios(page);
  await mockarListas(page, tipos);
  await page.route(/\/api\/configuracao\/admin\/tipos-banca\/[^/?]+$/, (route) =>
    receberEdicao(route, escritas),
  );
  return escritas;
}
