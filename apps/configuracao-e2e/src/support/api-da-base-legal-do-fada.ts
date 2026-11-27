import type { Page, Route } from '@playwright/test';
import type {
  BaseLegalDoFadaDto,
  TipoInstrumentoNormativoComDescricao,
} from '@uniplus/shared-data/configuracao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

export const TIPO_PORTARIA: JsonDaApi<TipoInstrumentoNormativoComDescricao> = {
  codigo: 'PORTARIA',
  rotulo: 'Rótulo do tipo portaria',
  descricao: 'Descrição do tipo portaria.',
};
export const TIPO_LEI: JsonDaApi<TipoInstrumentoNormativoComDescricao> = {
  codigo: 'LEI',
  rotulo: 'Rótulo do tipo lei',
  descricao: 'Descrição do tipo lei.',
};
export const TIPOS_INSTRUMENTO = [TIPO_PORTARIA, TIPO_LEI];

export const MARABA = {
  id: 'cidade-1504208',
  codigoIbge: '1504208',
  nome: 'Marabá',
  uf: 'PA',
  ddd: '94',
};

export const BASE_DA_LISTA: JsonDaApi<BaseLegalDoFadaDto> = {
  id: 'ba5e0000-0000-7000-8000-000000000001',
  codigo: 'PORTARIA_UNIFESSPA_2514_2023',
  tipoInstrumento: { codigo: TIPO_PORTARIA.codigo, rotulo: TIPO_PORTARIA.rotulo },
  identificacao: 'Portaria Unifesspa nº 2514/2023',
  descricao: 'Institui inclusão regional.',
  municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
  criadoEm: '2026-01-01T00:00:00Z',
};

export const BASE_DA_LEI: JsonDaApi<BaseLegalDoFadaDto> = {
  id: 'ba5e0000-0000-7000-8000-000000000002',
  codigo: 'LEI_12711_2012',
  tipoInstrumento: { codigo: TIPO_LEI.codigo, rotulo: TIPO_LEI.rotulo },
  identificacao: 'Lei nº 12.711/2012',
  descricao: 'Reserva de vagas.',
  municipios: [{ codigoIbge: '1505502', nome: 'Parauapebas', uf: 'PA' }],
  criadoEm: '2026-01-01T00:00:00Z',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o drawer ou o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

/** Atraso da nova tentativa de leitura de apoio: o andamento (foco, botão indisponível) só é observável com a resposta pendente. */
const ATRASO_DA_NOVA_TENTATIVA_EM_MS = 800;

export const PROBLEMA_409_PROCESSANDO = {
  type: 'about:blank',
  title: 'Escrita em processamento',
  status: 409,
  code: 'uniplus.idempotency.processing_conflict',
};
export const PROBLEMA_404 = {
  type: 'about:blank',
  title: 'Base legal do Fator de Atenuação não encontrada',
  status: 404,
  code: 'uniplus.configuracao.base_legal_do_fada.nao_encontrado',
};
export const PROBLEMA_500 = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};
const CODIGO_DA_IDENTIFICACAO = 'uniplus.configuracao.base_legal_do_fada.identificacao_tamanho';
export const RECUSA_DE_IDENTIFICACAO = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: CODIGO_DA_IDENTIFICACAO,
  errors: [
    {
      field: 'identificacao',
      code: CODIGO_DA_IDENTIFICACAO,
      message: 'Identificação fora do padrão.',
    },
  ],
};

type Recarga = 'com-o-item' | 'sem-o-item' | 'com-falha';
export type Resposta = { status: number; corpo?: unknown };
export const CRIADO: Resposta = { status: 201 };
export const SALVO: Resposta = { status: 204 };

export interface Opcoes {
  readonly recarga: Recarga;
  /** A primeira consulta da lista responde 500. */
  readonly listaFalhaNaPrimeira?: boolean;
  /** Quantas consultas iniciais do vocabulário respondem 500. */
  readonly falhasDoVocabulario?: number;
  /** A primeira busca de município responde 503. */
  readonly buscaFalhaNaPrimeira?: boolean;
}

type Estado = { gravou: boolean };

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fulfillProblema(route: Route, corpo: object, status: number): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/problem+json',
    body: JSON.stringify(corpo),
  });
}

function itensDaLista(recarga: Recarga, gravou: boolean): readonly unknown[] {
  return gravou && recarga === 'sem-o-item' ? [] : [BASE_DA_LISTA];
}

async function responderLista(route: Route, opcoes: Opcoes, estado: Estado, consulta: number) {
  const primeiraFalha = opcoes.listaFalhaNaPrimeira && consulta === 1;
  if (!primeiraFalha && (estado.gravou || consulta > 1)) await esperar(ATRASO_DA_RECARGA_EM_MS);
  if (primeiraFalha || (estado.gravou && opcoes.recarga === 'com-falha')) {
    await fulfillProblema(route, PROBLEMA_500, 500);
    return;
  }
  const json = itensDaLista(opcoes.recarga, estado.gravou);
  await route.fulfill({ status: 200, headers: CORS_HEADERS, json });
}

async function mockLista(page: Page, opcoes: Opcoes, estado: Estado) {
  let consultas = 0;
  await page.route(/\/api\/configuracao\/bases-legais-fada(\?.*)?$/, async (route) => {
    consultas += 1;
    await responderLista(route, opcoes, estado, consultas);
  });
}

async function mockVocabulario(page: Page, opcoes: Opcoes) {
  let consultas = 0;
  await page.route(
    /\/api\/configuracao\/vocabularios\/tipos-instrumento-normativo(\?.*)?$/,
    async (route) => {
      consultas += 1;
      if (consultas <= (opcoes.falhasDoVocabulario ?? 0)) {
        await fulfillProblema(route, PROBLEMA_500, 500);
        return;
      }
      if (opcoes.falhasDoVocabulario) await esperar(ATRASO_DA_NOVA_TENTATIVA_EM_MS);
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: TIPOS_INSTRUMENTO });
    },
  );
}

async function mockBuscaDeMunicipio(page: Page, opcoes: Opcoes) {
  let buscas = 0;
  await page.route(/\/api\/cidades(\?.*)?$/, async (route) => {
    buscas += 1;
    if (opcoes.buscaFalhaNaPrimeira && buscas === 1) {
      await fulfillProblema(route, PROBLEMA_500, 500);
      return;
    }
    if (opcoes.buscaFalhaNaPrimeira) await esperar(ATRASO_DA_NOVA_TENTATIVA_EM_MS);
    await route.fulfill({ status: 200, headers: CORS_HEADERS, json: [MARABA] });
  });
}

async function fulfillResposta(route: Route, resposta: Resposta): Promise<void> {
  if (resposta.corpo !== undefined) {
    await fulfillProblema(route, resposta.corpo as object, resposta.status);
    return;
  }
  await route.fulfill({
    status: resposta.status,
    headers: CORS_HEADERS,
    ...(resposta.status === 201
      ? { contentType: 'application/json', body: JSON.stringify('novo-id') }
      : {}),
  });
}

interface EscritasDoMock {
  readonly respostas: readonly Resposta[];
  readonly envios: string[];
  readonly estado: Estado;
  readonly retida: Promise<void>;
}

function atenderEscrita(escritas: EscritasDoMock) {
  const { respostas, envios, estado, retida } = escritas;
  return async (route: Route): Promise<void> => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[envios.length];
    envios.push(route.request().method());
    await retida;
    if (resposta.status < 300) estado.gravou = true;
    await fulfillResposta(route, resposta);
  };
}

/** Cada POST, PUT ou DELETE consome a próxima resposta e fica retido até `liberar`. */
export async function mockApi(page: Page, respostas: readonly Resposta[], opcoes: Opcoes) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  const estado = { gravou: false };
  await mockLista(page, opcoes, estado);
  await mockVocabulario(page, opcoes);
  await mockBuscaDeMunicipio(page, opcoes);
  const escrita = atenderEscrita({ respostas, envios, estado, retida });
  await page.route(/\/api\/configuracao\/admin\/bases-legais-fada\/[^/?]+$/, escrita);
  await page.route(/\/api\/configuracao\/admin\/bases-legais-fada(\?.*)?$/, escrita);
  return { liberar, envios };
}
